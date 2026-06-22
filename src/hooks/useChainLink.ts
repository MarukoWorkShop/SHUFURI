import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { saveAppSettings, type AppSettings } from '../services/appSettings';
import type { OcrDetectedLanguage } from '../services/ocrTypes';
import { postClipboardRead } from '../utils/nativeBridge';
import { isStructuredLyricsClipboardText } from '../utils/clipboardStructuredLyrics';

type ShareOcrData = {
  title: string;
  artist: string;
  detectedLanguage?: OcrDetectedLanguage;
};

function ocrLangToLyricsLanguage(lang: OcrDetectedLanguage): AppSettings['lyricsLanguage'] | undefined {
  if (lang === 'jp') return 'jp';
  if (lang === 'ko') return 'ko';
  if (lang === 'zh') return 'zh';
  return undefined;
}

type Options = {
  shareOcrData: ShareOcrData | null;
  setShareOcrData: Dispatch<SetStateAction<ShareOcrData | null>>;
  setAppSettings: Dispatch<SetStateAction<AppSettings>>;
};

export function useChainLink({ shareOcrData, setShareOcrData, setAppSettings }: Options) {
  const [chainTipVisible, setChainTipVisible] = useState(false);
  const chainBtnRef = useRef<HTMLButtonElement>(null);
  const lastDetectedShareRef = useRef<ShareOcrData | null>(null);

  const hasMusicLink =
    shareOcrData !== null && (shareOcrData.title !== '' || shareOcrData.artist !== '');

  useEffect(() => {
    if (!chainTipVisible) return;
    const handleClick = () => {
      setTimeout(() => setChainTipVisible(false), 10);
    };
    document.addEventListener('click', handleClick, { capture: true });
    const timer = setTimeout(() => setChainTipVisible(false), 5000);
    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
      clearTimeout(timer);
    };
  }, [chainTipVisible]);

  const storeMusicShare = useCallback((data: ShareOcrData) => {
    lastDetectedShareRef.current = data;
  }, []);

  const handleChainClick = useCallback(async () => {
    if (!hasMusicLink) {
      setChainTipVisible((prev) => !prev);
      return;
    }
    try {
      const currentClipText = await postClipboardRead();
      if (currentClipText && isStructuredLyricsClipboardText(currentClipText)) {
        console.log('[LinkChain] 剪贴板为结构化歌词，拒绝恢复');
        return;
      }
    } catch {
      /* 读取失败则允许恢复 */
    }
    if (lastDetectedShareRef.current) {
      const d = lastDetectedShareRef.current;
      setShareOcrData((prev) => ({ ...prev, ...d }));
      if (d.detectedLanguage) {
        const mappedLang = ocrLangToLyricsLanguage(d.detectedLanguage);
        if (mappedLang) {
          setAppSettings((prev) => ({ ...prev, lyricsLanguage: mappedLang }));
          saveAppSettings({ lyricsLanguage: mappedLang });
        }
      }
    }
  }, [hasMusicLink, setShareOcrData, setAppSettings]);

  return {
    chainBtnRef,
    chainTipVisible,
    hasMusicLink,
    handleChainClick,
    storeMusicShare,
  };
}
