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
const CLOUDBASE_ENV_ID = 'shufu-life-d8g9j8v5385543c1a';

/**
 * 云函数名称：arkProxy
 * 该函数负责接收前端请求 → 调用火山引擎 ARK API → 返回结果。
 */
const CLOUDBASE_FUNCTION_NAME = 'arkProxy';

/**
 * 请求超时时间（毫秒）。
 * Pro 模型偶发较慢；需配合云函数超时 ≥ 60s。
 */
const REQUEST_TIMEOUT_MS = 90_000;

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

async function callCloudFunction(
  name: string,
  data: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
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
        reject(err);
      });
  });
}

export const cloudbaseGateway: AiGateway = {
  async init(): Promise<void> {
    await ensureAuth();
  },

  async send(req: AiGatewayRequest, signal?: AbortSignal): Promise<AiGatewayResponse> {
    // 构建云函数兼容的请求体
    const cloudFuncData: ArkProxyRequest = {
      action: req.action,
      requestId: req.requestId,
      prompt: req.prompt,
      targetLanguage: req.targetLanguage,
      interfaceLanguage: req.interfaceLanguage,
    };

    const raw = (await callCloudFunction(
      CLOUDBASE_FUNCTION_NAME,
      cloudFuncData,
      signal,
    )) as ArkProxyResponse;

    return raw;
  },
};
