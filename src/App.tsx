import { useEffect, useState, lazy, Suspense } from 'react';
import './App.css';
import ErrorBoundary from './components/ErrorBoundary';
import AppLayout from './components/app/AppLayout';
import { PulsatingDots } from './components/PulsatingDots';
import HomeScreen from './components/screens/HomeScreen';
// Edit/Export 屏体积大（海报排版、导出、字典等），按需懒加载以缩小首屏
const EditScreen = lazy(() => import('./components/screens/EditScreen'));
const ExportScreen = lazy(() => import('./components/screens/ExportScreen'));
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useGlobalButtonFeedback } from './hooks/useGlobalButtonFeedback';
import { saveAppSettings } from './services/appSettings';
import { useClipboardStructuredLyrics } from './hooks/useClipboardHasContent';
import { useTimedMessage } from './hooks/useTimedMessage';
import { AppToastContext } from './context/AppToastContext';
import AiLimitProvider from './components/AiLimitContext';
import { initErrorReporting } from './services/errorReport';
import PosterWorkspaceProvider from './context/PosterWorkspaceProvider';
import { trackPageView } from './services/analytics';
import HomeSessionProvider from './context/HomeSessionProvider';
import { usePosterDocumentContext } from './context/PosterWorkspaceContext';
import { useHomeSessionContext } from './context/HomeSessionContext';
import { useAppSettings, type UseAppSettingsReturn } from './hooks/useAppSettings';
import { useStudyCardsSession } from './hooks/useStudyCardsSession';
import { useChainLink } from './hooks/useChainLink';
import { L } from './utils/i18n';
import { CLIPBOARD_BLOCKED_EVENT } from './utils/clipboard';

type AppShellProps = {
  settings: UseAppSettingsReturn;
  inputResetKey: number;
  libraryRefreshKey: number;
  onLibraryImported: () => void;
  toastMessage: string | null;
};

