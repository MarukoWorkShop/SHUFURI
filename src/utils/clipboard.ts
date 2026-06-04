import { isNativeWebView, postClipboardRead, postClipboardWrite } from './nativeBridge';

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
    document.body.removeChild(textarea);
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

export async function readClipboardText(): Promise<string> {
  // Capacitor 原生环境通过插件读取
  if (isNativeWebView()) {
    return postClipboardRead();
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
    return navigator.clipboard.readText();
  }

  throw new Error('当前环境不支持剪贴板读取');
}
