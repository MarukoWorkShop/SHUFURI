/**
 * CloudBase 云函数：arkProxy
 *
 * 职责：接收前端请求 → 配额校验 → 调用火山引擎 ARK Chat Completions → 记录用量 → 返回结果
 * - explain.selection：精简划词/语法讲解（不联网，Mini 模型）
 * - lyrics.step2：根据已确认歌词生成「词解与语法」学习材料（联网，Pro 模型）
 *
 * 安全边界：
 * - API Key 存储在 CloudBase 环境变量 ARK_API_KEY
 * - 前端不传递 Key 或 Authorization 头
 * - 固定模型、域名、最大 token
 * - 基于用户 UID 的后端硬配额（NoSQL 持久化）
 * - IP 级限流（内存，兜底）
 */

'use strict';

// ===== CloudBase NoSQL（用于配额与用量记录） =====

const cloudbase = require('@cloudbase/node-sdk');
const cbApp = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = cbApp.database();

// ===== 配额常量（与前端 src/services/aiUsageLimit.ts 保持一致） =====

/** 划词讲解每日免费额度 */
const EXPLAIN_FREE_LIMIT = 20;
/** 词解与语法生成每日免费额度 */
const LYRICS_FREE_LIMIT = 5;
/** 当日费用硬上限（元） */
const DAILY_COST_CAP_YUAN = 50;
/** 费用告警阈值比例 */
const COST_ALERT_RATIO = 0.8;

// ===== 火山引擎模型定价（元/1K tokens） =====

const PRICING_EXPLAIN = { inputPerK: 0.0004, outputPerK: 0.001, searchCost: 0 };
const PRICING_LYRICS = { inputPerK: 0.0008, outputPerK: 0.002, searchCost: 0.03 };

// ===== 火山引擎 API 配置 =====

const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const ARK_CHAT_URL = `${ARK_BASE_URL}/chat/completions`;
const MODEL_ID_EXPLAIN = 'doubao-seed-2-0-mini-260215';
const MODEL_ID_LYRICS = 'doubao-seed-2-1-pro-260628';
const MAX_TOKENS_EXPLAIN = 360;
const MAX_TOKENS_LYRICS = 4096;
const TEMPERATURE_LYRICS = 0.1;

/* ===== 安全防护 ===== */

const MAX_PROMPT_LENGTH_EXPLAIN = 500;
const MAX_PROMPT_LENGTH_LYRICS = 8000;

// ===== IP 限流（内存，冷启动重置） =====

const RATE_WINDOW_MS = 3000;
const RATE_MAX_PER_WINDOW = 3;

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

// ===== NoSQL 配额管理器 =====

const COLLECTION_USAGE = 'ai_daily_usage';
const COLLECTION_RECORDS = 'ai_call_records';

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 检查用户当日配额（NoSQL 原子操作）。
 * @returns {{ allowed: boolean, remaining: number, dailyLimit: number, error?: string }}
 */
async function checkUserQuota(uid, actionType) {
  if (!uid) return { allowed: true, remaining: -1, dailyLimit: 0 }; // 无 UID 时放行，IP 限流兜底

  const limit = actionType === 'explain' ? EXPLAIN_FREE_LIMIT : LYRICS_FREE_LIMIT;
  const date = todayStr();
  const docId = `${uid}_${date}_${actionType}`;

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
      // 首次使用：创建记录
      await coll.add({
        _id: docId,
        uid,
        date,
        actionType,
        count: 1,
        limit,
        createdAt: cbApp.serverDate(),
        updatedAt: cbApp.serverDate(),
      });
      return { allowed: true, remaining: limit - 1, dailyLimit: limit };
    }

    const doc = Array.isArray(existing.data) ? existing.data[0] : existing.data;
    const currentCount = doc.count || 0;

    if (currentCount >= limit) {
      return { allowed: false, remaining: 0, dailyLimit: limit };
    }

    await coll.doc(docId).update({
      count: currentCount + 1,
      updatedAt: cbApp.serverDate(),
    });

    return { allowed: true, remaining: limit - currentCount - 1, dailyLimit: limit };
  } catch (err) {
    console.error('[arkProxy][quota] checkUserQuota error:', err?.message || err);
    // NoSQL 异常时放行，IP 限流兜底
    return { allowed: true, remaining: -1, dailyLimit: limit };
  }
}

