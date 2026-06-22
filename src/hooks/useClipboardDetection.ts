import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { hapticSuccess } from './useHaptics';
import {
  onAppBecameActive,
  isNativeWebView,
  postClipboardRead,
} from '../utils/nativeBridge';
import {
  clipboardContentHash,
  isStructuredLyricsClipboardText,
} from '../utils/clipboardStructuredLyrics';
import { parseMusicShareFromClipboard } from '../utils/parseMusicShareFromClipboard';
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
  onStructuredLyrics: (text: string) => boolean;
  consumedClipboardRef: RefObject<Set<string>>;
  prevClipboardHashRef: RefObject<string>;
};

/**
 * 原生 WebView：App 回到前台时读取剪贴板（音乐链接预填 / 结构化歌词弹卡）。
 * 仅在挂载此 hook 的组件存活期间运行（HomeScreen）。
 */
export function useClipboardDetection({
  setShareOcrData,
  setAppSettings,
  onMusicShareStored,
  onStructuredLyrics,
  consumedClipboardRef,
  prevClipboardHashRef,
}: Options): void {
  const onStructuredLyricsRef = useRef(onStructuredLyrics);
  onStructuredLyricsRef.current = onStructuredLyrics;

  useEffect(() => {
    if (!isNativeWebView()) return;

    const tryReadClipboard = async (attempt: number): Promise<void> => {
      try {
        const text = await postClipboardRead();
        if (!text) {
          if (attempt < 2) {
            const delays = [600, 1400];
            setTimeout(() => { void tryReadClipboard(attempt + 1); }, delays[attempt]!);
          }
          return;
        }

        const trimmed = text.trim();
        const hash = clipboardContentHash(trimmed);

        if (hash === prevClipboardHashRef.current) return;
        if (consumedClipboardRef.current.has(hash)) return;

        const musicShare = parseMusicShareFromClipboard(trimmed);
        if (musicShare) {
          console.log('[Clipboard] 检测到音乐分享链接:', musicShare.title, musicShare.artist);
          prevClipboardHashRef.current = hash;
          const shareData: ShareOcrData = {
            title: musicShare.title,
            artist: musicShare.artist,
            detectedLanguage: musicShare.detectedLanguage,
          };
          onMusicShareStored(shareData);
          setShareOcrData((prev) => ({ ...(prev ?? { title: '', artist: '' }), ...shareData }));
          const detectedLang = musicShare.detectedLanguage;
          if (detectedLang) {
            setAppSettings((prev) => ({ ...prev, lyricsLanguage: detectedLang as LyricsLanguage }));
            saveAppSettings({ lyricsLanguage: detectedLang });
          }
          hapticSuccess();
          return;
        }

        if (!isStructuredLyricsClipboardText(trimmed)) return;

        prevClipboardHashRef.current = hash;

        if (onStructuredLyricsRef.current(trimmed)) {
          console.log('[Clipboard] 弹窗已触发 (attempt:', attempt, ')');
        }
      } catch (err) {
        console.warn('[Clipboard] 读取失败 (attempt:', attempt, '):', err);
        if (attempt < 2) {
          const delays = [600, 1400];
          setTimeout(() => { void tryReadClipboard(attempt + 1); }, delays[attempt]!);
        }
      }
    };

    const removeListener = onAppBecameActive(() => {
      void tryReadClipboard(0);
    });

    return removeListener;
  }, [
    consumedClipboardRef,
    prevClipboardHashRef,
    setShareOcrData,
    setAppSettings,
    onMusicShareStored,
  ]);
}
