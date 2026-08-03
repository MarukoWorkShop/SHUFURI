import { useEffect, useState } from 'react';
import { readClipboardText } from '../utils/clipboard';
import {
  clipboardContentHash,
  getStructuredLyricsCardMeta,
  isStructuredLyricsClipboardText,
  prepareStructuredLyricsClipboardText,
} from '../utils/clipboardStructuredLyrics';

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
    if (!trimmed) {
      return EMPTY;
    }

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

/**
 * 监听剪贴板是否含可排版的结构化歌词，并带上流内歌名供主次 CTA 暗示。
 *
 * 仅在用户交互事件（窗口聚焦、页面可见性恢复、bfcache 恢复）时触发检测，
 * 不使用后台轮询，避免触发浏览器剪贴板权限限制导致的 NotAllowedError。
 */
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
    // 不在挂载时立即 check：此时无 user activation（用户未与页面交互），
    // navigator.clipboard.readText() 会抛 NotAllowedError，导致误报"权限被阻止"。

    return () => {
      cancelled = true;
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', check);
    };
  }, []);

  return state;
}

/** @deprecated 使用 useClipboardStructuredLyrics */
export function useClipboardHasContent(): boolean {
  return useClipboardStructuredLyrics().ready;
}