/**
 * 记录单次 AI 调用到 NoSQL，用于费用统计和日报。
 */
async function recordCall({ uid, clientIp, action, model, inputTokens, outputTokens, success, requestId }) {
  const isLyrics = action === 'lyrics.step2';
  const pricing = isLyrics ? PRICING_LYRICS : PRICING_EXPLAIN;
  const inputCost = (inputTokens || 0) / 1000 * pricing.inputPerK;
  const outputCost = (outputTokens || 0) / 1000 * pricing.outputPerK;
  const searchCost = isLyrics ? pricing.searchCost : 0;
  const estimatedCost = Math.round((inputCost + outputCost + searchCost) * 1e6) / 1e6;

  try {
    await db.collection(COLLECTION_RECORDS).add({
      uid: uid || 'unknown',
      ip: clientIp || 'unknown',
      date: todayStr(),
      ts: cbApp.serverDate(),
      action,
      model: model || 'unknown',
      inputTokens: inputTokens || 0,
      outputTokens: outputTokens || 0,
      totalTokens: (inputTokens || 0) + (outputTokens || 0),
      searchCount: isLyrics ? 1 : 0,
      estimatedCost,
      success,
      requestId,
    });

    // 检查是否触发费用告警
    void checkDailyCostAlert();
  } catch (err) {
    console.error('[arkProxy][quota] recordCall error:', err?.message || err);
  }
}

/**
 * 查询当日累计费用，超过 80% 上限时告警。
 */
async function checkDailyCostAlert() {
  const date = todayStr();
  try {
    const res = await db.collection(COLLECTION_RECORDS)
      .where({ date })
      .get();

    let totalCost = 0;
    const records = res.data || [];
    for (const r of records) {
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
        message: `当日费用已达 ¥${totalCost.toFixed(4)}，超过告警阈值 ¥${alertThreshold}（上限 ¥${DAILY_COST_CAP_YUAN} 的 ${COST_ALERT_RATIO * 100}%）`,
      }));
    }
  } catch (err) {
    console.error('[arkProxy][quota] checkDailyCostAlert error:', err?.message || err);
  }
}

// ===== 输入校验 =====

function validatePrompt(prompt, isLyrics) {
  const maxLen = isLyrics ? MAX_PROMPT_LENGTH_LYRICS : MAX_PROMPT_LENGTH_EXPLAIN;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return 'prompt is required and must be non-empty';
  }
  if (prompt.length > maxLen) {
    return `prompt too long (${prompt.length} > ${maxLen})`;
  }
  return null;
}

function validateUserId(userId) {
  // CloudBase 匿名 UID 是 alphanumeric 字符串，长度通常 20-50
  if (!userId || typeof userId !== 'string') return null;
  if (userId.length > 100) return null; // 异常长度，丢弃
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) return null; // 非预期字符，丢弃
  return userId;
}

// ===== 火山引擎 API 调用 =====

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
    thinking: { type: 'disabled' },
    web_search: { enable: true },
  };
}

function extractChatAssistantText(result) {
  return (result?.choices?.[0]?.message?.content || '').trim();
}

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

// ===== 云函数入口 =====

