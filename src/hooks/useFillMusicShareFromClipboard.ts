import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useAppToast } from '../context/AppToastContext';
import type { ShareOcrData } from '../context/HomeSessionContext';
import {
  saveAppSettings,
  type AppSettings,
  type LyricsLanguage,
} from '../services/appSettings';
import { isStructuredLyricsClipboardText } from '../utils/clipboardStructuredLyrics';
import { parseMusicShareFromClipboard } from '../utils/parseMusicShareFromClipboard';
import { hapticSuccess } from './useHaptics';

type Options = {
  setShareOcrData: Dispatch<SetStateAction<ShareOcrData | null>>;
  setAppSettings: Dispatch<SetStateAction<AppSettings>>;
  onMusicShareStored: (data: ShareOcrData) => void;
};

/**
 * 全端：将分享链接文本解析为歌名/歌手并填入表单。
 * 输入来源可以是粘贴事件文本、剪贴板读取结果等，与获取方式解耦。
 */
export function useFillMusicShareFromClipboard({
  setShareOcrData,
  setAppSettings,
  onMusicShareStored,
}: Options) {
  const showToast = useAppToast();
  const [parsing, setParsing] = useState(false);

  /** 解析一段文本，识别音乐分享链接并填入歌名/歌手 */
  const parseShareText = useCallback(
    async (text: string): Promise<boolean> => {
      if (parsing) return false;
      const trimmed = text.trim();
      if (!trimmed) {
        showToast('请先粘贴音乐软件的分享文案');
        return false;
      }

      // 结构化歌词走另一条 CTA
      if (isStructuredLyricsClipboardText(trimmed) || /(^|\n)[VG]\|/.test(trimmed)) {
        showToast('这是歌词内容，请点「粘贴剪贴板歌词」');
        return false;
      }

      setParsing(true);
      try {
        const musicShare = parseMusicShareFromClipboard(trimmed);
        if (!musicShare?.title) {
          showToast('未识别到 QQ / 网易云分享链接。请复制完整的分享文案后再试');
          return false;
        }

        const shareData: ShareOcrData = {
          title: musicShare.title,
          artist: musicShare.artist,
          detectedLanguage: musicShare.detectedLanguage,
        };
        onMusicShareStored(shareData);
        setShareOcrData((prev) => ({
          ...(prev ?? { title: '', artist: '' }),
          ...shareData,
        }));

        const detectedLang = musicShare.detectedLanguage;
        if (detectedLang === 'jp' || detectedLang === 'ko') {
          setAppSettings((prev) => ({
            ...prev,
            lyricsLanguage: detectedLang as LyricsLanguage,
          }));
          saveAppSettings({ lyricsLanguage: detectedLang });
        }

        hapticSuccess();
        const artistPart = musicShare.artist ? ` · ${musicShare.artist}` : '';
        showToast(`已填入歌名：${musicShare.title}${artistPart}`);
        return true;
      } finally {
        setParsing(false);
      }
    },
    [parsing, onMusicShareStored, setAppSettings, setShareOcrData, showToast],
  );

  return { parseShareText, parsing };
}
