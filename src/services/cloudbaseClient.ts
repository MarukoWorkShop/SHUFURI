/**
 * CloudBase 单例：动态 import SDK，避免首屏主包打进 ~500KB+ 的 @cloudbase/js-sdk。
 * analytics / errorReport / cloudbaseGateway 共用此入口。
 */

const CLOUDBASE_ENV_ID = 'ai-native-d5gtc59uc47601f23';

// SDK 无稳定 default 类型导出；用实例推断即可
type CloudbaseApp = {
  auth: (opts: { persistence: string }) => {
    getLoginState: () => Promise<unknown>;
    signInAnonymously: () => Promise<unknown>;
  };
  callFunction: (opts: { name: string; data: Record<string, unknown> }) => Promise<{ result?: unknown }>;
};

let app: CloudbaseApp | null = null;
let ready: Promise<CloudbaseApp> | null = null;

export async function ensureCloudbaseApp(): Promise<CloudbaseApp> {
  if (app) return app;
  if (ready) return ready;

  ready = (async () => {
    const mod = await import('@cloudbase/js-sdk');
    const cloudbase = (mod as { default?: { init: (o: { env: string }) => CloudbaseApp } }).default
      ?? (mod as unknown as { init: (o: { env: string }) => CloudbaseApp });
    const instance = cloudbase.init({ env: CLOUDBASE_ENV_ID });
    const auth = instance.auth({ persistence: 'local' });
    try {
      const loginState = await auth.getLoginState();
      if (!loginState) {
        await auth.signInAnonymously();
      }
    } catch {
      // 认证失败不阻塞调用方（埋点/报错静默；AI 网关会再抛错）
    }
    app = instance;
    return instance;
  })();

  return ready;
}

export { CLOUDBASE_ENV_ID };
