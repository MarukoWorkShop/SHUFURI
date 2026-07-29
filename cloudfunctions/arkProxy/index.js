/**
 * CloudBase 云函数：arkProxy
 *
 * 职责：接收前端请求 → 调用火山引擎 ARK Chat Completions → 返回结果
 * - explain.selection：精简划词/语法讲解（不联网）
 * - lyrics.step2：根据已确认歌词生成「词解与语法」学习材料（联网多源检索）
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
const MODEL_ID_EXPLAIN = 'doubao-seed-2-0-mini-260215';
/** 歌词生成：Pro 模型，需要更大的 token 容量和更好的质量 */
const MODEL_ID_LYRICS = 'doubao-seed-2-1-pro-260628';
/** 语境释义+语法拆解+意境（语法段可稍长） */
const MAX_TOKENS_EXPLAIN = 360;
/** 歌词生成：整首歌词需要较大 token */
const MAX_TOKENS_LYRICS = 4096;
/** 歌词生成温度：低温度减少幻觉 */
const TEMPERATURE_LYRICS = 0.1;

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
    model: MODEL_ID_EXPLAIN,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: MAX_TOKENS_EXPLAIN,
    stream: false,
    // Seed 2.x：关闭深度思考，否则 TTFT 可达几十秒
    thinking: { type: 'disabled' },
  };
}

function buildLyricsChatRequest(prompt) {
  return {
    model: MODEL_ID_LYRICS,
    messages: [{ role: 'user', content: prompt }],
    temperature: TEMPERATURE_LYRICS,
    max_tokens: MAX_TOKENS_LYRICS,
    stream: false,
    // lyrics 生成不需要深度思考，追求速度和准确度
    thinking: { type: 'disabled' },
    // 联网搜索：支持多源比对官方歌词库（UtaTen / Genius / Melon 等），
    // 为「词解与语法」学习材料提供事实依据。需部署侧确认 API Key 已开通联网搜索。
    // 注：火山方舟 Web Search 通过 chat/completions 的 web_search 参数开启。
    web_search: { enable: true },
  };
}

function extractChatAssistantText(result) {
  return (result?.choices?.[0]?.message?.content || '').trim();
}

/** 优先用上游返回的 model，否则回落默认模型，便于核对部署 */
function resolveModelId(result, fallbackModel) {
  const upstream = result?.model;
  if (typeof upstream === 'string' && upstream.trim()) return upstream.trim();
  return fallbackModel;
}

function normalizeUsage(result) {
  const usage = result?.usage;
  if (!usage) return undefined;
  const input = usage.input_tokens ?? usage.prompt_tokens;
  const output = usage.output_tokens ?? usage.completion_tokens;
  const cacheHit = usage?.prompt_tokens_details?.cached_tokens ?? null;
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: usage.total_tokens ?? (input != null && output != null ? input + output : undefined),
    cacheHitTokens: cacheHit,
  };
}

/** 联网搜索次数（best-effort，火山 action_usage 结构可能变化） */
function countWebSearches(result) {
  try {
    const au = result?.action_usage;
    if (Array.isArray(au) && au.length) {
      return au.reduce((n, x) => n + (Number(x?.count) || 0), 0) || au.length;
    }
    return null;
  } catch {
    return null;
  }
}

/** 结构化 AI 用量日志：单行 JSON，便于在 CloudBase 函数日志中聚合做成本校准 */
function logAiUsage({ requestId, action, model, usage, searchCount, contentLen }) {
  const entry = {
    type: 'ai_usage',
    ts: new Date().toISOString(),
    requestId: requestId || null,
    action: action || null,
    model: model || null,
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
    totalTokens: usage?.totalTokens ?? null,
    cacheHitTokens: usage?.cacheHitTokens ?? null,
    searchCount: searchCount ?? null,
    contentLen: contentLen ?? null,
  };
  console.log(JSON.stringify(entry));
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

  const validActions = ['explain.selection', 'lyrics.step2'];
  if (!validActions.includes(action)) {
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

  const isLyricsStep = action === 'lyrics.step2';
  const model = isLyricsStep ? MODEL_ID_LYRICS : MODEL_ID_EXPLAIN;

  console.log(
    '[arkProxy] request',
    `requestId=${requestId}`,
    `action=${action}`,
    `model=${model}`,
    `lang=${targetLanguage}`,
    `iface=${interfaceLanguage}`,
    `promptLen=${prompt.length}`,
    'api=chat',
  );

  try {
    const chatParams = isLyricsStep
      ? buildLyricsChatRequest(prompt)
      : buildExplainChatRequest(prompt);
    const result = await callVolcengine(ARK_CHAT_URL, chatParams);
    const content = extractChatAssistantText(result);
    const usage = normalizeUsage(result);
    const resolvedModel = resolveModelId(result, model);

    if (!content) {
      console.warn(
        '[arkProxy] empty output',
        `requestId=${requestId}`,
        `action=${action}`,
        `model=${resolvedModel}`,
        `finishReason=${result?.choices?.[0]?.finish_reason ?? 'n/a'}`,
      );
      return {
        ok: false,
        requestId,
        model: resolvedModel,
        usage,
        error: {
          code: 'EMPTY_OUTPUT',
          message: 'Model returned empty output',
          retryable: true,
        },
      };
    }

    logAiUsage({
      requestId,
      action,
      model: resolvedModel,
      usage,
      searchCount: countWebSearches(result),
      contentLen: content.length,
    });

    return {
      ok: true,
      requestId,
      action,
      model: resolvedModel,
      content,
      usage,
    };
  } catch (err) {
    console.error(
      '[arkProxy] error',
      `requestId=${requestId}`,
      `action=${action}`,
      `model=${model}`,
      `message=${(err instanceof Error ? err.message : String(err)).slice(0, 200)}`,
    );

    return {
      ok: false,
      requestId,
      action,
      model,
      error: classifyError(err),
    };
  }
};
