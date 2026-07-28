import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { readClipboardText } from '../utils/clipboard';
import {
  clipboardContentHash,
  isStructuredLyricsClipboardText,
} from '../utils/clipboardStructuredLyrics';
import { parseMusicShareFromClipboard } from '../utils/parseMusicShareFromClipboard';
import { isNativeWebView } from '../utils/nativeBridge';
import type { LyricsLanguage } from '../services/appSettings';
import { saveAppSettings, type AppSettings } from '../services/appSettings';

type ShareOcrData = {
  title: string;
  artist: string;
  detectedLanguage?: 'jp' | 'ko' | 'zh' | 'mixed' | 'unknown';
};

type Options = {
  setShareOcrData: Dispatch<SetStateAction<ShareOcrData | null>>;
  setAppSettings: Dispatch<SetStateAction<AppSettings>>;
  onMusicShareStored: (data: ShareOcrData) => void;
  prevClipboardHashRef: RefObject<string>;
  consumedClipboardRef: RefObject<Set<string>>;
  /** 可选 toast 回调，提供则在检测到时弹提示 */
  showToast?: (message: string) => void;
};

const POLL_MS = 1500;

/**
 * 桌面浏览器：轮询剪贴板，自动检测 QQ 音乐 / 网易云音乐分享链接，
 * 并在识别到歌名/歌手时自动填入表单。
 *
 * 依赖 Apple Universal Clipboard（iPhone → Mac）将手机剪贴板同步到 Mac。
 * 仅在非原生 WebView 环境（桌面浏览器）生效，与 useClipboardDetection 互补。
 */
export function useDesktopMusicShareDetection({
  setShareOcrData,
  setAppSettings,
  onMusicShareStored,
  prevClipboardHashRef,
  consumedClipboardRef,
  showToast,
}: Options): void {
  // 用 ref 持有最新回调，避免 effect 重跑
  const setShareOcrDataRef = useRef(setShareOcrData);
  setShareOcrDataRef.current = setShareOcrData;
  const setAppSettingsRef = useRef(setAppSettings);
  setAppSettingsRef.current = setAppSettings;
  const onMusicShareStoredRef = useRef(onMusicShareStored);
  onMusicShareStoredRef.current = onMusicShareStored;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  useEffect(() => {
    // 仅在桌面浏览器运行，原生 WebView 由 useClipboardDetection 处理
    if (isNativeWebView()) return;

    let cancelled = false;

    const check = async () => {
      if (cancelled) return;
      try {
        const text = await readClipboardText();
        const trimmed = text.trim();
        if (!trimmed) return;

        // 结构化歌词走另一条 CTA，避免两条链路搅在一起
        if (isStructuredLyricsClipboardText(trimmed) || /(^|\n)[VG]\|/.test(trimmed)) return;

        const hash = clipboardContentHash(trimmed);
        if (hash === prevClipboardHashRef.current) return;
        if (consumedClipboardRef.current.has(hash)) return;

        const musicShare = parseMusicShareFromClipboard(trimmed);
        if (!musicShare?.title) return;

        console.log('[DesktopClipboard] 检测到音乐分享链接:', musicShare.title, musicShare.artist);
        prevClipboardHashRef.current = hash;

        const shareData: ShareOcrData = {
          title: musicShare.title,
          artist: musicShare.artist,
          detectedLanguage: musicShare.detectedLanguage,
        };
        onMusicShareStoredRef.current(shareData);
        setShareOcrDataRef.current((prev) => ({
          ...(prev ?? { title: '', artist: '' }),
          ...shareData,
        }));

        const detectedLang = musicShare.detectedLanguage;
        if (detectedLang === 'jp' || detectedLang === 'ko') {
          setAppSettingsRef.current((prev) => ({
            ...prev,
            lyricsLanguage: detectedLang as LyricsLanguage,
          }));
          saveAppSettings({ lyricsLanguage: detectedLang });
        }

        const artistPart = musicShare.artist ? ` · ${musicShare.artist}` : '';
        showToastRef.current?.(`已填入歌名：${musicShare.title}${artistPart}`);
      } catch {
        // 剪贴板读取失败（权限未授予 / 非安全上下文等），静默忽略
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    // 多种触发时机：聚焦、页面可见、从 bfcache 恢复、定时轮询
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', check);
    const pollTimer = window.setInterval(check, POLL_MS);
    check();

    return () => {
      cancelled = true;
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', check);
      window.clearInterval(pollTimer);
    };
  }, [consumedClipboardRef, prevClipboardHashRef]);
}
