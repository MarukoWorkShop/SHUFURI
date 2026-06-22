import { useCallback, useRef, useState } from 'react';
import { hapticSuccess } from './useHaptics';
import type { LangCode } from '../services/appSettings';
import { readClipboardText } from '../utils/clipboard';
import {
  clipboardContentHash,
  getStructuredLyricsCardMeta,
  isStructuredLyricsClipboardText,
  prepareStructuredLyricsClipboardText,
  type StructuredLyricsCardFallbacks,
} from '../utils/clipboardStructuredLyrics';
import { postClipboardRead } from '../utils/nativeBridge';
import type { ShowAppToast } from '../context/AppToastContext';

type ShareOcrData = {
  title: string;
  artist: string;
  detectedLanguage?: 'jp' | 'ko' | 'zh' | 'mixed' | 'unknown';
};

type Options = {
  shareOcrData: ShareOcrData | null;
  showToast: ShowAppToast;
  onRenderLayout: (
    bodyHtml: string,
    title: string,
    rawPaste: string,
    artist?: string,
    lang?: LangCode,
  ) => Promise<void>;
};

export function useStructuredLyricsClipboardCard({
  shareOcrData,
  showToast,
  onRenderLayout,
}: Options) {
  const [clipboardCardVisible, setClipboardCardVisible] = useState(false);
  const [clipboardDetectedSong, setClipboardDetectedSong] = useState('');
  const [clipboardDetectedArtist, setClipboardDetectedArtist] = useState('');
  const [clipboardDetectedLang, setClipboardDetectedLang] = useState<LangCode | undefined>(undefined);

  const consumedClipboardRef = useRef<Set<string>>(new Set());
  const prevClipboardHashRef = useRef('');
  const homeFormMetaRef = useRef({ title: '', artist: '' });

  const activateClipboardDetectCardFromText = useCallback(
    (text: string, formMeta?: StructuredLyricsCardFallbacks): boolean => {
      const meta = getStructuredLyricsCardMeta(text, {
        title: formMeta?.title || shareOcrData?.title || homeFormMetaRef.current.title,
        artist: formMeta?.artist || shareOcrData?.artist || homeFormMetaRef.current.artist,
      });
      if (!meta) {
        return false;
      }
      setClipboardDetectedSong(meta.title);
      setClipboardDetectedArtist(meta.artist);
      setClipboardDetectedLang(meta.lang);
      setClipboardCardVisible(true);
      hapticSuccess();
      return true;
    },
    [shareOcrData],
  );

  const handleActivatePasteLayout = useCallback(
    async (formMeta?: StructuredLyricsCardFallbacks) => {
      try {
        const text = await readClipboardText();
        const trimmed = text.trim();
        if (!trimmed) {
          showToast('剪贴板为空');
          return;
        }
        if (activateClipboardDetectCardFromText(trimmed, formMeta)) {
          prevClipboardHashRef.current = clipboardContentHash(trimmed);
          return;
        }
        showToast('未检测到结构化歌词');
      } catch {
        showToast('无法读取剪贴板');
      }
    },
    [activateClipboardDetectCardFromText, showToast],
  );

  const handleClipboardRenderLayout = useCallback(() => {
    setClipboardCardVisible(false);
    void (async () => {
      try {
        const text = await postClipboardRead();
        if (text && isStructuredLyricsClipboardText(text)) {
          const cleaned = prepareStructuredLyricsClipboardText(text);
          const { preparePasteForLayout } = await import('../services/lyricsHtml');
          const prepared = preparePasteForLayout(cleaned);
          await onRenderLayout(
            prepared.bodyHtml,
            prepared.title || '',
            cleaned,
            prepared.artist,
            prepared.lang,
          );
        }
      } catch {
        // 静默失败
      }
    })();
  }, [onRenderLayout]);

  const handleClipboardDismiss = useCallback(() => {
    if (prevClipboardHashRef.current) {
      consumedClipboardRef.current.add(prevClipboardHashRef.current);
    }
    setClipboardCardVisible(false);
  }, []);

  return {
    clipboardCardVisible,
    clipboardDetectedSong,
    clipboardDetectedArtist,
    clipboardDetectedLang,
    consumedClipboardRef,
    prevClipboardHashRef,
    homeFormMetaRef,
    activateClipboardDetectCardFromText,
    handleActivatePasteLayout,
    handleClipboardRenderLayout,
    handleClipboardDismiss,
  };
}
