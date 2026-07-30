/**
 * CloudBase 云函数：arkExplainStream
 *
 * 通过 HTTP 访问服务输出与前端一致的 SSE 协议（Mini 低延迟）。
 * 包含后端硬配额（NoSQL 持久化）+ IP 限流（内存兜底）。
 *
 * 说明：当前以 Event Function + HTTP Access 部署（CLI 2.x 无 --httpFn）。
 * 上游仍用 stream:true 生成，再组装成 SSE 正文一次返回；首包延迟≈整段生成时间（Mini 通常约 1s）。
 *
 * 环境变量：ARK_API_KEY
 */

'use strict';

// ===== CloudBase NoSQL（用于配额与用量记录） =====

const cloudbase = require('@cloudbase/node-sdk');
const cbApp = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = cbApp.database();

// ===== 配额常量 =====

const EXPLAIN_FREE_LIMIT = 20;
const DAILY_COST_CAP_YUAN = 50;
const COST_ALERT_RATIO = 0.8;

// ===== 模型定价（元/1K tokens） =====

const PRICING_EXPLAIN = { inputPerK: 0.0004, outputPerK: 0.001, searchCost: 0 };

// ===== API 配置 =====

const ARK_CHAT_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const MODEL_ID = 'doubao-seed-2-0-mini-260215';
const MAX_TOKENS = 360;

/* ===== 安全防护 ===== */

const MAX_PROMPT_LENGTH = 500;
const RATE_WINDOW_MS = 3000;
const RATE_MAX_PER_WINDOW = 3;

/** 允许的 CORS 来源（新增域名后在此追加） */
const ALLOWED_ORIGINS = [
  'https://shufu-life-d8g9j8v5385543c1a-1435171508.tcloudbaseapp.com',
  'http://localhost:5173',
  'http://localhost:4173',
  // ★ 新域名发布后追加：
  // 'https://你的域名.com',
];

// ===== NoSQL 配额管理器 =====

const COLLECTION_USAGE = 'ai_daily_usage';
const COLLECTION_RECORDS = 'ai_call_records';

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function validateUserId(userId) {
  if (!userId || typeof userId !== 'string') return null;
  if (userId.length > 100) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) return null;
  return userId;
}

async function checkUserQuota(uid) {
  if (!uid) return { allowed: true, remaining: -1, dailyLimit: 0 };

  const date = todayStr();
  const docId = `${uid}_${date}_explain`;

  try {
    const coll = db.collection(COLLECTION_USAGE);
    let existing;
    try {
      const res = await coll.doc(docId).get();
      existing = res;
    } catch {
      existing = null;
    }

    if (!existing || !existing.data || (Array.isArray(existing.data) && existing.data.length === 0)) {
      await coll.add({
        _id: docId,
        uid,
        date,
        actionType: 'explain',
        count: 1,
        limit: EXPLAIN_FREE_LIMIT,
        createdAt: cbApp.serverDate(),
        updatedAt: cbApp.serverDate(),
      });
      return { allowed: true, remaining: EXPLAIN_FREE_LIMIT - 1, dailyLimit: EXPLAIN_FREE_LIMIT };
    }

    const doc = Array.isArray(existing.data) ? existing.data[0] : existing.data;
    const currentCount = doc.count || 0;

    if (currentCount >= EXPLAIN_FREE_LIMIT) {
      return { allowed: false, remaining: 0, dailyLimit: EXPLAIN_FREE_LIMIT };
    }

    await coll.doc(docId).update({
      count: currentCount + 1,
      updatedAt: cbApp.serverDate(),
    });

    return { allowed: true, remaining: EXPLAIN_FREE_LIMIT - currentCount - 1, dailyLimit: EXPLAIN_FREE_LIMIT };
  } catch (err) {
    console.error('[arkExplainStream][quota] error:', err?.message || err);
    return { allowed: true, remaining: -1, dailyLimit: EXPLAIN_FREE_LIMIT };
  }
}

