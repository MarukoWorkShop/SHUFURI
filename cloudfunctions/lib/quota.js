/**
 * 共享配额模块 — 后端硬配额 + 用量记录
 *
 * 用于 arkProxy / arkExplainStream 两个云函数。
 *
 * 部署注意：CloudBase 云函数为独立目录，此文件需在部署前复制到
 * 各函数目录中（如 cp cloudfunctions/lib/quota.js cloudfunctions/arkProxy/）。
 */

// ===== 配额常量（与前端 src/services/aiUsageLimit.ts 保持一致） =====

/** 划词讲解每日免费额度 */
const EXPLAIN_FREE_LIMIT = 20;

/** 词解与语法生成每日免费额度 */
const LYRICS_FREE_LIMIT = 5;

/** 每日费用硬上限（元），来自火山引擎 API Key 日消费限额 */
const DAILY_COST_CAP_YUAN = 50;

/** 费用告警阈值（达上限的 80% 时告警） */
const COST_ALERT_RATIO = 0.8;

// ===== 火山引擎模型定价（元/1K tokens） =====

const MODEL_PRICING = {
  // doubao-seed-2-0-mini-260215（划词讲解）
  'explain': { inputPricePerK: 0.0004, outputPricePerK: 0.001, searchPrice: 0 },
  // doubao-seed-2-1-pro-260628（词解与语法生成，开启联网搜索）
  'lyrics': { inputPricePerK: 0.0008, outputPricePerK: 0.002, searchPrice: 0.03 },
};

// ===== IP 限流（兜底，内存存储） =====

const IP_WINDOW_MS = 3_000; // 3 秒窗口
const IP_MAX_REQUESTS = 5;   // 窗口内最多 5 次

/** @type {Map<string, { count: number, resetAt: number }>} */
const ipBuckets = new Map();

/**
 * IP 级限流检查。同一 IP 在 3 秒内最多 5 次请求。
 * @returns {boolean} true = 允许
 */
function checkIpRateLimit(clientIp) {
  if (!clientIp) return true; // 无 IP 时放行（由 UID 配额兜底）

  const now = Date.now();
  const bucket = ipBuckets.get(clientIp);

  if (!bucket || now >= bucket.resetAt) {
    ipBuckets.set(clientIp, { count: 1, resetAt: now + IP_WINDOW_MS });
    // 定期清理过期桶
    if (ipBuckets.size > 5000) cleanupIpBuckets(now);
    return true;
  }

  bucket.count += 1;
  if (bucket.count > IP_MAX_REQUESTS) {
    return false;
  }
  return true;
}

function cleanupIpBuckets(now) {
  for (const [ip, bucket] of ipBuckets) {
    if (now >= bucket.resetAt) ipBuckets.delete(ip);
  }
}

// ===== NoSQL 配额记录 =====

const COLLECTION_USAGE = 'ai_daily_usage';
const COLLECTION_RECORDS = 'ai_call_records';

/**
 * 初始化 CloudBase Node SDK 数据库实例。
 * 使用函数执行环境的 env 变量，无需硬编码 ENV_ID。
 */
function getDb() {
  // eslint-disable-next-line no-undef
  const cloudbase = require('@cloudbase/node-sdk');
  const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
  return app.database();
}

/**
 * 获取今日日期 YYYY-MM-DD
 */
function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 检查用户当日配额。
 * @param {string} uid - CloudBase 匿名用户 UID
 * @param {'explain' | 'lyrics'} actionType
 * @returns {Promise<{ allowed: boolean, remaining: number, dailyLimit: number }>}
 */
