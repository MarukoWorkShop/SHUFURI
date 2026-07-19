import { createContext, useContext, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { LangCode } from '../services/appSettings';
import type { OcrDetectedLanguage } from '../services/ocrTypes';
import type { LyricPreviewLine } from '../utils/lyricConfirm';
import type { ExternalPromptRequest } from '../hooks/useStructuredLyricsClipboardCard';

export type ShareOcrData = {
  title: string;
  artist: string;
  detectedLanguage?: OcrDetectedLanguage;
  /** OCR / 分享链上下文，供 Step1 口令锚定官方歌词 */
  album?: string;
  production?: string;
  firstLyricLine?: string;
  rawTexts?: string[];
};

export type HomeSessionContextValue = {
  shareOcrData: ShareOcrData | null;
  setShareOcrData: Dispatch<SetStateAction<ShareOcrData | null>>;
  clipboardDetectedSong: string;
  clipboardDetectedArtist: string;
  clipboardDetectedLang: LangCode | undefined;
  clipboardCardVisible: boolean;
  handleClipboardRenderLayout: () => void;
  handleClipboardDismiss: () => void;
  handleActivatePasteLayout: (formMeta?: { title?: string; artist?: string }) => Promise<void>;
  homeFormMetaRef: RefObject<{ title: string; artist: string }>;
  activateClipboardDetectCardFromText: (
    text: string,
    formMeta?: { title?: string; artist?: string },
  ) => boolean;
  consumedClipboardRef: RefObject<Set<string>>;
  prevClipboardHashRef: RefObject<string>;
  // 两步式歌词确认
  confirmVisible: boolean;
  confirmTitle: string;
  confirmArtist: string;
  confirmLang: LangCode | undefined;
  confirmLineCount: number;
  confirmPreviewLines: LyricPreviewLine[];
  handleConfirmLayout: () => void;
  handleConfirmStudy: () => void;
  handleConfirmRetry: () => void;
  handleConfirmDismiss: () => void;
  externalPrompt: ExternalPromptRequest | null;
  clearExternalPrompt: () => void;
};

export const HomeSessionContext = createContext<HomeSessionContextValue | null>(null);

export function useHomeSessionContext(): HomeSessionContextValue {
  const ctx = useContext(HomeSessionContext);
  if (!ctx) {
    throw new Error('useHomeSessionContext must be used within HomeSessionProvider');
  }
  return ctx;
}
