import {
  isNativeWebView,
  postClipboardWrite,
} from './nativeBridge';

async function writeWithDomFallback(text: string): Promise<void> {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    const ok = document.execCommand('copy');
    if (!ok) {
      throw new Error('无法写入剪贴板');
    }
  } finally {
    document.removeChild(textarea);
  }
}

export async function writeClipboardText(text: string): Promise<void> {
  // Capacitor 原生环境通过插件写入
  if (isNativeWebView()) {
    await postClipboardWrite(text);
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document !== 'undefined') {
    await writeWithDomFallback(text);
    return;
  }

  throw new Error('当前环境不支持剪贴板写入');
}

/**
 * 当剪贴板读取因权限被静默阻止而失败时，派发此事件。
 * 上层可监听该事件来展示 fallback 提示。
 */
export const CLIPBOARD_BLOCKED_EVENT = 'clipboard:blocked';

export async function readClipboardText(): Promise<string> {
  try {
    return await navigator.clipboard.readText();
  } catch (err: any) {
    // NotAllowedError：用户拒绝了权限，或被浏览器静默阻止（多次拒绝后自动拦截）
    if (err?.name === 'NotAllowedError') {
      window.dispatchEvent(new CustomEvent(CLIPBOARD_BLOCKED_EVENT));
    }
    throw err;
  }
}