function AppShell({
  settings,
  inputResetKey,
  libraryRefreshKey,
  onLibraryImported,
  toastMessage,
}: AppShellProps) {
  const { mode, openProject, isOpeningProject } = usePosterDocumentContext();
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

  const clipboardStructured = useClipboardStructuredLyrics();
  const pasteLayoutReady = clipboardStructured.ready;

  const { storeMusicShare } = useChainLink({
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
      onLibraryImported={onLibraryImported}
      onSettingsClick={() => setSettingsOpen(true)}
      toastMessage={toastMessage ?? ''}
    >
      {mode === 'input' && (
        <ErrorBoundary
          fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 32 }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 15, color: 'var(--color-fg-secondary)', marginBottom: 16 }}>
                  {L('首页加载异常', 'Home page load error')}
                </p>
                <button type="button" className="btn-tonal" onClick={() => window.location.reload()}>
                  {L('刷新页面', 'Reload')}
                </button>
              </div>
            </div>
          }
        >
          <HomeScreen
            inputResetKey={inputResetKey}
            appSettings={appSettings}
            wheelLanguages={wheelLanguages}
            languageMatrixContext={languageMatrixContext}
            shareOcrData={homeSession.shareOcrData}
            pasteLayoutReady={pasteLayoutReady}
            clipboardStreamTitle={clipboardStructured.title}
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
            onStructuredLyrics={(text, opts) =>
              homeSession.activateClipboardDetectCardFromText(text, {
                title: homeSession.homeFormMetaRef.current.title,
                artist: homeSession.homeFormMetaRef.current.artist,
                ...(opts ?? {}),
              })
            }
            consumedClipboardRef={homeSession.consumedClipboardRef}
            prevClipboardHashRef={homeSession.prevClipboardHashRef}
            externalPrompt={homeSession.externalPrompt}
            onExternalPromptHandled={homeSession.clearExternalPrompt}
          />
        </ErrorBoundary>
      )}

      {mode === 'edit' && (
        <ErrorBoundary
          fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 32 }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 15, color: 'var(--color-fg-secondary)', marginBottom: 16 }}>
                  {L('编辑器加载异常', 'Editor load error')}
                </p>
                <button type="button" className="btn-tonal" onClick={() => window.location.reload()}>
                  {L('刷新页面', 'Reload')}
                </button>
              </div>
            </div>
          }
        >
          <Suspense fallback={null}>
            <EditScreen />
          </Suspense>
        </ErrorBoundary>
      )}
      {mode === 'export' && (
        <Suspense fallback={null}>
          <ExportScreen />
        </Suspense>
      )}

      {mode === 'input' && homeSession.isLayouting && (
        <div className="global-layout-loading" role="status" aria-live="polite">
          <div className="global-layout-loading__inner">
            <PulsatingDots size={12} />
            <p className="global-layout-loading__text">
              {L('正在生成歌词学习页面…', 'Generating lyrics study page…')}
            </p>
          </div>
        </div>
      )}

      {isOpeningProject && (
        <div className="global-layout-loading" role="status" aria-live="polite">
          <div className="global-layout-loading__inner">
            <PulsatingDots size={12} />
            <p className="global-layout-loading__text">
              {L('正在打开歌词…', 'Opening lyrics…')}
            </p>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default function App() {
  useGlobalButtonFeedback();

  // UV 埋点 + 错误上报：强延后，避免首屏与 ~750KB CloudBase SDK 抢带宽（www 弱链路尤甚）
  useEffect(() => {
    let cancelled = false;
    let fired = false;
    let idleId: number | undefined;
    let timeoutId: number | undefined;

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    const clearSchedules = () => {
      if (idleId != null) w.cancelIdleCallback?.(idleId);
      if (timeoutId != null) window.clearTimeout(timeoutId);
      idleId = undefined;
      timeoutId = undefined;
    };

    const run = () => {
      if (cancelled || fired) return;
      fired = true;
      clearSchedules();
      trackPageView();
      initErrorReporting();
    };

    const schedule = (delayMs: number) => {
      clearSchedules();
      if (typeof w.requestIdleCallback === 'function') {
        idleId = w.requestIdleCallback(run, { timeout: delayMs });
      } else {
        timeoutId = window.setTimeout(run, delayMs);
      }
    };

    const onInteract = () => {
      if (cancelled || fired) return;
      schedule(2000);
    };
    window.addEventListener('pointerdown', onInteract, { once: true, passive: true });
    window.addEventListener('keydown', onInteract, { once: true });
    // 无交互时等 20s 再拉 SDK，首页先稳
    schedule(20_000);

    return () => {
      cancelled = true;
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('keydown', onInteract);
      clearSchedules();
    };
  }, []);

  const settings = useAppSettings();
  const { appSettings, lyricsLanguage } = settings;
  const [inputResetKey, setInputResetKey] = useState(0);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);

  const { studyCardsBundleIdRef, syncStudyCardsFromRaw } =
    useStudyCardsSession(appSettings.defaultIncludeVocabAndGrammar);

  const appToast = useTimedMessage(3000);

  // 监听剪贴板被静默阻止事件，展示 fallback 提示
  useEffect(() => {
    const onBlocked = () => {
      appToast.show(
        L(
          '无法读取剪贴板，请在地址栏左侧点击 🔧 图标，将剪贴板权限设为允许',
          'Cannot read clipboard. Click the 🔧 icon left of the address bar and allow clipboard access.',
        ),
        6000,
      );
    };
    window.addEventListener(CLIPBOARD_BLOCKED_EVENT, onBlocked);
    return () => window.removeEventListener(CLIPBOARD_BLOCKED_EVENT, onBlocked);
  }, [appToast.show]);

  return (
    <ErrorBoundary>
      <AppToastContext.Provider value={appToast.show}>
        <AiLimitProvider>
        <PosterWorkspaceProvider
          lyricsLanguage={lyricsLanguage}
          colorTheme={appSettings.colorTheme}
          defaultIncludeVocabAndGrammar={appSettings.defaultIncludeVocabAndGrammar}
          defaultPedagogicalLevel={appSettings.defaultPedagogicalLevel}
          studyCardsBundleIdRef={studyCardsBundleIdRef}
          syncStudyCardsFromRaw={syncStudyCardsFromRaw}
          onWorkspaceReset={() => setInputResetKey((k) => k + 1)}
          onLibrarySaved={() => setLibraryRefreshKey((k) => k + 1)}
          showToast={appToast.show}
        >
          <HomeSessionProvider
            showToast={appToast.show}
            pedagogicalLevel={appSettings.defaultPedagogicalLevel}
            matrix={settings.languageMatrixContext}
          >
            <AppShell
              settings={settings}
              inputResetKey={inputResetKey}
              libraryRefreshKey={libraryRefreshKey}
              onLibraryImported={() => setLibraryRefreshKey((k) => k + 1)}
              toastMessage={appToast.message}
            />
          </HomeSessionProvider>
        </PosterWorkspaceProvider>
        </AiLimitProvider>
      </AppToastContext.Provider>
    </ErrorBoundary>
  );
}
