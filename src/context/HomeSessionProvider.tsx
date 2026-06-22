import { useState, type ReactNode } from 'react';
import { usePosterDocumentContext } from './PosterWorkspaceContext';
import { useStructuredLyricsClipboardCard } from '../hooks/useStructuredLyricsClipboardCard';
import {
  HomeSessionContext,
  type HomeSessionContextValue,
  type ShareOcrData,
} from './HomeSessionContext';
import type { ShowAppToast } from './AppToastContext';

type Props = {
  children: ReactNode;
  showToast: ShowAppToast;
};

export default function HomeSessionProvider({ children, showToast }: Props) {
  const { handleLayoutFromHtml } = usePosterDocumentContext();
  const [shareOcrData, setShareOcrData] = useState<ShareOcrData | null>(null);

  const clipboardCard = useStructuredLyricsClipboardCard({
    shareOcrData,
    showToast,
    onRenderLayout: handleLayoutFromHtml,
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
  };

  return <HomeSessionContext.Provider value={value}>{children}</HomeSessionContext.Provider>;
}