async function recordCall({ uid, clientIp, inputTokens, outputTokens, success, requestId }) {
  const inputCost = (inputTokens || 0) / 1000 * PRICING_EXPLAIN.inputPerK;
  const outputCost = (outputTokens || 0) / 1000 * PRICING_EXPLAIN.outputPerK;
  const estimatedCost = Math.round((inputCost + outputCost) * 1e6) / 1e6;

  try {
    await db.collection(COLLECTION_RECORDS).add({
      uid: uid || 'unknown',
      ip: clientIp || 'unknown',
      date: todayStr(),
      ts: cbApp.serverDate(),
      action: 'explain.selection',
      model: MODEL_ID,
      inputTokens: inputTokens || 0,
      outputTokens: outputTokens || 0,
      totalTokens: (inputTokens || 0) + (outputTokens || 0),
      searchCount: 0,
      estimatedCost,
      success,
      requestId,
    });
    void checkDailyCostAlert();
  } catch (err) {
    console.error('[arkExplainStream][quota] recordCall error:', err?.message || err);
  }
}

async function checkDailyCostAlert() {
  const date = todayStr();
  try {
    const res = await db.collection(COLLECTION_RECORDS).where({ date }).get();
    let totalCost = 0;
    for (const r of res.data || []) {
      totalCost += r.estimatedCost || 0;
    }
    const alertThreshold = DAILY_COST_CAP_YUAN * COST_ALERT_RATIO;
    if (totalCost >= alertThreshold) {
      console.warn(JSON.stringify({
        type: 'cost_alert',
        date,
        totalCost: Math.round(totalCost * 1e4) / 1e4,
        alertThreshold,
        hardCap: DAILY_COST_CAP_YUAN,
        func: 'arkExplainStream',
      }));
    }
  } catch (err) {
    console.error('[arkExplainStream][quota] costAlert error:', err?.message || err);
  }
}

// ===== IP 限流 =====

const _rateBuckets = new Map();
const _rateCleanupTime = { last: 0 };

function isRateLimited(ip) {
  const now = Date.now();
  if (now - _rateCleanupTime.last > 60_000) {
    _rateCleanupTime.last = now;
    const cutoff = now - RATE_WINDOW_MS * 2;
    for (const [k, t] of _rateBuckets) {
      if (t < cutoff) _rateBuckets.delete(k);
    }
  }
  const key = `${ip}`;
  const last = _rateBuckets.get(key) || 0;
  if (now - last < Math.ceil(RATE_WINDOW_MS / RATE_MAX_PER_WINDOW)) {
    return true;
  }
  _rateBuckets.set(key, now);
  return false;
}

// ===== HTTP / SSE 辅助 =====

function resolveCorsOrigin(requestOrigin) {
  if (!requestOrigin) return ALLOWED_ORIGINS[0];
  if (ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
  if (requestOrigin.startsWith('http://localhost:')) return requestOrigin;
  return null;
}

const CORS_HEADERS_BASE = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function httpResult(statusCode, headers, body, requestOrigin) {
  const allowOrigin = resolveCorsOrigin(requestOrigin);
  const corsHeaders = allowOrigin
    ? { ...CORS_HEADERS_BASE, 'Access-Control-Allow-Origin': allowOrigin }
    : { ...CORS_HEADERS_BASE };
  return {
    isBase64Encoded: false,
    statusCode,
    headers: { ...corsHeaders, ...headers },
    body,
  };
}

function parseHttpBody(event) {
  if (event == null) return {};
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

function getClientIp(event) {
  return (
    (event?.requestContext?.http?.sourceIp) ||
    (event?.headers?.['x-forwarded-for'] || '').split(',')[0]?.trim() ||
    'unknown'
  );
}

// ===== 火山引擎流式调用 =====

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
      if (json.usage) {
        usage = json.usage;
      }
      const delta = json.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) content += delta;
    }
  }

  return { model, content, usage };
}

