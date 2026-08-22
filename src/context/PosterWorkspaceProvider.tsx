/**
 * 首屏轻量 Document 壳：仅挂 usePosterWorkspace。
 * ink / typography / export / save 在 mode !== 'input' 时懒加载 PosterEditSessionProvider。
 */
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import type { ColorTheme, LyricsLanguage, PedagogicalLevel, LangCode } from '../services/appSettings';
import { useNativeBridge } from '../hooks/useNativeBridge';
import { usePosterWorkspace } from '../hooks/usePosterWorkspace';
import {
  DEFAULT_PREVIEW_TYPOGRAPHY,
  buildPosterRenderOptions,
  type PosterLayoutProfile,
} from '../utils/shufuriPoster/types';
import { getRenderOptsBridge } from '../utils/shufuriPoster/posterRenderOptsBridge';
import { PosterDocumentContext, type PosterDocumentContextValue } from './PosterWorkspaceContext';
import type { ShowAppToast } from './AppToastContext';
import type { WorkspaceSessionOps } from './PosterEditSessionProvider';
import GlobalChunkLoading, {
  EDIT_ENTRY_LOADING_TIPS,
} from '../components/GlobalChunkLoading';

const PosterEditSessionProvider = lazy(() => import('./PosterEditSessionProvider'));

const EDIT_LAYOUT: PosterLayoutProfile = 'mobilePoster';

type SyncStudyCardsFn = (
  rawLyrics: string,
  bundleId: string,
  meta: {
    title?: string;
    artist?: string;
    lang?: LangCode;
    includeVocabAndGrammar?: boolean;
  },
) => Promise<number>;

type Props = {
  children: ReactNode;
  lyricsLanguage: LyricsLanguage;
  colorTheme: ColorTheme;
  defaultIncludeVocabAndGrammar: boolean;
  defaultPedagogicalLevel: PedagogicalLevel;
  studyCardsBundleIdRef: RefObject<string>;
  syncStudyCardsFromRaw: SyncStudyCardsFn;
  onWorkspaceReset: () => void;
  onLibrarySaved: () => void;
  showToast: ShowAppToast;
};

const noop = () => {};
const noopAsync = async () => {};

