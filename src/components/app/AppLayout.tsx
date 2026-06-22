import type { RefObject, ReactNode } from 'react';
import type { AppSettings } from '../../services/appSettings';
import OfflineBanner from '../OfflineBanner';
import SettingsPanel from '../SettingsPanel';
import ClipboardDetectCard from '../ClipboardDetectCard';
import AppToast from '../AppToast';
import AppHeader from './AppHeader';
import ChainLinkTooltip from './ChainLinkTooltip';
import { useHomeSessionContext } from '../../context/HomeSessionContext';

type Mode = 'input' | 'edit' | 'export';

type Props = {
  mode: Mode;
  networkOnline: boolean;
  networkLoading: boolean;
  settingsOpen: boolean;
  onSettingsClose: () => void;
  onSettingsChange: (settings: AppSettings) => void;
  hasMusicLink: boolean;
  chainBtnRef: RefObject<HTMLButtonElement | null>;
  chainTipVisible: boolean;
  onChainClick: () => void;
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
  hasMusicLink,
  chainBtnRef,
  chainTipVisible,
  onChainClick,
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
  } = useHomeSessionContext();

  return (
    <div
      className={`app app-screen${mode === 'input' ? ' app--home' : ''}${mode === 'edit' ? ' app--edit' : ''}${mode === 'export' ? ' app--export app--preview' : ''}`}
    >
      <OfflineBanner online={networkOnline} loading={networkLoading} />

      <AppHeader
        showHomeChrome={showHomeChrome}
        compact={isWorkspaceMode}
        hasMusicLink={hasMusicLink}
        chainBtnRef={chainBtnRef}
        onChainClick={onChainClick}
        onSettingsClick={onSettingsClick}
      />

      {chainTipVisible && showHomeChrome && chainBtnRef.current && (
        <ChainLinkTooltip anchorRect={chainBtnRef.current.getBoundingClientRect()} />
      )}

      <SettingsPanel open={settingsOpen} onClose={onSettingsClose} onChange={onSettingsChange} />

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

      <AppToast message={toastMessage} placement="fixed" />
    </div>
  );
}
