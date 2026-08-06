import cloudbase from '@cloudbase/js-sdk';
import type {
  AiGateway,
  AiGatewayRequest,
  AiGatewayResponse,
  ArkProxyRequest,
  ArkProxyResponse,
} from './types';

/**
 * CloudBase 环境 ID。
 * 从腾讯云 CloudBase 控制台获取，当前为设计文档记录值。
 */
const CLOUDBASE_ENV_ID = 'ai-native-d5gtc59uc47601f23';

/**
 * 云函数名称：arkProxy
 * 该函数负责接收前端请求 → 调用火山引擎 ARK API → 返回结果。
 */
const CLOUDBASE_FUNCTION_NAME = 'arkProxy';

/**
 * 请求超时时间（毫秒）。
 * Pro + 词解生成偶发较慢；需配合云函数超时 ≥ 180s。
 */
const REQUEST_TIMEOUT_MS = 190_000;

let app: cloudbase.app.App | null = null;
let auth: cloudbase.auth.App | null = null;

async function ensureAuth(): Promise<void> {
  if (!app) {
    app = cloudbase.init({ env: CLOUDBASE_ENV_ID });
  }
  if (!auth) {
    auth = app.auth({ persistence: 'local' });
  }

  const loginState = await auth.getLoginState();
  if (loginState) return; // 已登录

  // 匿名登录
  await auth.signInAnonymously();
}

/**
 * 获取当前 CloudBase 匿名用户 UID，用于后端硬配额校验。
 * 获取失败返回 undefined（不阻塞主流程，由 IP 限流兜底）。
 */
export async function getCloudbaseUserId(): Promise<string | undefined> {
  try {
    await ensureAuth();
    const loginState = await auth!.getLoginState();
    if (loginState) {
      return (loginState as any).user?.uid || (loginState as any).uid;
    }
  } catch {
    // 静默
  }
  return undefined;
}

/** 把 CloudBase / 网关抛出的非 Error 对象转成可读 Error（避免 UI 只显示「网络错误」） */
export function formatCloudFunctionError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; code?: unknown; msg?: unknown };
    const code = typeof e.code === 'string' || typeof e.code === 'number' ? String(e.code) : '';
    const msg =
      (typeof e.message === 'string' && e.message) ||
      (typeof e.msg === 'string' && e.msg) ||
      '';
    if (code || msg) {
      const text = [code, msg].filter(Boolean).join(': ');
      // 云函数超时在 SCF 侧常见为 -1 / timeout / Task timed out
      if (/timeout|timed?\s*out|-504|504/i.test(text)) {
        return new Error('云函数超时，词解生成时间较长，请稍后重试');
      }
      return new Error(text);
    }
  }
  if (typeof err === 'string' && err.trim()) return new Error(err);
  return new Error('网络错误，请稍后重试');
}

async function callCloudFunction(
  name: string,
  data: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  // 调用前确保匿名登录；否则 callFunction 常以非 Error 对象失败
  await ensureAuth();
  if (!app) {
    app = cloudbase.init({ env: CLOUDBASE_ENV_ID });
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    // AbortController 超时/取消
    const onAbort = () => {
      if (settled) return;
      settled = true;
      reject(new DOMException('请求已取消或超时', 'AbortError'));
    };

    const timer = setTimeout(() => {
      onAbort();
    }, REQUEST_TIMEOUT_MS);

    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        onAbort();
        return;
      }
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        onAbort();
      }, { once: true });
    }

    app!
      .callFunction({ name, data })
      .then((res: any) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(res.result ?? res);
      })
      .catch((err: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(formatCloudFunctionError(err));
      });
  });
}

export const cloudbaseGateway: AiGateway = {
  async init(): Promise<void> {
    await ensureAuth();
  },

  async send(req: AiGatewayRequest, signal?: AbortSignal): Promise<AiGatewayResponse> {
    // 获取 CloudBase 匿名用户 UID，用于后端硬配额校验
    const userId = await getCloudbaseUserId();

    // 构建云函数兼容的请求体
    const cloudFuncData: ArkProxyRequest = {
      action: req.action,
      requestId: req.requestId,
      prompt: req.prompt,
      targetLanguage: req.targetLanguage,
      interfaceLanguage: req.interfaceLanguage,
      userId,
      title: req.title,
      artist: req.artist,
    };

    const raw = (await callCloudFunction(
      CLOUDBASE_FUNCTION_NAME,
      cloudFuncData,
      signal,
    )) as ArkProxyResponse;

    return raw;
  },
};
