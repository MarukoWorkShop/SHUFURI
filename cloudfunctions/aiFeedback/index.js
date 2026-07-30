/**
 * 云函数 aiFeedback
 *
 * 双功能：
 *   1. kind=feedback  → 写入 NoSQL `ai_feedback` 集合（用户反馈）
 *   2. kind=event     → 写入 NoSQL `app_events` 集合（行为埋点）
 *
 * 安全：
 *   - prompt-style 字段（text）长度上限 1000 字符
 *   - score 必须 1-100
 *   - 同 IP 每 5 秒最多 10 次（轻量防护）
 *   - 所有字段经过类型 / 范围校验
 */
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
});
const db = app.database();

/* ===== 安全配置 ===== */
const MAX_TEXT_LENGTH = 1000;
const MIN_SCORE = 1;
const MAX_SCORE = 100;
const RATE_WINDOW_MS = 5_000;
const RATE_MAX_PER_WINDOW = 10;
const ALLOWED_KINDS = new Set(['feedback', 'event', 'error_report']);

const _rateBuckets = new Map();
let _rateCleanup = 0;

function isRateLimited(ip) {
  const now = Date.now();
  if (now - _rateCleanup > 60_000) {
    _rateCleanup = now;
    const cutoff = now - RATE_WINDOW_MS * 2;
    for (const [k, t] of _rateBuckets) {
      if (t < cutoff) _rateBuckets.delete(k);
    }
  }
  const last = _rateBuckets.get(ip) || 0;
  if (now - last < Math.ceil(RATE_WINDOW_MS / RATE_MAX_PER_WINDOW)) {
    return true;
  }
  _rateBuckets.set(ip, now);
  return false;
}

function getClientIp(event, context) {
  return (
    (context && context.httpContext && context.httpContext.clientIp) ||
    (event && event.clientIp) ||
    (event && event.requestContext && event.requestContext.http && event.requestContext.http.sourceIp) ||
    (event && event.headers && (event.headers['x-forwarded-for'] || '').split(',')[0]?.trim()) ||
    'unknown'
  );
}

function validateFeedback(payload) {
  const { score, text, sessionId, timestamp } = payload;
  if (typeof score !== 'number' || score < MIN_SCORE || score > MAX_SCORE) {
    return `score must be a number in [${MIN_SCORE}, ${MAX_SCORE}]`;
  }
  if (text !== undefined && text !== null && typeof text !== 'string') {
    return 'text must be a string if provided';
  }
  if (typeof text === 'string' && text.length > MAX_TEXT_LENGTH) {
    return `text too long (${text.length} > ${MAX_TEXT_LENGTH})`;
  }
  if (typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > 128) {
    return 'sessionId must be a non-empty string ≤128 chars';
  }
  if (typeof timestamp !== 'number' || timestamp <= 0) {
    return 'timestamp must be a positive number';
  }
  return null;
}

function validateEvent(payload) {
  const { event: eventName, sessionId, timestamp } = payload;
  if (typeof eventName !== 'string' || eventName.length === 0 || eventName.length > 64) {
    return 'event must be a non-empty string ≤64 chars';
  }
  if (typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > 128) {
    return 'sessionId must be a non-empty string ≤128 chars';
  }
  if (typeof timestamp !== 'number' || timestamp <= 0) {
    return 'timestamp must be a positive number';
  }
  // 防止任意写入：白名单事件类型
  const ALLOWED_EVENTS = new Set([
    'page_view',
    'first_ai_use',
    'ai_limit_hit',
    'feedback_wall_shown',
    'feedback_submitted',
    'feedback_wall_dismissed',
  ]);
  if (!ALLOWED_EVENTS.has(eventName)) {
    return `unknown event type: ${eventName}`;
  }
  return null;
}

function tryAdd(collectionName, doc) {
  return db
    .collection(collectionName)
    .add({
      ...doc,
      _openid: '', // 匿名访问
      serverTime: Date.now(),
    })
    .then(() => true)
    .catch((err) => {
      console.error(`[aiFeedback] ${collectionName}.add failed:`, err);
      return false;
    });
}

exports.main = async function (event, context) {
  const { kind } = event;
  const clientIp = getClientIp(event, context);

  if (!ALLOWED_KINDS.has(kind)) {
    return {
      ok: false,
      code: 'INVALID_REQUEST',
      message: `Unknown kind: ${kind}`,
    };
  }

  if (isRateLimited(clientIp)) {
    return {
      ok: false,
      code: 'RATE_LIMITED',
      message: `Too many requests (max ${RATE_MAX_PER_WINDOW} per ${RATE_WINDOW_MS}ms)`,
      retryable: true,
    };
  }

  if (kind === 'feedback') {
    const err = validateFeedback(event);
    if (err) {
      return { ok: false, code: 'INVALID_REQUEST', message: err };
    }

    const doc = {
      score: event.score,
      text: typeof event.text === 'string' ? event.text.trim() : '',
      sessionId: event.sessionId,
      clientTs: event.timestamp,
      usageCount: typeof event.usageCount === 'number' ? event.usageCount : null,
      limit: typeof event.limit === 'number' ? event.limit : null,
    };

    const added = await tryAdd('ai_feedback', doc);
    if (!added) {
      return {
        ok: false,
        code: 'STORAGE_FAILED',
        message: 'Failed to persist feedback',
        retryable: true,
      };
    }

    return {
      ok: true,
      message: '感谢您的反馈',
      bonusGranted: 50,
    };
  }

  if (kind === 'event') {
    const err = validateEvent(event);
    if (err) {
      return { ok: false, code: 'INVALID_REQUEST', message: err };
    }

    const doc = {
      event: event.event,
      sessionId: event.sessionId,
      clientTs: event.timestamp,
      // 透传的可选附加字段（白名单 + 数值类型）
      count: typeof event.count === 'number' ? event.count : undefined,
      limit: typeof event.limit === 'number' ? event.limit : undefined,
      score: typeof event.score === 'number' ? event.score : undefined,
      hasText: typeof event.hasText === 'boolean' ? event.hasText : undefined,
      ok: typeof event.ok === 'boolean' ? event.ok : undefined,
    };

    // 静默失败：埋点失败不影响业务
    await tryAdd('app_events', doc);
    return { ok: true };
  }

  // ====== error_report：前端全局异常批量上报 ======
  if (kind === 'error_report') {
    const { items } = event;
    if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
      return { ok: false, code: 'INVALID_REQUEST', message: 'items must be a non-empty array ≤20' };
    }

    const now = Date.now();
    let saved = 0;

    for (const item of items) {
      if (!item || typeof item.message !== 'string' || item.message.length > 2000) continue;
      if (!['onerror', 'unhandledrejection', 'handled'].includes(item.type)) continue;

      await tryAdd('error_reports', {
        type: item.type,
        message: item.message.slice(0, 2000),
        stack: typeof item.stack === 'string' ? item.stack.slice(0, 4000) : undefined,
        filename: typeof item.filename === 'string' ? item.filename.slice(0, 1024) : undefined,
        lineno: typeof item.lineno === 'number' ? item.lineno : undefined,
        colno: typeof item.colno === 'number' ? item.colno : undefined,
        clientTs: item.timestamp || now,
        sessionId: typeof item.sessionId === 'string' ? item.sessionId.slice(0, 128) : undefined,
        userAgent: typeof item.userAgent === 'string' ? item.userAgent.slice(0, 512) : undefined,
      });

      saved++;
    }

    return { ok: true, saved };
  }
};