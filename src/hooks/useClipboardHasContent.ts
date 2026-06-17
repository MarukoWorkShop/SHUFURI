import { useEffect, useState } from 'react';
import { readClipboardText } from '../utils/clipboard';
import { isStructuredLyricsClipboardText } from '../utils/clipboardStructuredLyrics';
import { onAppBecameActive } from '../utils/nativeBridge';

const POLL_MS = 1500;

async function clipboardHasStructuredLyrics(): Promise<boolean> {
  try {
    const text = await readClipboardText();
    return isStructuredLyricsClipboardText(text);
  } catch {
    return false;
  }
}

/** 监听剪贴板是否含可排版的结构化歌词 */
export function useClipboardStructuredLyrics(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = () => {
      void (async () => {
        if (cancelled) {
          return;
        }
        const has = await clipboardHasStructuredLyrics();
        if (!cancelled) {
          setReady(has);
        }
      })();
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        check();
      }
    };

    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', check);
    const unsubscribeForeground = onAppBecameActive(check);
    const pollTimer = window.setInterval(check, POLL_MS);
    check();

    return () => {
      cancelled = true;
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', check);
      unsubscribeForeground();
      window.clearInterval(pollTimer);
    };
  }, []);

  return ready;
}

/** @deprecated 使用 useClipboardStructuredLyrics */
export function useClipboardHasContent(): boolean {
  return useClipboardStructuredLyrics();
}