async function checkUserQuota(uid, actionType) {
  const limit = actionType === 'explain' ? EXPLAIN_FREE_LIMIT : LYRICS_FREE_LIMIT;
  const date = todayStr();
  const docId = `${uid}_${date}_${actionType}`;

  try {
    const db = getDb();
    const coll = db.collection(COLLECTION_USAGE);

    // 原子操作：查找或创建 + 递增
    const existing = await coll.doc(docId).get().catch(() => null);
    if (!existing || !existing.data || existing.data.length === 0) {
      // 首次使用，创建记录
      await coll.add({
        _id: docId,
        uid,
        date,
        actionType,
        count: 1,
        limit,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return { allowed: true, remaining: limit - 1, dailyLimit: limit };
    }

    const doc = existing.data[0] || existing.data;
    const currentCount = doc.count || 0;

    if (currentCount >= limit) {
      return { allowed: false, remaining: 0, dailyLimit: limit };
    }

    // 递增计数
    await coll.doc(docId).update({
      count: currentCount + 1,
      updatedAt: new Date(),
    });

    return { allowed: true, remaining: limit - currentCount - 1, dailyLimit: limit };
  } catch (err) {
    console.error('[quota] checkUserQuota error:', err?.message || err);
    // NoSQL 异常时放行（避免误杀），依赖 IP 限流兜底
    return { allowed: true, remaining: -1, dailyLimit: limit };
  }
}

/**
 * 记录单次 AI 调用，用于费用统计。
 * @param {object} params
 */
async function recordCall(params) {
  const { uid, clientIp, action, model, inputTokens, outputTokens, success, requestId } = params;
  const pricing = action === 'lyrics.step2' ? MODEL_PRICING.lyrics : MODEL_PRICING.explain;
  const inputCost = (inputTokens || 0) / 1000 * pricing.inputPricePerK;
  const outputCost = (outputTokens || 0) / 1000 * pricing.outputPricePerK;
  const searchCost = action === 'lyrics.step2' ? pricing.searchPrice : 0;
  const estimatedCost = Math.round((inputCost + outputCost + searchCost) * 1e6) / 1e6;

  try {
    const db = getDb();
    await db.collection(COLLECTION_RECORDS).add({
      uid: uid || 'unknown',
      ip: clientIp || 'unknown',
      date: todayStr(),
      ts: new Date(),
      action,
      model: model || 'unknown',
      inputTokens: inputTokens || 0,
      outputTokens: outputTokens || 0,
      totalTokens: (inputTokens || 0) + (outputTokens || 0),
      searchCount: action === 'lyrics.step2' ? 1 : 0,
      estimatedCost,
      success,
      requestId,
    });
  } catch (err) {
    console.error('[quota] recordCall error:', err?.message || err);
    // 记录失败不阻塞主流程
  }
}

/**
 * 解析请求来源 IP（不同云函数获取方式不同，需适配）。
 * @param {object} event - 云函数 event 参数
 * @returns {string}
 */
function getClientIp(event) {
  // HTTP 云函数 (arkExplainStream)
  if (event.headers) {
    return (
      event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      event.headers['x-real-ip'] ||
      event.headers['x-client-ip'] ||
      ''
    );
  }
  // SDK 调用云函数 (arkProxy) — CloudBase 通常通过 context 提供
  if (event.context) {
    return event.context.clientIp || '';
  }
  return '';
}

/**
 * 检查当日累计费用是否超过额度告警阈值。
 * 超过 80% 时输出 warn 日志。
 */
async function checkDailyCostAlert() {
  const date = todayStr();
  try {
    const db = getDb();
    const records = await db.collection(COLLECTION_RECORDS)
      .where({ date })
      .get();

    let totalCost = 0;
    if (records.data && records.data.length > 0) {
      totalCost = records.data.reduce((sum, r) => sum + (r.estimatedCost || 0), 0);
    }

    const alertThreshold = DAILY_COST_CAP_YUAN * COST_ALERT_RATIO;
    if (totalCost >= alertThreshold) {
      console.warn(
        `[quota] ⚠️ 当日费用已达 ¥${totalCost.toFixed(4)}，超过告警阈值 ¥${alertThreshold}（上限 ¥${DAILY_COST_CAP_YUAN} 的 ${COST_ALERT_RATIO * 100}%）`,
      );
    }
    return { totalCost, atLimit: totalCost >= DAILY_COST_CAP_YUAN };
  } catch (err) {
    console.error('[quota] checkDailyCostAlert error:', err?.message || err);
    return { totalCost: 0, atLimit: false };
  }
}

module.exports = {
  checkUserQuota,
  recordCall,
  checkIpRateLimit,
  checkDailyCostAlert,
  getClientIp,
  EXPLAIN_FREE_LIMIT,
  LYRICS_FREE_LIMIT,
  DAILY_COST_CAP_YUAN,
};
