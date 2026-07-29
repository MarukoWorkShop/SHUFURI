/**
 * CloudBase 云函数：arkExplainStream
 * 通过 HTTP 访问服务输出与前端一致的 SSE 协议（Mini 低延迟）。
 *
 * 说明：当前以 Event Function + HTTP Access 部署（CLI 2.x 无 --httpFn）。
 * 上游仍用 stream:true 生成，再组装成 SSE 正文一次返回；首包延迟≈整段生成时间（Mini 通常约 1s）。
 *
 * 环境变量：ARK_API_KEY
 */

'use strict';

const ARK_CHAT_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const MODEL_ID = 'doubao-seed-2-0-mini-260215';
const MAX_TOKENS = 360;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function httpResult(statusCode, headers, body) {
  return {
    isBase64Encoded: false,
    statusCode,
    headers: { ...CORS_HEADERS, ...headers },
    body,
  };
}

function parseHttpBody(event) {
  if (event == null) return {};
  // SDK / 直接 invoke
  if (typeof event.prompt === 'string') return event;
  let raw = event.body;
  if (!raw) return event.queryStringParameters || {};
  if (event.isBase64Encoded) {
    raw = Buffer.from(raw, 'base64').toString('utf8');
  }
  if (typeof raw !== 'string') return raw || {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function isHttpEvent(event) {
  return Boolean(
    event &&
      (event.httpMethod ||
        event.requestContext ||
        event.headers ||
        typeof event.path === 'string'),
  );
}

async function collectArkStream(prompt) {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) throw new Error('ARK_API_KEY not configured');
  if (!prompt || !String(prompt).trim()) throw new Error('prompt is required');

  const upstream = await fetch(ARK_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL_ID,
      messages: [{ role: 'user', content: String(prompt) }],
      temperature: 0.2,
      max_tokens: MAX_TOKENS,
      stream: true,
      stream_options: { include_usage: true },
      thinking: { type: 'disabled' },
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    let msg = `Upstream ${upstream.status}`;
    try {
      const json = JSON.parse(text);
      msg = json.error?.message || json.message || msg;
    } catch {
      if (text) msg = `${msg}: ${text.slice(0, 200)}`;
    }
    throw new Error(msg);
  }

  if (!upstream.body) throw new Error('empty upstream body');

  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let model = MODEL_ID;
  let usage = null;

  for await (const chunk of upstream.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const lineRaw of lines) {
      const line = lineRaw.trim();
      if (!line.startsWith('data:')) continue;
      const raw = line.replace(/^data:\s*/, '').trim();
      if (!raw || raw === '[DONE]') continue;
      let json;
      try {
        json = JSON.parse(raw);
      } catch {
        continue;
      }
      if (typeof json.model === 'string' && json.model.trim()) {
        model = json.model.trim();
      }
      // 流末尾的 usage 块（依赖 stream_options.include_usage）
      if (json.usage) {
        usage = json.usage;
      }
      const delta = json.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) content += delta;
    }
  }

  return { model, content, usage };
}

function logUsage(model, usage) {
  try {
    const entry = {
      type: 'ai_usage',
      ts: new Date().toISOString(),
      action: 'explain.selection',
      model: model || MODEL_ID,
      inputTokens: usage?.input_tokens ?? usage?.prompt_tokens ?? null,
      outputTokens: usage?.output_tokens ?? usage?.completion_tokens ?? null,
      totalTokens: usage?.total_tokens ?? null,
      cacheHitTokens: usage?.prompt_tokens_details?.cached_tokens ?? null,
    };
    console.log(JSON.stringify(entry));
  } catch {
    /* 埋点失败不影响主流程 */
  }
}

function toSseBody(model, content) {
  const lines = [
    `data: ${JSON.stringify({ type: 'meta', model, stage: 'upstream' })}`,
    '',
  ];
  if (content) {
    lines.push(`data: ${JSON.stringify({ type: 'delta', text: content })}`, '');
  }
  lines.push(`data: ${JSON.stringify({ type: 'done' })}`, '');
  return lines.join('\n');
}

exports.main = async function (event /*, context */) {
  const method = (event?.httpMethod || event?.requestContext?.http?.method || 'POST')
    .toString()
    .toUpperCase();

  if (method === 'OPTIONS') {
    return httpResult(204, {}, '');
  }

  if (method === 'GET') {
    return httpResult(200, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({
      ok: true,
      service: 'arkExplainStream',
      model: MODEL_ID,
    }));
  }

  try {
    const body = parseHttpBody(event);
    const { model, content, usage } = await collectArkStream(body.prompt);
    if (usage) logUsage(model, usage);
    if (!content.trim()) {
      const errBody = [
        `data: ${JSON.stringify({ type: 'meta', model, stage: 'upstream' })}`,
        '',
        `data: ${JSON.stringify({ type: 'error', message: 'Model returned empty output' })}`,
        '',
      ].join('\n');
      return httpResult(200, { 'Content-Type': 'text/event-stream; charset=utf-8' }, errBody);
    }

    // HTTP Access：必须以 HTTP 响应结构返回，才能被网关透传
    if (isHttpEvent(event)) {
      return httpResult(
        200,
        {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
        },
        toSseBody(model, content),
      );
    }

    // SDK invoke 调试
    return {
      ok: true,
      model,
      content,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isHttpEvent(event)) {
      return httpResult(
        200,
        { 'Content-Type': 'text/event-stream; charset=utf-8' },
        [
          `data: ${JSON.stringify({ type: 'meta', model: MODEL_ID, stage: 'upstream' })}`,
          '',
          `data: ${JSON.stringify({ type: 'error', message })}`,
          '',
        ].join('\n'),
      );
    }
    return {
      ok: false,
      model: MODEL_ID,
      error: { code: 'UPSTREAM_ERROR', message, retryable: true },
    };
  }
};
