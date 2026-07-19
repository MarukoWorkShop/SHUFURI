/**
 * CloudBase 云函数：arkProxy
 *
 * 职责：接收前端请求 → 调用火山引擎 ARK Chat Completions → 返回结果
 * - explain.selection：精简划词/语法（不联网）
 *
 * 安全边界：
 * - API Key 存储在 CloudBase 环境变量 ARK_API_KEY
 * - 前端不传递 Key 或 Authorization 头
 * - 固定模型、域名、最大 token
 */

'use strict';

const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const ARK_CHAT_URL = `${ARK_BASE_URL}/chat/completions`;
/** 划词短答：Mini 低延迟；Pro 深度思考会导致首字几十秒 */
const MODEL_ID = 'doubao-seed-2-0-mini-260215';
/** 语境释义+语法拆解+意境（语法段可稍长） */
const MAX_TOKENS = 360;

async function callVolcengine(url, params) {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    throw new Error('ARK_API_KEY not configured');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let errorMsg = `Upstream ${res.status}`;
    try {
      const json = JSON.parse(text);
      errorMsg = json.error?.message || json.message || errorMsg;
    } catch {
      if (text) errorMsg = `${errorMsg}: ${text.slice(0, 200)}`;
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

function buildExplainChatRequest(prompt) {
  return {
    model: MODEL_ID,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: MAX_TOKENS,
    stream: false,
    // Seed 2.x：关闭深度思考，否则 TTFT 可达几十秒
    thinking: { type: 'disabled' },
  };
}

function extractChatAssistantText(result) {
  return (result?.choices?.[0]?.message?.content || '').trim();
}

/** 优先用上游返回的 model，否则回落本地 MODEL_ID，便于核对部署 */
function resolveModelId(result) {
  const upstream = result?.model;
  if (typeof upstream === 'string' && upstream.trim()) return upstream.trim();
  return MODEL_ID;
}

function normalizeUsage(result) {
  const usage = result?.usage;
  if (!usage) return undefined;
  return {
    inputTokens: usage.input_tokens ?? usage.prompt_tokens,
    outputTokens: usage.output_tokens ?? usage.completion_tokens,
  };
}

function classifyError(err) {
  const message = err instanceof Error ? err.message : String(err);
  const isTimeout = message.includes('timeout') || message.includes('ETIMEDOUT');
  const isRateLimit = message.includes('429') || message.includes('rate_limit');
  const isAuthFail =
    message.includes('401') ||
    message.includes('403') ||
    message.includes('InvalidApiKey');

  let code = 'UPSTREAM_ERROR';
  if (isTimeout) code = 'UPSTREAM_TIMEOUT';
  if (isRateLimit) code = 'RATE_LIMITED';
  if (isAuthFail) code = 'AUTH_FAILED';

  return {
    code,
    message: message.slice(0, 500),
    retryable: isTimeout || isRateLimit,
  };
}

/**
 * CloudBase 云函数入口
 */
exports.main = async function (event, _context) {
  const { action, requestId, prompt, targetLanguage, interfaceLanguage } = event;

  if (action !== 'explain.selection') {
    return {
      ok: false,
      requestId: requestId || 'unknown',
      error: {
        code: 'INVALID_REQUEST',
        message: `Unknown action: ${action}`,
        retryable: false,
      },
    };
  }

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return {
      ok: false,
      requestId: requestId || 'unknown',
      error: {
        code: 'INVALID_REQUEST',
        message: 'prompt is required and must be non-empty',
        retryable: false,
      },
    };
  }

  console.log(
    '[arkProxy] request',
    `requestId=${requestId}`,
    `model=${MODEL_ID}`,
    `lang=${targetLanguage}`,
    `iface=${interfaceLanguage}`,
    `promptLen=${prompt.length}`,
    'api=chat',
  );

  try {
    const result = await callVolcengine(ARK_CHAT_URL, buildExplainChatRequest(prompt));
    const content = extractChatAssistantText(result);
    const usage = normalizeUsage(result);
    const model = resolveModelId(result);

    if (!content) {
      console.warn(
        '[arkProxy] empty output',
        `requestId=${requestId}`,
        `model=${model}`,
        `finishReason=${result?.choices?.[0]?.finish_reason ?? 'n/a'}`,
      );
      return {
        ok: false,
        requestId,
        model,
        usage,
        error: {
          code: 'EMPTY_OUTPUT',
          message: 'Model returned empty output',
          retryable: true,
        },
      };
    }

    console.log(
      '[arkProxy] success',
      `requestId=${requestId}`,
      `model=${model}`,
      `contentLen=${content.length}`,
      `tokens: in=${usage?.inputTokens ?? '?'} out=${usage?.outputTokens ?? '?'}`,
    );

    return {
      ok: true,
      requestId,
      model,
      content,
      usage,
    };
  } catch (err) {
    console.error(
      '[arkProxy] error',
      `requestId=${requestId}`,
      `model=${MODEL_ID}`,
      `message=${(err instanceof Error ? err.message : String(err)).slice(0, 200)}`,
    );

    return {
      ok: false,
      requestId,
      model: MODEL_ID,
      error: classifyError(err),
    };
  }
};
