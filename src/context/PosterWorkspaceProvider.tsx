import { useCallback, useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import type { ColorTheme, LyricsLanguage } from '../services/appSettings';
import { usePosterPreviewFitScale } from '../hooks/usePosterPreviewFitScale';
import { useInkEditSession } from '../hooks/useInkEditSession';
import { usePosterTypography } from '../hooks/usePosterTypography';
import { usePosterExport } from '../hooks/usePosterExport';
import { useNativeBridge } from '../hooks/useNativeBridge';
import { usePosterSave } from '../hooks/usePosterSave';
import { usePosterWorkspace } from '../hooks/usePosterWorkspace';
import {
  DEFAULT_PREVIEW_TYPOGRAPHY,
  buildPosterRenderOptions,
  type PosterLayoutProfile,
} from '../utils/shufuriPoster/types';
import {
  PosterDocumentContext,
  PosterInkContext,
  PosterTypographyContext,
  PosterWorkspaceContext,
  type PosterDocumentContextValue,
  type PosterInkContextValue,
  type PosterTypographyContextValue,
  type PosterWorkspaceContextValue,
} from './PosterWorkspaceContext';
import type { LangCode } from '../services/appSettings';
import type { ShowAppToast } from './AppToastContext';

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

type WorkspaceSessionOps = {
  resetInkSession: () => void;
  clearInkTarget: () => void;
  resetTypographyPreview: () => void;
};

type Props = {
  children: ReactNode;
  lyricsLanguage: LyricsLanguage;
  colorTheme: ColorTheme;
  defaultIncludeVocabAndGrammar: boolean;
  studyCardsBundleIdRef: RefObject<string>;
  syncStudyCardsFromRaw: SyncStudyCardsFn;
  onWorkspaceReset: () => void;
  onLibrarySaved: () => void;
  showToast: ShowAppToast;
};

export default function PosterWorkspaceProvider({
  children,
  lyricsLanguage,
  colorTheme,
  defaultIncludeVocabAndGrammar,
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
    resetInkSession: () => {},
    clearInkTarget: () => {},
    resetTypographyPreview: () => {},
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
    () => buildPosterRenderOptions(showRubyRef.current, previewTypographyRef.current),
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
    handleLayoutFromHtml,
    handleLayoutChange,
    handleBackToEdit: workspaceBackToEdit,
    handleReset,
    enterWorkspaceFromBridge,
  } = workspace;

  useEffect(() => { titleMarkupHtmlRef.current = titleMarkupHtml; }, [titleMarkupHtml]);

  const inkSession = useInkEditSession({
    bodyHtml,
    savedProjectId,
    bodyHtmlRef,
    titleRef,
    artistRef,
    titleMarkupHtmlRef,
    setBodyHtml,
    setTitle,
    setArtist,
    setTitleMarkupHtml,
  });

  const typography = usePosterTypography({
    mode,
    lang,
    bodyHtml,
    title,
    artist,
    layoutProfile,
    titleMarkupHtml,
    lyricsLanguage,
    setPages,
    pageRefs,
  });

  const {
    showRubyAnnotations,
    previewTypography,
    setPreviewTypography,
    repaginating,
    rubyToggleSupported,
    posterRenderOpts,
    scheduleRebuildExportPages,
    handleShowRubyChange,
    resetTypographyPreview,
  } = typography;

  useEffect(() => { showRubyRef.current = showRubyAnnotations; }, [showRubyAnnotations]);
  useEffect(() => { previewTypographyRef.current = previewTypography; }, [previewTypography]);

  workspaceSessionRef.current = {
    resetInkSession: inkSession.resetInkSession,
    clearInkTarget: inkSession.clearInkTarget,
    resetTypographyPreview,
  };

  const exportCtrl = usePosterExport({
    pages,
    title,
    layoutProfile,
    artist,
    lyricsLanguage,
    lang,
    posterRenderOpts,
    bodyHtmlRef,
    titleRef,
    artistRef,
    pagesRef,
    layoutProfileRef,
    titleMarkupHtmlRef,
    showRubyRef,
    previewTypographyRef,
    setPages,
    nativeExportingRef,
  });

  useNativeBridge({
    onSetContent: enterWorkspaceFromBridge,
    onReset: handleReset,
    onNativeExport: exportCtrl.handleNativeExport,
  });

  const { saving, handleSave } = usePosterSave({
    mode,
    bodyHtml,
    title,
    artist,
    lyrics,
    layoutProfile,
    lang,
    titleMarkupHtml,
    savedProjectId,
    lyricsLanguage,
    posterRenderOpts,
    defaultIncludeVocabAndGrammar,
    studyCardsBundleIdRef,
    lyricsRef,
    pageRefs,
    setPages,
    setSavedProjectId,
    showToast,
    onLibrarySaved,
  });

  const handleBackToEdit = useCallback(() => {
    workspaceBackToEdit();
    inkSession.clearInkTarget();
  }, [workspaceBackToEdit, inkSession.clearInkTarget]);

  const editScale = usePosterPreviewFitScale(
    EDIT_LAYOUT,
    editCanvasRef,
    mode === 'edit',
    `${savedProjectId ?? 'new'}:edit`,
  );

  const exportScale = usePosterPreviewFitScale(
    layoutProfile,
    exportPagesRef,
    mode === 'export',
    `${pages.length}:${savedProjectId ?? 'new'}:${layoutProfile}`,
  );

  const capturePageRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      pageRefs.current[index] = el;
    },
    [],
  );

  const inkValue: PosterInkContextValue = useMemo(
    () => ({
      inkToolboxOpen: inkSession.inkToolboxOpen,
      setInkToolboxOpen: inkSession.setInkToolboxOpen,
      canUndoInkEdit: inkSession.canUndoInkEdit,
      inkFocusGroupIndex: inkSession.inkFocusGroupIndex,
      inkEditTarget: inkSession.inkEditTarget,
      inkPopoverClosing: inkSession.inkPopoverClosing,
      inkDraftKanji: inkSession.inkDraftKanji,
      inkDraftKana: inkSession.inkDraftKana,
      inkDraftZh: inkSession.inkDraftZh,
      inkDraftTitle: inkSession.inkDraftTitle,
      inkDraftArtist: inkSession.inkDraftArtist,
      setInkDraftKanji: inkSession.setInkDraftKanji,
      setInkDraftKana: inkSession.setInkDraftKana,
      setInkDraftZh: inkSession.setInkDraftZh,
      setInkDraftTitle: inkSession.setInkDraftTitle,
      setInkDraftArtist: inkSession.setInkDraftArtist,
      handleInkUndo: inkSession.handleInkUndo,
      handleInkOpenTarget: inkSession.handleInkOpenTarget,
      closeInkPopover: inkSession.closeInkPopover,
      handleInkConfirm: inkSession.handleInkConfirm,
    }),
    [
      inkSession.inkToolboxOpen,
      inkSession.setInkToolboxOpen,
      inkSession.canUndoInkEdit,
      inkSession.inkFocusGroupIndex,
      inkSession.inkEditTarget,
      inkSession.inkPopoverClosing,
      inkSession.inkDraftKanji,
      inkSession.inkDraftKana,
      inkSession.inkDraftZh,
      inkSession.inkDraftTitle,
      inkSession.inkDraftArtist,
      inkSession.setInkDraftKanji,
      inkSession.setInkDraftKana,
      inkSession.setInkDraftZh,
      inkSession.setInkDraftTitle,
      inkSession.setInkDraftArtist,
      inkSession.handleInkUndo,
      inkSession.handleInkOpenTarget,
      inkSession.closeInkPopover,
      inkSession.handleInkConfirm,
    ],
  );

  const typographyValue: PosterTypographyContextValue = useMemo(
    () => ({
      showRubyAnnotations,
      previewTypography,
      repaginating,
      rubyToggleSupported,
      posterRenderOpts,
      handleShowRubyChange,
      setPreviewTypography,
      scheduleRebuildExportPages,
    }),
    [
      showRubyAnnotations,
      previewTypography,
      repaginating,
      rubyToggleSupported,
      posterRenderOpts,
      handleShowRubyChange,
      setPreviewTypography,
      scheduleRebuildExportPages,
    ],
  );

  const documentValue: PosterDocumentContextValue = useMemo(
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
      exporting: exportCtrl.exporting,
      saving,
      editCanvasRef,
      exportPagesRef,
      editScale,
      exportScale,
      capturePageRef,
      enterExportFlow,
      handleReset,
      handleBackToEdit,
      handleLayoutChange,
      handleLayoutFromHtml,
      openProject,
      handleSave,
      handleExportPdf: exportCtrl.handleExportPdf,
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
      exportCtrl.exporting,
      exportCtrl.handleExportPdf,
      saving,
      editScale,
      exportScale,
      capturePageRef,
      enterExportFlow,
      handleReset,
      handleBackToEdit,
      handleLayoutChange,
      handleLayoutFromHtml,
      openProject,
      handleSave,
    ],
  );

  const legacyValue: PosterWorkspaceContextValue = useMemo(
    () => ({ ...documentValue, ...typographyValue, ink: inkValue }),
    [documentValue, typographyValue, inkValue],
  );

  return (
    <PosterDocumentContext.Provider value={documentValue}>
      <PosterTypographyContext.Provider value={typographyValue}>
        <PosterInkContext.Provider value={inkValue}>
          <PosterWorkspaceContext.Provider value={legacyValue}>
            {children}
          </PosterWorkspaceContext.Provider>
        </PosterInkContext.Provider>
      </PosterTypographyContext.Provider>
    </PosterDocumentContext.Provider>
  );
}
