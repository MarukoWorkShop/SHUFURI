import { useEffect, useState } from 'react';
import { readClipboardText } from '../utils/clipboard';
import {
  clipboardContentHash,
  getStructuredLyricsCardMeta,
  isStructuredLyricsClipboardText,
  prepareStructuredLyricsClipboardText,
} from '../utils/clipboardStructuredLyrics';
import { onAppBecameActive } from '../utils/nativeBridge';

const POLL_MS = 1500;

export type ClipboardStructuredLyricsState = {
  /** 剪贴板含可排版流（完整记录流或含 V/G 的学习材料） */
  ready: boolean;
  /** 流内 H 歌名（解析不到则为空） */
  title: string;
  artist: string;
  hash: string;
};

const EMPTY: ClipboardStructuredLyricsState = {
  ready: false,
  title: '',
  artist: '',
  hash: '',
};

/** 完整记录流，或 Step2 学习材料（含 V/G）均可点亮「粘贴剪贴板歌词」主暗示 */
async function inspectClipboardStructuredLyrics(): Promise<ClipboardStructuredLyricsState> {
  try {
    const text = await readClipboardText();
    const trimmed = text.trim();
    if (!trimmed) return EMPTY;

    const cleaned = prepareStructuredLyricsClipboardText(trimmed);
    const isFull = isStructuredLyricsClipboardText(trimmed);
    const isStudyOnly = /(^|\n)[VG]\|/.test(cleaned);
    if (!isFull && !isStudyOnly) return EMPTY;

    const meta = isFull ? getStructuredLyricsCardMeta(trimmed) : null;
    return {
      ready: true,
      title: meta?.title?.trim() || '',
      artist: meta?.artist?.trim() || '',
      hash: clipboardContentHash(trimmed),
    };
  } catch {
    return EMPTY;
  }
}

/** 监听剪贴板是否含可排版的结构化歌词，并带上流内歌名供主次 CTA 暗示 */
export function useClipboardStructuredLyrics(): ClipboardStructuredLyricsState {
  const [state, setState] = useState<ClipboardStructuredLyricsState>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    const check = () => {
      void (async () => {
        if (cancelled) return;
        const next = await inspectClipboardStructuredLyrics();
        if (!cancelled) setState(next);
      })();
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
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

  return state;
}

/** @deprecated 使用 useClipboardStructuredLyrics */
export function useClipboardHasContent(): boolean {
  return useClipboardStructuredLyrics().ready;
}
