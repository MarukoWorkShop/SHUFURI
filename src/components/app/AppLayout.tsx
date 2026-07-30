import type { ReactNode } from 'react';
import type { AppSettings } from '../../services/appSettings';
import OfflineBanner from '../OfflineBanner';
import SettingsPanel from '../SettingsPanel';
import ClipboardDetectCard from '../ClipboardDetectCard';
import LyricConfirmSheet from '../LyricConfirmSheet';
import AppToast from '../AppToast';
import AppHeader from './AppHeader';
import { useHomeSessionContext } from '../../context/HomeSessionContext';

type Mode = 'input' | 'edit' | 'export';

type Props = {
  mode: Mode;
  networkOnline: boolean;
  networkLoading: boolean;
  settingsOpen: boolean;
  onSettingsClose: () => void;
  onSettingsChange: (settings: AppSettings) => void;
  onLibraryImported?: () => void;
  onSettingsClick: () => void;
  toastMessage: string;
  children: ReactNode;
};

export default function AppLayout({
  mode,
  networkOnline,
  networkLoading,
  settingsOpen,
  onSettingsClose,
  onSettingsChange,
  onLibraryImported,
  onSettingsClick,
  toastMessage,
  children,
}: Props) {
  const isWorkspaceMode = mode === 'edit' || mode === 'export';
  const showHomeChrome = mode === 'input';

  const {
    clipboardDetectedSong,
    clipboardDetectedArtist,
    clipboardDetectedLang,
    clipboardCardVisible,
    handleClipboardRenderLayout,
    handleClipboardDismiss,
    confirmVisible,
    confirmStreaming,
    isGeneratingStudy,
    studyError,
    confirmTitle,
    confirmArtist,
    confirmLang,
    confirmLineCount,
    confirmPreviewLines,
    handleConfirmLayout,
    handleConfirmStudy,
    handleConfirmStudyFallback,
    handleConfirmRetry,
    handleConfirmDismiss,
  } = useHomeSessionContext();

  return (
    <div
      className={`app app-screen${mode === 'input' ? ' app--home' : ''}${mode === 'edit' ? ' app--edit' : ''}${mode === 'export' ? ' app--export app--preview' : ''}`}
    >
      <OfflineBanner online={networkOnline} loading={networkLoading} />

      <AppHeader
        showHomeChrome={showHomeChrome}
        compact={isWorkspaceMode}
        onSettingsClick={onSettingsClick}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={onSettingsClose}
        onChange={onSettingsChange}
        onLibraryImported={onLibraryImported}
      />

      <div className="app-screen__body">
        <main className={`app-main${isWorkspaceMode ? ' app-main--preview' : ''}`}>{children}</main>
      </div>

      <ClipboardDetectCard
        songTitle={clipboardDetectedSong}
        artist={clipboardDetectedArtist}
        language={clipboardDetectedLang}
        visible={clipboardCardVisible}
        onRenderLayout={handleClipboardRenderLayout}
        onDismiss={handleClipboardDismiss}
      />

      <LyricConfirmSheet
        visible={confirmVisible}
        songTitle={confirmTitle}
        artist={confirmArtist}
        language={confirmLang}
        lineCount={confirmLineCount}
        previewLines={confirmPreviewLines}
        streamingDelayMs={confirmStreaming ? 85 : 0}
        isGeneratingStudy={isGeneratingStudy}
        studyError={studyError}
        onConfirmLayout={handleConfirmLayout}
        onConfirmStudy={handleConfirmStudy}
        onFallbackExternal={handleConfirmStudyFallback}
        onRetry={handleConfirmRetry}
        onDismiss={handleConfirmDismiss}
      />

      <AppToast message={toastMessage} placement="fixed" />
    </div>
  );
}
