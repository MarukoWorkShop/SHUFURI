import { useState, type ReactNode } from 'react';
import { usePosterDocumentContext } from './PosterWorkspaceContext';
import { useStructuredLyricsClipboardCard } from '../hooks/useStructuredLyricsClipboardCard';
import {
  HomeSessionContext,
  type HomeSessionContextValue,
  type ShareOcrData,
} from './HomeSessionContext';
import type { ShowAppToast } from './AppToastContext';
import type { PedagogicalLevel } from '../services/appSettings';
import type { LanguageMatrixContext } from '../services/languageMatrix/types';

type Props = {
  children: ReactNode;
  showToast: ShowAppToast;
  pedagogicalLevel: PedagogicalLevel;
  matrix: LanguageMatrixContext;
};

export default function HomeSessionProvider({
  children,
  showToast,
  pedagogicalLevel,
  matrix,
}: Props) {
  const { handleLayoutFromHtml } = usePosterDocumentContext();
  const [shareOcrData, setShareOcrData] = useState<ShareOcrData | null>(null);

  const clipboardCard = useStructuredLyricsClipboardCard({
    shareOcrData,
    showToast,
    onRenderLayout: handleLayoutFromHtml,
    pedagogicalLevel,
    matrix,
  });

  const value: HomeSessionContextValue = {
    shareOcrData,
    setShareOcrData,
    clipboardDetectedSong: clipboardCard.clipboardDetectedSong,
    clipboardDetectedArtist: clipboardCard.clipboardDetectedArtist,
    clipboardDetectedLang: clipboardCard.clipboardDetectedLang,
    clipboardCardVisible: clipboardCard.clipboardCardVisible,
    handleClipboardRenderLayout: clipboardCard.handleClipboardRenderLayout,
    handleClipboardDismiss: clipboardCard.handleClipboardDismiss,
    handleActivatePasteLayout: clipboardCard.handleActivatePasteLayout,
    homeFormMetaRef: clipboardCard.homeFormMetaRef,
    activateClipboardDetectCardFromText: clipboardCard.activateClipboardDetectCardFromText,
    consumedClipboardRef: clipboardCard.consumedClipboardRef,
    prevClipboardHashRef: clipboardCard.prevClipboardHashRef,
    confirmVisible: clipboardCard.confirmVisible,
    confirmTitle: clipboardCard.confirmTitle,
    confirmArtist: clipboardCard.confirmArtist,
    confirmLang: clipboardCard.confirmLang,
    confirmLineCount: clipboardCard.confirmLineCount,
    confirmPreviewLines: clipboardCard.confirmPreviewLines,
    handleConfirmLayout: clipboardCard.handleConfirmLayout,
    handleConfirmStudy: clipboardCard.handleConfirmStudy,
    handleConfirmRetry: clipboardCard.handleConfirmRetry,
    handleConfirmDismiss: clipboardCard.handleConfirmDismiss,
    externalPrompt: clipboardCard.externalPrompt,
    clearExternalPrompt: clipboardCard.clearExternalPrompt,
  };

  return <HomeSessionContext.Provider value={value}>{children}</HomeSessionContext.Provider>;
}
