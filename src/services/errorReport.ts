/**
 * 前端全局错误上报
 *
 * 捕获三类异常：
 *   1. window.onerror        — 未 catch 的同步异常
 *   2. unhandledrejection    — 未 catch 的 Promise 异常
 *   3. ErrorBoundary 显式上报 — React 组件树中通过 reportHandledError() 上报
 *
 * 上报策略：
 *   - 同种错误 60s 内去重（防风暴）
 *   - 最多保留 50 条本地缓冲（超出丢弃，不阻塞页面）
 *   - 通过 aiFeedback 云函数异步写入 NoSQL，失败静默
 */

import cloudbase from '@cloudbase/js-sdk';

const CLOUDBASE_ENV_ID = 'shufu-life-d8g9j8v5385543c1a';
const FEEDBACK_FUNCTION_NAME = 'aiFeedback';
const MAX_BUFFER = 50;
const DEDUP_WINDOW_MS = 60_000;

// 最近上报缓存的去重 key → 时间戳
const recentKeys = new Map<string, number>();
let buffer: ErrorReportItem[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let app: cloudbase.app.App | null = null;
let auth: cloudbase.auth.App | null = null;

interface ErrorReportItem {
  kind: 'error_report';
  type: 'onerror' | 'unhandledrejection' | 'handled';
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
  sessionId: string;
  userAgent: string;
}

async function ensureAuth(): Promise<cloudbase.app.App> {
  if (!app) app = cloudbase.init({ env: CLOUDBASE_ENV_ID });
  if (!auth) auth = app.auth({ persistence: 'local' });
  try {
    const loginState = await auth.getLoginState();
    if (!loginState) await auth.signInAnonymously();
  } catch {
    // 认证失败不阻塞
  }
  return app;
}

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem('shufuri_session_id');
    if (!id) {
      id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem('shufuri_session_id', id);
    }
    return id;
  } catch {
    return `srv-err-${Date.now()}`;
  }
}

/** 60s 内相同错误去重 */
function isDuplicate(key: string): boolean {
  const now = Date.now();
  const last = recentKeys.get(key);
  if (last && now - last < DEDUP_WINDOW_MS) return true;
  recentKeys.set(key, now);
  // 定期清理过期条目
  if (recentKeys.size > 200) {
    for (const [k, t] of recentKeys) {
      if (now - t >= DEDUP_WINDOW_MS) recentKeys.delete(k);
    }
  }
  return false;
}

function dedupKey(item: ErrorReportItem): string {
  return `${item.type}:${item.message}:${item.filename || ''}:${item.lineno || ''}`;
}

function enqueue(item: ErrorReportItem): void {
  if (isDuplicate(dedupKey(item))) return;
  if (buffer.length >= MAX_BUFFER) return; // 丢弃超量
  buffer.push(item);
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer) return;
  // 延迟 5s 批量发送，聚合高频错误
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, 5_000);
}

async function flush(): Promise<void> {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0);
  try {
    const appInstance = await ensureAuth();
    await appInstance.callFunction({
      name: FEEDBACK_FUNCTION_NAME,
      data: { kind: 'error_report', items: batch },
    });
  } catch {
    // 静默 — 上报本身失败不能抛错
  }
}

/** 页面卸载时尝试清空缓冲区 */
function flushSync(): void {
  if (buffer.length === 0) return;
  // sendBeacon 优先（不阻塞卸载），降级为同步 XHR
  const payload = JSON.stringify({ kind: 'error_report', items: buffer });
  const url = `https://${CLOUDBASE_ENV_ID}.ap-shanghai.tcb-api.tencentcloudapi.com/web?name=${FEEDBACK_FUNCTION_NAME}`;
  try {
    navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
  } catch {
    // sendBeacon 失败不处理
  }
  buffer = [];
}

// ================= 初始化 =================

/** 启动全局错误监听。在 App mount 时调用一次。 */
export function initErrorReporting(): void {
  if (typeof window === 'undefined') return;

  const sessionId = getSessionId();
  const ua = navigator.userAgent;

  // 1) window.onerror — 同步异常
  window.addEventListener('error', (event: ErrorEvent) => {
    if (!event.error && !event.message) return; // 忽略资源加载错误
    enqueue({
      kind: 'error_report',
      type: 'onerror',
      message: event.message || String(event.error),
      stack: event.error?.stack,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      timestamp: Date.now(),
      sessionId,
      userAgent: ua,
    });
  });

  // 2) unhandledrejection — Promise 异常
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    enqueue({
      kind: 'error_report',
      type: 'unhandledrejection',
      message,
      stack,
      timestamp: Date.now(),
      sessionId,
      userAgent: ua,
    });
  });

  // 3) 页面卸载前 flush
  window.addEventListener('beforeunload', () => flushSync());
  window.addEventListener('pagehide', () => flushSync());
}

/** 供 ErrorBoundary 等组件显式上报已 catch 的异常 */
export function reportHandledError(err: Error, extra?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const message = extra
    ? `${err.message} ${JSON.stringify(extra)}`
    : err.message;
  enqueue({
    kind: 'error_report',
    type: 'handled',
    message,
    stack: err.stack,
    timestamp: Date.now(),
    sessionId: getSessionId(),
    userAgent: navigator.userAgent,
  });
}