exports.main = async function (event, context) {
  const { action, requestId, prompt, targetLanguage, interfaceLanguage, userId } = event;

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

  const isLyricsStep = action === 'lyrics.step2';

  // prompt 长度校验
  const promptError = validatePrompt(prompt, isLyricsStep);
  if (promptError) {
    return {
      ok: false,
      requestId: requestId || 'unknown',
      error: { code: 'INVALID_REQUEST', message: promptError, retryable: false },
    };
  }

  // 获取 Client IP
  const clientIp =
    (context && context.httpContext && context.httpContext.clientIp) ||
    (event && event.clientIp) ||
    'unknown';

  // 1. IP 级限流（第一道防线，内存）
  if (isRateLimited(clientIp)) {
    console.warn('[arkProxy] ip-rate-limited', `ip=${clientIp}`, `action=${action}`);
    return {
      ok: false,
      requestId: requestId || 'unknown',
      error: {
        code: 'RATE_LIMITED',
        message: `Too many requests (max ${RATE_MAX_PER_WINDOW} per ${RATE_WINDOW_MS}ms)`,
        retryable: true,
      },
    };
  }

  // 2. 用户级硬配额（第二道防线，NoSQL 持久化）
  const uid = validateUserId(userId);
  const actionType = isLyricsStep ? 'lyrics' : 'explain';

  if (uid) {
    const quota = await checkUserQuota(uid, actionType);
    if (!quota.allowed) {
      console.warn('[arkProxy] user-quota-exceeded', `uid=${uid.slice(0, 8)}...`, `action=${actionType}`, `limit=${quota.dailyLimit}`);
      // 记录一次被拒绝的调用（用于反滥用分析）
      void recordCall({
        uid,
        clientIp,
        action,
        model: isLyricsStep ? MODEL_ID_LYRICS : MODEL_ID_EXPLAIN,
        inputTokens: 0,
        outputTokens: 0,
        success: false,
        requestId: requestId || 'unknown',
      }).catch(() => {});
      return {
        ok: false,
        requestId: requestId || 'unknown',
        error: {
          code: 'RATE_LIMITED',
          message: `Daily quota exceeded (${quota.dailyLimit}/${actionType === 'explain' ? 'explain' : 'lyrics'} per day). Please try again tomorrow.`,
          retryable: false,
        },
      };
    }
    console.log('[arkProxy] quota-ok', `uid=${uid.slice(0, 8)}...`, `action=${actionType}`, `remaining=${quota.remaining}/${quota.dailyLimit}`);
  } else {
    // 无有效 UID：IP 限流已过，放行但日志告警
    console.warn('[arkProxy] no-valid-uid', `ip=${clientIp}`, `action=${action}`);
  }

  const model = isLyricsStep ? MODEL_ID_LYRICS : MODEL_ID_EXPLAIN;

  console.log(
    '[arkProxy] request',
    `requestId=${requestId}`,
    `action=${action}`,
    `model=${model}`,
    `lang=${targetLanguage}`,
    `iface=${interfaceLanguage}`,
    `promptLen=${prompt.length}`,
    `uid=${uid ? uid.slice(0, 8) + '...' : 'none'}`,
  );

  try {
    const chatParams = isLyricsStep
      ? buildLyricsChatRequest(prompt)
      : buildExplainChatRequest(prompt);
    const result = await callVolcengine(ARK_CHAT_URL, chatParams);
    const content = extractChatAssistantText(result);
    const usage = normalizeUsage(result);
    const resolvedModel = resolveModelId(result, model);

    // 记录成功调用（异步，不阻塞响应）
    void recordCall({
      uid: uid || 'unknown',
      clientIp,
      action,
      model: resolvedModel,
      inputTokens: usage?.inputTokens || 0,
      outputTokens: usage?.outputTokens || 0,
      success: true,
      requestId: requestId || 'unknown',
    }).catch(() => {});

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
    const errorObj = classifyError(err);
    // 记录失败调用
    void recordCall({
      uid: uid || 'unknown',
      clientIp,
      action,
      model,
      inputTokens: 0,
      outputTokens: 0,
      success: false,
      requestId: requestId || 'unknown',
    }).catch(() => {});

    console.error(
      '[arkProxy] error',
      `requestId=${requestId}`,
      `action=${action}`,
      `model=${model}`,
      `code=${errorObj.code}`,
      `message=${(err instanceof Error ? err.message : String(err)).slice(0, 200)}`,
    );

    return {
      ok: false,
      requestId,
      action,
      model,
      error: errorObj,
    };
  }
};
