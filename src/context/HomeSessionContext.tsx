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
    formMeta?: { title?: string; artist?: string; streaming?: boolean },
  ) => boolean;
  consumedClipboardRef: RefObject<Set<string>>;
  prevClipboardHashRef: RefObject<string>;
  // 两步式歌词确认
  confirmVisible: boolean;
  confirmStreaming: boolean;
  isGeneratingStudy: boolean;
  /** 剪贴板解析并排版为歌词学习页期间为 true（驱动全屏 Loading） */
  isLayouting: boolean;
  studyError: string | null;
  confirmTitle: string;
  confirmArtist: string;
  confirmLang: LangCode | undefined;
  confirmLineCount: number;
  confirmPreviewLines: LyricPreviewLine[];
  handleConfirmLayout: () => void;
  handleConfirmStudy: () => void;
  handleConfirmStudyFallback: () => void;
  handleConfirmRetry: () => void;
  handleConfirmDismiss: () => void;
  externalPrompt: ExternalPromptRequest | null;
  clearExternalPrompt: () => void;
  /** 自动读剪贴板失败后的手动粘贴 modal（如 iOS WKWebView 非 focused） */
  manualPasteOpen: boolean;
  manualPasteText: string;
  setManualPasteText: Dispatch<SetStateAction<string>>;
  handleManualPasteSubmit: (formMeta?: { title?: string; artist?: string }) => void;
  handleManualPasteCancel: () => void;
};

export const HomeSessionContext = createContext<HomeSessionContextValue | null>(null);

export function useHomeSessionContext(): HomeSessionContextValue {
  const ctx = useContext(HomeSessionContext);
  if (!ctx) {
    throw new Error('useHomeSessionContext must be used within HomeSessionProvider');
  }
  return ctx;
}
