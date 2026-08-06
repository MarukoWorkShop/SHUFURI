/**
 * MVP 阶段埋点服务
 *
 * 直接通过 CloudBase SDK 调用 aiFeedback 云函数上报事件，
 * 与 AI 调用解耦，不依赖 arkProxy 路由。
 *
 * 关键漏斗指标：
 *   UV   (page_view  : 每日独立访客数 = 去重 session_id 后的 page_view 数)
 *   AR   (first_ai   : 激活率 = 触发 first_ai_use 的 UV 数 / 总 UV)
 *   HR   (limit_hit  : 上瘾率 = 触发 ai_limit_hit 的 UV 数 / 总 UV)
 *   CR   (feedback   : 转化意愿率 = 提交 feedback_submitted 的 UV 数 / 触发 limit_hit 的 UV 数)
 *
 * 设计原则：
 *   - 不阻塞主流程：失败仅 console.warn
 *   - 去重：session_id 在 sessionStorage 中生成且持久
 *   - 首次激活：first_ai_use 全程只发送一次
 */
import cloudbase from '@cloudbase/js-sdk';

const CLOUDBASE_ENV_ID = 'ai-native-d5gtc59uc47601f23';
const FEEDBACK_FUNCTION_NAME = 'aiFeedback';

const SESSION_KEY = 'shufuri_session_id';
const FIRST_AI_KEY = 'shufuri_first_ai_done';

let app: cloudbase.app.App | null = null;
let auth: cloudbase.auth.App | null = null;

async function ensureAuth(): Promise<cloudbase.app.App> {
  if (!app) {
    app = cloudbase.init({ env: CLOUDBASE_ENV_ID });
  }
  if (!auth) {
    auth = app.auth({ persistence: 'local' });
  }
  const loginState = await auth.getLoginState();
  if (!loginState) {
    await auth.signInAnonymously();
  }
  return app;
}

/** 生成/读取会话 ID（每个浏览器会话一次） */
function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `srvless-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

/** 公共事件类型 */
export type AnalyticsEvent =
  | 'page_view'
  | 'first_ai_use'
  | 'ai_limit_hit'
  | 'feedback_wall_shown'
  | 'feedback_submitted'
  | 'feedback_wall_dismissed';

/**
 * 异步上报事件（不阻塞主流程）
 */
function report(event: AnalyticsEvent, extra: Record<string, unknown> = {}): void {
  // fire-and-forget
  void (async () => {
    try {
      const appInstance = await ensureAuth();
      await appInstance.callFunction({
        name: FEEDBACK_FUNCTION_NAME,
        data: {
          kind: 'event',
          event,
          sessionId: getSessionId(),
          timestamp: Date.now(),
          ...extra,
        },
      });
    } catch (err) {
      // 静默失败，绝不阻塞业务
      console.warn('[analytics] report failed:', event, err);
    }
  })();
}

/** 页面浏览 — 在 App mount 时调用一次 */
export function trackPageView(): void {
  report('page_view');
}

/** 第一次成功调用 AI — 全程仅触发一次 */
export function trackFirstAiUse(): void {
  try {
    if (sessionStorage.getItem(FIRST_AI_KEY)) return;
    sessionStorage.setItem(FIRST_AI_KEY, '1');
  } catch {
    // 仍上报一次（极端环境下可能出现重复，但仅本地影响）
  }
  report('first_ai_use');
}

/** AI 限额到达 — 触发反馈墙时调用 */
export function trackAiLimitHit(extra: Record<string, unknown> = {}): void {
  report('ai_limit_hit', extra);
}

/** 反馈墙展示时调用 */
export function trackFeedbackShown(extra: Record<string, unknown> = {}): void {
  report('feedback_wall_shown', extra);
}

/** 用户提交反馈 */
export function trackFeedbackSubmitted(extra: Record<string, unknown> = {}): void {
  report('feedback_submitted', extra);
}

/** 用户直接关闭反馈墙（未提交） */
export function trackFeedbackDismissed(extra: Record<string, unknown> = {}): void {
  report('feedback_wall_dismissed', extra);
}

/**
 * 提交反馈（与事件上报同走 aiFeedback 云函数）。
 * 服务端持久化到 NoSQL `ai_feedback` 集合。
 */
export interface SubmitFeedbackPayload {
  score: number; // 1-100
  text?: string; // 可选文本
  usageCount: number;
  limit: number;
}

export async function submitFeedback(
  payload: SubmitFeedbackPayload,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const appInstance = await ensureAuth();
    const res = await appInstance.callFunction({
      name: FEEDBACK_FUNCTION_NAME,
      data: {
        kind: 'feedback',
        sessionId: getSessionId(),
        timestamp: Date.now(),
        ...payload,
      },
    });
    return (res as any)?.result ?? { ok: true };
  } catch (err) {
    console.warn('[analytics] submitFeedback failed:', err);
    return { ok: false, message: String(err) };
  }
}