function normalizeUsage(usage) {
  if (!usage) return { inputTokens: 0, outputTokens: 0 };
  const input = usage.input_tokens ?? usage.prompt_tokens ?? 0;
  const output = usage.output_tokens ?? usage.completion_tokens ?? 0;
  return { inputTokens: input, outputTokens: output };
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

/**
 * 403 无 CORS 头的响应（浏览器自动屏蔽）
 */
function forbidden(requestOrigin) {
  return httpResult(403, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Forbidden', requestOrigin);
}

// ===== 云函数入口 =====

exports.main = async function (event /*, context */) {
  const method = (event?.httpMethod || event?.requestContext?.http?.method || 'POST')
    .toString()
    .toUpperCase();

  const requestOrigin =
    event?.headers?.origin ||
    event?.headers?.Origin ||
    event?.requestContext?.http?.origin ||
    '';

  // 非白名单来源拦截
  if (!resolveCorsOrigin(requestOrigin) && isHttpEvent(event)) {
    return forbidden(requestOrigin);
  }

  if (method === 'OPTIONS') {
    return httpResult(204, {}, '', requestOrigin);
  }

  if (method === 'GET') {
    return httpResult(200, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({
      ok: true,
      service: 'arkExplainStream',
      model: MODEL_ID,
    }), requestOrigin);
  }

  const clientIp = getClientIp(event);

  try {
    const body = parseHttpBody(event);
    const prompt = typeof body.prompt === 'string' ? body.prompt : '';
    const userId = validateUserId(body.userId);

    // prompt 长度校验
    if (!prompt || prompt.trim().length === 0) {
      return httpResult(
        400,
        { 'Content-Type': 'text/event-stream; charset=utf-8' },
        `data: ${JSON.stringify({ type: 'error', message: 'prompt is required' })}\n`,
        requestOrigin,
      );
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return httpResult(
        400,
        { 'Content-Type': 'text/event-stream; charset=utf-8' },
        `data: ${JSON.stringify({ type: 'error', message: `prompt too long (${prompt.length} > ${MAX_PROMPT_LENGTH})` })}\n`,
        requestOrigin,
      );
    }

    // 1. IP 级限流（第一道防线，内存）
    if (isRateLimited(clientIp)) {
      console.warn('[arkExplainStream] ip-rate-limited', `ip=${clientIp}`);
      return httpResult(
        429,
        { 'Content-Type': 'text/event-stream; charset=utf-8', 'Retry-After': '3' },
        `data: ${JSON.stringify({ type: 'error', message: 'Rate limited, please wait' })}\n`,
        requestOrigin,
      );
    }

    // 2. 用户级硬配额（第二道防线，NoSQL）
    if (userId) {
      const quota = await checkUserQuota(userId);
      if (!quota.allowed) {
        console.warn('[arkExplainStream] user-quota-exceeded', `uid=${userId.slice(0, 8)}...`, `limit=${quota.dailyLimit}`);
        // 记录被拒调用
        void recordCall({
          uid: userId,
          clientIp,
          inputTokens: 0,
          outputTokens: 0,
          success: false,
          requestId: body.requestId || 'unknown',
        }).catch(() => {});
        return httpResult(
          429,
          { 'Content-Type': 'text/event-stream; charset=utf-8' },
          `data: ${JSON.stringify({ type: 'error', message: `Daily quota exceeded (${quota.dailyLimit} per day). Please try again tomorrow.` })}\n`,
          requestOrigin,
        );
      }
      console.log('[arkExplainStream] quota-ok', `uid=${userId.slice(0, 8)}...`, `remaining=${quota.remaining}/${quota.dailyLimit}`);
    } else {
      console.warn('[arkExplainStream] no-valid-uid', `ip=${clientIp}`);
    }

    // 调用火山引擎
    const { model, content, usage } = await collectArkStream(prompt);

    if (usage) logUsage(model, usage);

    // 记录成功调用
    const norm = normalizeUsage(usage);
    void recordCall({
      uid: userId || 'unknown',
      clientIp,
      inputTokens: norm.inputTokens,
      outputTokens: norm.outputTokens,
      success: true,
      requestId: body.requestId || 'unknown',
    }).catch(() => {});

    if (!content.trim()) {
      const errBody = [
        `data: ${JSON.stringify({ type: 'meta', model, stage: 'upstream' })}`,
        '',
        `data: ${JSON.stringify({ type: 'error', message: 'Model returned empty output' })}`,
        '',
      ].join('\n');
      return httpResult(200, { 'Content-Type': 'text/event-stream; charset=utf-8' }, errBody, requestOrigin);
    }

    if (isHttpEvent(event)) {
      return httpResult(
        200,
        {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
        },
        toSseBody(model, content),
        requestOrigin,
      );
    }

    return { ok: true, model, content };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // 记录失败调用
    void recordCall({
      uid: validateUserId(
        typeof parseHttpBody === 'function'
          ? (() => { try { return parseHttpBody(event).userId; } catch { return null; } })()
          : null,
      ) || 'unknown',
      clientIp,
      inputTokens: 0,
      outputTokens: 0,
      success: false,
      requestId: (() => { try { return parseHttpBody(event).requestId || 'unknown'; } catch { return 'unknown'; } })(),
    }).catch(() => {});

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
        requestOrigin,
      );
    }
    return {
      ok: false,
      model: MODEL_ID,
      error: { code: 'UPSTREAM_ERROR', message, retryable: true },
    };
  }
};