export default function PosterWorkspaceProvider({
  children,
  lyricsLanguage,
  colorTheme,
  defaultIncludeVocabAndGrammar,
  defaultPedagogicalLevel,
  studyCardsBundleIdRef,
  syncStudyCardsFromRaw,
  onWorkspaceReset,
  onLibrarySaved,
  showToast,
}: Props) {
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const editCanvasRef = useRef<HTMLDivElement>(null);
  const exportPagesRef = useRef<HTMLDivElement>(null);
  const titleMarkupHtmlRef = useRef<string | undefined>(undefined);
  const showRubyRef = useRef(true);
  const previewTypographyRef = useRef(DEFAULT_PREVIEW_TYPOGRAPHY);
  const nativeExportingRef = useRef(false);
  const workspaceSessionRef = useRef<WorkspaceSessionOps>({
    resetInkSession: noop,
    clearInkTarget: noop,
    resetTypographyPreview: noop,
  });

  const onAfterEnterEdit = useCallback(() => {
    workspaceSessionRef.current.resetInkSession();
    workspaceSessionRef.current.resetTypographyPreview();
  }, []);

  const onAfterReset = useCallback(() => {
    onWorkspaceReset();
    workspaceSessionRef.current.clearInkTarget();
    workspaceSessionRef.current.resetInkSession();
    workspaceSessionRef.current.resetTypographyPreview();
  }, [onWorkspaceReset]);

  const getPosterRenderOpts = useCallback(
    () =>
      buildPosterRenderOptions(
        showRubyRef.current,
        previewTypographyRef.current,
        getRenderOptsBridge().backgroundId || undefined,
        getRenderOptsBridge().layoutVariant,
      ),
    [],
  );

  const workspace = usePosterWorkspace({
    editLayoutProfile: EDIT_LAYOUT,
    lyricsLanguage,
    getPosterRenderOpts,
    defaultIncludeVocabAndGrammar,
    studyCardsBundleIdRef,
    syncStudyCardsFromRaw,
    pageRefs,
    onAfterEnterEdit,
    onAfterReset,
  });

  const {
    mode,
    lyrics,
    title,
    artist,
    bodyHtml,
    setBodyHtml,
    pages,
    setPages,
    layoutProfile,
    savedProjectId,
    setSavedProjectId,
    lang,
    titleMarkupHtml,
    setTitleMarkupHtml,
    setTitle,
    setArtist,
    refs: { bodyHtmlRef, titleRef, artistRef, pagesRef, layoutProfileRef, lyricsRef },
    enterExportFlow,
    openProject,
    isOpeningProject,
    handleLayoutFromHtml,
    handleLayoutChange,
    handleBackToEdit: workspaceBackToEdit,
    handleReset,
    enterWorkspaceFromBridge,
  } = workspace;

  useEffect(() => {
    titleMarkupHtmlRef.current = titleMarkupHtml;
  }, [titleMarkupHtml]);

  useNativeBridge({
    onSetContent: enterWorkspaceFromBridge,
    onReset: handleReset,
    onNativeExport: noopAsync,
  });

  const capturePageRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      pageRefs.current[index] = el;
    },
    [],
  );

  const lightDocumentValue: PosterDocumentContextValue = useMemo(
    () => ({
      mode,
      lyrics,
      title,
      artist,
      bodyHtml,
      pages,
      layoutProfile,
      savedProjectId,
      lang,
      titleMarkupHtml,
      lyricsLanguage,
      colorTheme,
      exporting: false,
      saving: false,
      editCanvasRef,
      exportPagesRef,
      editScale: 1,
      exportScale: 1,
      capturePageRef,
      enterExportFlow,
      handleReset,
      handleBackToEdit: workspaceBackToEdit,
      handleLayoutChange,
      handleLayoutFromHtml,
      openProject,
      isOpeningProject,
      handleSave: noopAsync,
      handleExportPdf: noopAsync,
      appendExplainNote: noop,
      removeExplainNote: noop,
      updateExplainNote: noop,
      ensureExplainNoteIds: noop,
      ensureStudyItemIds: noop,
      removeStudyItem: noop,
      updateVocabItem: noop,
      updateGrammarItem: noop,
      appendGrammarStudyItem: noop,
    }),
    [
      mode,
      lyrics,
      title,
      artist,
      bodyHtml,
      pages,
      layoutProfile,
      savedProjectId,
      lang,
      titleMarkupHtml,
      lyricsLanguage,
      colorTheme,
      capturePageRef,
      enterExportFlow,
      handleReset,
      workspaceBackToEdit,
      handleLayoutChange,
      handleLayoutFromHtml,
      openProject,
      isOpeningProject,
    ],
  );

  const editSession = mode !== 'input' && (
    <Suspense
      fallback={
        <GlobalChunkLoading tips={EDIT_ENTRY_LOADING_TIPS} />
      }
    >
      <PosterEditSessionProvider
        mode={mode}
        lyrics={lyrics}
        title={title}
        artist={artist}
        bodyHtml={bodyHtml}
        setBodyHtml={setBodyHtml}
        pages={pages}
        setPages={setPages}
        layoutProfile={layoutProfile}
        savedProjectId={savedProjectId}
        setSavedProjectId={setSavedProjectId}
        lang={lang}
        titleMarkupHtml={titleMarkupHtml}
        setTitleMarkupHtml={setTitleMarkupHtml}
        setTitle={setTitle}
        setArtist={setArtist}
        lyricsLanguage={lyricsLanguage}
        colorTheme={colorTheme}
        defaultIncludeVocabAndGrammar={defaultIncludeVocabAndGrammar}
        defaultPedagogicalLevel={defaultPedagogicalLevel}
        studyCardsBundleIdRef={studyCardsBundleIdRef}
        onLibrarySaved={onLibrarySaved}
        showToast={showToast}
        pageRefs={pageRefs}
        bodyHtmlRef={bodyHtmlRef}
        titleRef={titleRef}
        artistRef={artistRef}
        pagesRef={pagesRef}
        layoutProfileRef={layoutProfileRef}
        lyricsRef={lyricsRef}
        titleMarkupHtmlRef={titleMarkupHtmlRef}
        showRubyRef={showRubyRef}
        previewTypographyRef={previewTypographyRef}
        nativeExportingRef={nativeExportingRef}
        editCanvasRef={editCanvasRef}
        exportPagesRef={exportPagesRef}
        enterExportFlow={enterExportFlow}
        handleReset={handleReset}
        handleLayoutChange={handleLayoutChange}
        handleLayoutFromHtml={handleLayoutFromHtml}
        openProject={openProject}
        isOpeningProject={isOpeningProject}
        workspaceBackToEdit={workspaceBackToEdit}
        enterWorkspaceFromBridge={enterWorkspaceFromBridge}
        workspaceSessionRef={workspaceSessionRef}
        getPosterRenderOpts={getPosterRenderOpts}
      >
        {children}
      </PosterEditSessionProvider>
    </Suspense>
  );

  return (
    <PosterDocumentContext.Provider value={lightDocumentValue}>
      {mode === 'input' ? children : editSession}
    </PosterDocumentContext.Provider>
  );
}
