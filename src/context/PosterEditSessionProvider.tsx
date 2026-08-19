import { useCallback, useEffect, useMemo, type ReactNode, type RefObject } from 'react';
import type { ColorTheme, LyricsLanguage, PedagogicalLevel, LangCode } from '../services/appSettings';
import { usePosterPreviewFitScale } from '../hooks/usePosterPreviewFitScale';
import { useInkEditSession } from '../hooks/useInkEditSession';
import { usePosterTypography } from '../hooks/usePosterTypography';
import { usePosterExport } from '../hooks/usePosterExport';
import { useNativeBridge } from '../hooks/useNativeBridge';
import { usePosterSave } from '../hooks/usePosterSave';
import type { AppMode } from '../hooks/usePosterWorkspace';
import {
  type PosterLayoutProfile,
  type PosterPageSlice,
  type PosterRenderOptions,
  type PreviewTypography,
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
import type { ShowAppToast } from './AppToastContext';
import {
  commitExplainNoteToBody,
  deleteExplainNoteFromBodyHtml,
  updateExplainNoteInBodyHtml,
  ensureExplainNoteIdsInBodyHtml,
} from '../utils/appendExplainNoteToBody';
import {
  ensureStudyItemIdsInBodyHtml,
  deleteStudyItemFromBodyHtml,
  updateVocabItemInBodyHtml,
  updateGrammarItemInBodyHtml,
  commitGrammarStudyItemToBody,
} from '../utils/studySectionItems';
import type { SavedLyricsProject } from '../services/savedLyricsStore';
import type { SetContentPayload } from '../bridge/nativeBridge';

const EDIT_LAYOUT: PosterLayoutProfile = 'mobilePoster';

export type WorkspaceSessionOps = {
  resetInkSession: () => void;
  clearInkTarget: () => void;
  resetTypographyPreview: () => void;
};

export type PosterEditSessionProps = {
  children: ReactNode;
  mode: AppMode;
  lyrics: string;
  title: string;
  artist: string;
  bodyHtml: string;
  setBodyHtml: (html: string) => void;
  pages: PosterPageSlice[];
  setPages: (pages: PosterPageSlice[]) => void;
  layoutProfile: PosterLayoutProfile;
  savedProjectId: string | null;
  setSavedProjectId: (id: string | null) => void;
  lang: LangCode | undefined;
  titleMarkupHtml: string | undefined;
  setTitleMarkupHtml: (html: string | undefined) => void;
  setTitle: (t: string) => void;
  setArtist: (a: string) => void;
  lyricsLanguage: LyricsLanguage;
  colorTheme: ColorTheme;
  defaultIncludeVocabAndGrammar: boolean;
  defaultPedagogicalLevel: PedagogicalLevel;
  studyCardsBundleIdRef: RefObject<string>;
  onLibrarySaved: () => void;
  showToast: ShowAppToast;
  pageRefs: RefObject<(HTMLDivElement | null)[]>;
  bodyHtmlRef: RefObject<string>;
  titleRef: RefObject<string>;
  artistRef: RefObject<string>;
  pagesRef: RefObject<PosterPageSlice[]>;
  layoutProfileRef: RefObject<PosterLayoutProfile>;
  lyricsRef: RefObject<string>;
  titleMarkupHtmlRef: RefObject<string | undefined>;
  showRubyRef: RefObject<boolean>;
  previewTypographyRef: RefObject<PreviewTypography>;
  nativeExportingRef: RefObject<boolean>;
  editCanvasRef: RefObject<HTMLDivElement | null>;
  exportPagesRef: RefObject<HTMLDivElement | null>;
  enterExportFlow: () => Promise<void>;
  handleReset: () => void;
  handleLayoutChange: (profile: PosterLayoutProfile) => Promise<void>;
  handleLayoutFromHtml: (
    bodyHtml: string,
    title: string,
    rawPaste: string,
    artist?: string,
    lang?: LangCode,
  ) => Promise<void>;
  openProject: (project: SavedLyricsProject) => Promise<void>;
  isOpeningProject: boolean;
  workspaceBackToEdit: () => void;
  enterWorkspaceFromBridge: (payload: SetContentPayload) => Promise<void>;
  workspaceSessionRef: RefObject<WorkspaceSessionOps>;
  getPosterRenderOpts: () => PosterRenderOptions;
};

export default function PosterEditSessionProvider({
  children,
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
  lyricsLanguage,
  colorTheme,
  defaultIncludeVocabAndGrammar,
  defaultPedagogicalLevel,
  studyCardsBundleIdRef,
  onLibrarySaved,
  showToast,
  pageRefs,
  bodyHtmlRef,
  titleRef,
  artistRef,
  pagesRef,
  layoutProfileRef,
  lyricsRef,
  titleMarkupHtmlRef,
  showRubyRef,
  previewTypographyRef,
  nativeExportingRef,
  editCanvasRef,
  exportPagesRef,
  enterExportFlow,
  handleReset,
  handleLayoutChange,
  handleLayoutFromHtml,
  openProject,
  isOpeningProject,
  workspaceBackToEdit,
  enterWorkspaceFromBridge,
  workspaceSessionRef,
  getPosterRenderOpts,
}: PosterEditSessionProps) {
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
    repaginating,
    rubyToggleSupported,
    posterRenderOpts,
    backgroundId,
    handleShowRubyChange,
    handleBackgroundChange,
    resetTypographyPreview,
  } = typography;

  useEffect(() => {
    showRubyRef.current = showRubyAnnotations;
  }, [showRubyAnnotations, showRubyRef]);
  useEffect(() => {
    previewTypographyRef.current = previewTypography;
  }, [previewTypography, previewTypographyRef]);

  useEffect(() => {
    workspaceSessionRef.current = {
      resetInkSession: inkSession.resetInkSession,
      clearInkTarget: inkSession.clearInkTarget,
      resetTypographyPreview,
    };
    inkSession.resetInkSession();
    resetTypographyPreview();
    return () => {
      workspaceSessionRef.current = {
        resetInkSession: () => {},
        clearInkTarget: () => {},
        resetTypographyPreview: () => {},
      };
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount once per edit session

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
    getPosterRenderOpts,
    setPages,
    nativeExportingRef,
    showToast,
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
    defaultPedagogicalLevel,
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
    exportCtrl.exporting || saving,
  );

  const capturePageRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      pageRefs.current[index] = el;
    },
    [pageRefs],
  );

  const inkValue: PosterInkContextValue = useMemo(
    () => ({
      inkToolboxOpen: inkSession.inkToolboxOpen,
      setInkToolboxOpen: inkSession.setInkToolboxOpen,
      inkEditMode: inkSession.inkEditMode,
      setInkEditMode: inkSession.setInkEditMode,
      canUndoInkEdit: inkSession.canUndoInkEdit,
      inkFocusGroupIndex: inkSession.inkFocusGroupIndex,
      inkEditTarget: inkSession.inkEditTarget,
      inkPopoverClosing: inkSession.inkPopoverClosing,
      inkDraftKanji: inkSession.inkDraftKanji,
      inkDraftKana: inkSession.inkDraftKana,
      inkDraftZh: inkSession.inkDraftZh,
      inkDraftKo: inkSession.inkDraftKo,
      inkDraftTitle: inkSession.inkDraftTitle,
      inkDraftArtist: inkSession.inkDraftArtist,
      inkDraftJp: inkSession.inkDraftJp,
      setInkDraftKanji: inkSession.setInkDraftKanji,
      setInkDraftKana: inkSession.setInkDraftKana,
      setInkDraftZh: inkSession.setInkDraftZh,
      setInkDraftKo: inkSession.setInkDraftKo,
      setInkDraftTitle: inkSession.setInkDraftTitle,
      setInkDraftArtist: inkSession.setInkDraftArtist,
      setInkDraftJp: inkSession.setInkDraftJp,
      handleInkUndo: inkSession.handleInkUndo,
      handleInkOpenTarget: inkSession.handleInkOpenTarget,
      closeInkPopover: inkSession.closeInkPopover,
      handleInkConfirm: inkSession.handleInkConfirm,
      handleInkRemoveRuby: inkSession.handleInkRemoveRuby,
    }),
    [inkSession],
  );

  const appendExplainNote = useCallback(
    (payload: {
      id: string;
      term: string;
      contextSense: string;
      grammar?: string;
      formula?: string;
      mood?: string;
    }) => {
      const next = commitExplainNoteToBody(bodyHtmlRef.current, payload, lang);
      bodyHtmlRef.current = next;
      setBodyHtml(next);
    },
    [bodyHtmlRef, lang, setBodyHtml],
  );

  const removeExplainNote = useCallback(
    (noteId: string) => {
      const next = deleteExplainNoteFromBodyHtml(bodyHtmlRef.current, noteId);
      if (next === bodyHtmlRef.current) return;
      bodyHtmlRef.current = next;
      setBodyHtml(next);
    },
    [bodyHtmlRef, setBodyHtml],
  );

  const updateExplainNote = useCallback(
    (
      noteId: string,
      payload: {
        term: string;
        contextSense: string;
        grammar?: string;
        mood?: string;
      },
    ) => {
      const next = updateExplainNoteInBodyHtml(bodyHtmlRef.current, noteId, payload, lang);
      if (next === bodyHtmlRef.current) return;
      bodyHtmlRef.current = next;
      setBodyHtml(next);
    },
    [bodyHtmlRef, lang, setBodyHtml],
  );

  const ensureExplainNoteIds = useCallback(() => {
    const next = ensureExplainNoteIdsInBodyHtml(bodyHtmlRef.current);
    if (next === bodyHtmlRef.current) return;
    bodyHtmlRef.current = next;
    setBodyHtml(next);
  }, [bodyHtmlRef, setBodyHtml]);

  const ensureStudyItemIds = useCallback(() => {
    const next = ensureStudyItemIdsInBodyHtml(bodyHtmlRef.current);
    if (next === bodyHtmlRef.current) return;
    bodyHtmlRef.current = next;
    setBodyHtml(next);
  }, [bodyHtmlRef, setBodyHtml]);

  const removeStudyItem = useCallback(
    (itemId: string) => {
      const next = deleteStudyItemFromBodyHtml(bodyHtmlRef.current, itemId);
      if (next === bodyHtmlRef.current) return;
      bodyHtmlRef.current = next;
      setBodyHtml(next);
    },
    [bodyHtmlRef, setBodyHtml],
  );

  const updateVocabItem = useCallback(
    (
      itemId: string,
      payload: {
        term: string;
        meaning: string;
        example: string;
        translation: string;
      },
    ) => {
      const next = updateVocabItemInBodyHtml(bodyHtmlRef.current, itemId, payload);
      if (next === bodyHtmlRef.current) return;
      bodyHtmlRef.current = next;
      setBodyHtml(next);
    },
    [bodyHtmlRef, setBodyHtml],
  );

  const updateGrammarItem = useCallback(
    (
      itemId: string,
      payload: {
        titlePrimary: string;
        titleSecondary: string;
        detail: string;
        example: string;
        translation: string;
      },
    ) => {
      const next = updateGrammarItemInBodyHtml(bodyHtmlRef.current, itemId, payload);
      if (next === bodyHtmlRef.current) return;
      bodyHtmlRef.current = next;
      setBodyHtml(next);
    },
    [bodyHtmlRef, setBodyHtml],
  );

  const appendGrammarStudyItem = useCallback(
    (payload: {
      id: string;
      titlePrimary: string;
      titleSecondary: string;
      detail: string;
      example: string;
      translation: string;
    }) => {
      const next = commitGrammarStudyItemToBody(bodyHtmlRef.current, payload, lang);
      bodyHtmlRef.current = next;
      setBodyHtml(next);
    },
    [bodyHtmlRef, lang, setBodyHtml],
  );

  const typographyValue: PosterTypographyContextValue = useMemo(
    () => ({
      showRubyAnnotations,
      previewTypography,
      repaginating,
      rubyToggleSupported,
      posterRenderOpts,
      backgroundId,
      handleShowRubyChange,
      handleBackgroundChange,
    }),
    [
      showRubyAnnotations,
      previewTypography,
      repaginating,
      rubyToggleSupported,
      posterRenderOpts,
      backgroundId,
      handleShowRubyChange,
      handleBackgroundChange,
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
      isOpeningProject,
      handleSave,
      handleExportPdf: exportCtrl.handleExportPdf,
      appendExplainNote,
      removeExplainNote,
      updateExplainNote,
      ensureExplainNoteIds,
      ensureStudyItemIds,
      removeStudyItem,
      updateVocabItem,
      updateGrammarItem,
      appendGrammarStudyItem,
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
      isOpeningProject,
      handleSave,
      appendExplainNote,
      removeExplainNote,
      updateExplainNote,
      ensureExplainNoteIds,
      ensureStudyItemIds,
      removeStudyItem,
      updateVocabItem,
      updateGrammarItem,
      appendGrammarStudyItem,
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
          <PosterWorkspaceContext.Provider value={legacyValue}>{children}</PosterWorkspaceContext.Provider>
        </PosterInkContext.Provider>
      </PosterTypographyContext.Provider>
    </PosterDocumentContext.Provider>
  );
}
