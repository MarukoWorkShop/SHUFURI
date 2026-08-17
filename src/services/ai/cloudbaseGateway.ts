import { ensureCloudbaseApp } from '../cloudbaseClient';
import type {
  AiGateway,
  AiGatewayRequest,
  AiGatewayResponse,
  ArkProxyRequest,
  ArkProxyResponse,
} from './types';

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

/**
 * 获取当前 CloudBase 匿名用户 UID，用于后端硬配额校验。
 * 获取失败返回 undefined（不阻塞主流程，由 IP 限流兜底）。
 */
export async function getCloudbaseUserId(): Promise<string | undefined> {
  try {
    const app = await ensureCloudbaseApp();
    const auth = app.auth({ persistence: 'local' });
    const loginState = await auth.getLoginState();
    if (loginState) {
      return (loginState as { user?: { uid?: string }; uid?: string }).user?.uid
        || (loginState as { uid?: string }).uid;
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
  const app = await ensureCloudbaseApp();

  return new Promise((resolve, reject) => {
    let settled = false;

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

    app
      .callFunction({ name, data })
      .then((res: { result?: unknown }) => {
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
    await ensureCloudbaseApp();
  },

  async send(req: AiGatewayRequest, signal?: AbortSignal): Promise<AiGatewayResponse> {
    const userId = await getCloudbaseUserId();

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
