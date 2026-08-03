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
 *
 * **不应在被动自动检测中触发**：仅在用户显式点击按钮触发 readClipboardText 时
 * 调用 `dispatchClipboardBlockedEvent`。W3C 规范要求 `readText()` 必须在 user
 * activation（用户激活态）内执行；页面挂载/窗口聚焦时无激活态，浏览器即使在用户
 * 已授权的情况下也会抛 NotAllowedError，若此时弹"请允许权限"的提示会误导用户。
 */
export const CLIPBOARD_BLOCKED_EVENT = 'clipboard:blocked';

/** 由用户手势上下文（如点击"粘贴剪贴板歌词"按钮）的调用方手动派发。 */
export function dispatchClipboardBlockedEvent(): void {
  window.dispatchEvent(new CustomEvent(CLIPBOARD_BLOCKED_EVENT));
}

export async function readClipboardText(): Promise<string> {
  // 不在此处自动派发 CLIPBOARD_BLOCKED_EVENT：调用方可能是被动自动检测
  // （focus/visibilitychange/pageshow），此时无 user activation，浏览器抛
  // NotAllowedError 是正常行为，不应误报"权限被阻止"。
  // 仅在用户显式手势（如点击按钮）的 catch 块中由调用方决定是否派发。
  return await navigator.clipboard.readText();
}
