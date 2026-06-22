import { useState } from 'react';
import './App.css';
import ErrorBoundary from './components/ErrorBoundary';
import AppLayout from './components/app/AppLayout';
import HomeScreen from './components/screens/HomeScreen';
import EditScreen from './components/screens/EditScreen';
import ExportScreen from './components/screens/ExportScreen';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useGlobalButtonFeedback } from './hooks/useGlobalButtonFeedback';
import { saveAppSettings } from './services/appSettings';
import { useClipboardStructuredLyrics } from './hooks/useClipboardHasContent';
import { useTimedMessage } from './hooks/useTimedMessage';
import { AppToastContext } from './context/AppToastContext';
import PosterWorkspaceProvider from './context/PosterWorkspaceProvider';
import HomeSessionProvider from './context/HomeSessionProvider';
import { usePosterDocumentContext } from './context/PosterWorkspaceContext';
import { useHomeSessionContext } from './context/HomeSessionContext';
import { useAppSettings, type UseAppSettingsReturn } from './hooks/useAppSettings';
import { useStudyCardsSession } from './hooks/useStudyCardsSession';
import { useChainLink } from './hooks/useChainLink';

type AppShellProps = {
  settings: UseAppSettingsReturn;
  inputResetKey: number;
  libraryRefreshKey: number;
  toastMessage: string | null;
};

function AppShell({
  settings,
  inputResetKey,
  libraryRefreshKey,
  toastMessage,
}: AppShellProps) {
  const { mode, openProject } = usePosterDocumentContext();
  const homeSession = useHomeSessionContext();
  const {
    appSettings,
    setAppSettings,
    settingsOpen,
    setSettingsOpen,
    wheelLanguages,
    languageMatrixContext,
    handleSettingsChange,
  } = settings;

  const pasteLayoutReady = useClipboardStructuredLyrics();

  const { chainBtnRef, chainTipVisible, hasMusicLink, handleChainClick, storeMusicShare } =
    useChainLink({
      shareOcrData: homeSession.shareOcrData,
      setShareOcrData: homeSession.setShareOcrData,
      setAppSettings,
    });

  const network = useNetworkStatus();

  return (
    <AppLayout
      mode={mode}
      networkOnline={network.online}
      networkLoading={network.loading}
      settingsOpen={settingsOpen}
      onSettingsClose={() => setSettingsOpen(false)}
      onSettingsChange={handleSettingsChange}
      hasMusicLink={hasMusicLink}
      chainBtnRef={chainBtnRef}
      chainTipVisible={chainTipVisible}
      onChainClick={() => void handleChainClick()}
      onSettingsClick={() => setSettingsOpen(true)}
      toastMessage={toastMessage ?? ''}
    >
      {mode === 'input' && (
        <HomeScreen
          inputResetKey={inputResetKey}
          appSettings={appSettings}
          wheelLanguages={wheelLanguages}
          languageMatrixContext={languageMatrixContext}
          shareOcrData={homeSession.shareOcrData}
          pasteLayoutReady={pasteLayoutReady}
          libraryRefreshKey={libraryRefreshKey}
          onLanguageChange={(lang) => {
            handleSettingsChange(saveAppSettings({ lyricsLanguage: lang }));
          }}
          onActivatePasteLayout={(formMeta) =>
            void homeSession.handleActivatePasteLayout(formMeta)
          }
          onFormMetaChange={(meta) => {
            homeSession.homeFormMetaRef.current = meta;
          }}
          onOpenProject={openProject}
          setShareOcrData={homeSession.setShareOcrData}
          setAppSettings={setAppSettings}
          onMusicShareStored={storeMusicShare}
          onStructuredLyrics={(text) =>
            homeSession.activateClipboardDetectCardFromText(text, {
              title: homeSession.homeFormMetaRef.current.title,
              artist: homeSession.homeFormMetaRef.current.artist,
            })
          }
          consumedClipboardRef={homeSession.consumedClipboardRef}
          prevClipboardHashRef={homeSession.prevClipboardHashRef}
        />
      )}

      {mode === 'edit' && <EditScreen />}
      {mode === 'export' && <ExportScreen />}
    </AppLayout>
  );
}

export default function App() {
  useGlobalButtonFeedback();

  const settings = useAppSettings();
  const { appSettings, lyricsLanguage } = settings;
  const [inputResetKey, setInputResetKey] = useState(0);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);

  const { studyCardsBundleIdRef, syncStudyCardsFromRaw } =
    useStudyCardsSession(appSettings.defaultIncludeVocabAndGrammar);

  const appToast = useTimedMessage(3000);

  return (
    <ErrorBoundary>
      <AppToastContext.Provider value={appToast.show}>
        <PosterWorkspaceProvider
          lyricsLanguage={lyricsLanguage}
          colorTheme={appSettings.colorTheme}
          defaultIncludeVocabAndGrammar={appSettings.defaultIncludeVocabAndGrammar}
          studyCardsBundleIdRef={studyCardsBundleIdRef}
          syncStudyCardsFromRaw={syncStudyCardsFromRaw}
          onWorkspaceReset={() => setInputResetKey((k) => k + 1)}
          onLibrarySaved={() => setLibraryRefreshKey((k) => k + 1)}
          showToast={appToast.show}
        >
          <HomeSessionProvider showToast={appToast.show}>
            <AppShell
              settings={settings}
              inputResetKey={inputResetKey}
              libraryRefreshKey={libraryRefreshKey}
              toastMessage={appToast.message}
            />
          </HomeSessionProvider>
        </PosterWorkspaceProvider>
      </AppToastContext.Provider>
    </ErrorBoundary>
  );
}
