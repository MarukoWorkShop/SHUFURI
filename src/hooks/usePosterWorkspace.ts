import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { LangCode, LyricsLanguage } from '../services/appSettings';
import type { SavedLyricsProject } from '../services/savedLyricsStore';
import { createStudyCardsBundleId } from '../studyCards/syncStudyCards';
import { resolveDocumentLang } from '../services/documentLang';
import { ensurePosterFontsLoaded } from '../utils/shufuriPoster/fonts';
import { buildPosterPagesFromBody } from '../utils/shufuriPoster/buildPosterPages';
import { resetPosterPageRefs } from '../utils/posterPageRefs';
import {
  prepareBodyHtmlForPreview,
  prepareTitleMarkupHtml,
} from '../utils/inkEditUtils';
import type { SetContentPayload } from '../bridge/nativeBridge';
import type {
  PosterLayoutProfile,
  PosterPageSlice,
  PosterRenderOptions,
} from '../utils/shufuriPoster/types';

export type AppMode = 'input' | 'edit' | 'export';

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

type UsePosterWorkspaceOptions = {
  editLayoutProfile: PosterLayoutProfile;
  lyricsLanguage: LyricsLanguage;
  getPosterRenderOpts: () => PosterRenderOptions;
  defaultIncludeVocabAndGrammar: boolean;
  studyCardsBundleIdRef: RefObject<string>;
  syncStudyCardsFromRaw: SyncStudyCardsFn;
  pageRefs: RefObject<(HTMLDivElement | null)[]>;
  onAfterEnterEdit: () => void;
  onAfterReset: () => void;
};

export function usePosterWorkspace({
  editLayoutProfile,
  lyricsLanguage,
  getPosterRenderOpts,
  defaultIncludeVocabAndGrammar,
  studyCardsBundleIdRef,
  syncStudyCardsFromRaw,
  pageRefs,
  onAfterEnterEdit,
  onAfterReset,
}: UsePosterWorkspaceOptions) {
  const [mode, setMode] = useState<AppMode>('input');
  const [lyrics, setLyrics] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [pages, setPages] = useState<PosterPageSlice[]>([]);
  const [layoutProfile, setLayoutProfile] = useState<PosterLayoutProfile>(() => editLayoutProfile);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [lang, setLang] = useState<LangCode | undefined>(undefined);
  const [titleMarkupHtml, setTitleMarkupHtml] = useState<string | undefined>(undefined);

  const bodyHtmlRef = useRef('');
  const titleRef = useRef('');
  const artistRef = useRef('');
  const pagesRef = useRef<PosterPageSlice[]>([]);
  const layoutProfileRef = useRef<PosterLayoutProfile>(editLayoutProfile);
  const lyricsRef = useRef('');

  useEffect(() => { bodyHtmlRef.current = bodyHtml; }, [bodyHtml]);
  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { artistRef.current = artist; }, [artist]);
  useEffect(() => { layoutProfileRef.current = layoutProfile; }, [layoutProfile]);
  useEffect(() => { pagesRef.current = pages; }, [pages]);
  useEffect(() => { lyricsRef.current = lyrics; }, [lyrics]);

  const enterEditWithLayout = useCallback(
    async (
      nextBodyHtml: string,
      nextTitle: string,
      nextLyrics: string,
      exportProfile: PosterLayoutProfile,
      projectId: string | null,
      nextArtist?: string,
      nextLang?: LangCode,
      nextTitleMarkupHtml?: string,
    ) => {
      await ensurePosterFontsLoaded();
      const normalized = prepareBodyHtmlForPreview(nextBodyHtml);
      const trimmedTitle = nextTitle.trim();
      const trimmedArtist = nextArtist?.trim() || '';
      const preparedTitleMarkup = prepareTitleMarkupHtml(nextTitleMarkupHtml);
      const resolvedLang =
        nextLang ?? resolveDocumentLang(undefined, nextBodyHtml, lyricsLanguage);
      titleRef.current = trimmedTitle;
      artistRef.current = trimmedArtist;
      bodyHtmlRef.current = normalized;
      lyricsRef.current = nextLyrics;
      layoutProfileRef.current = exportProfile;
      setTitle(trimmedTitle);
      setArtist(trimmedArtist);
      setBodyHtml(normalized);
      setLyrics(nextLyrics);
      setLayoutProfile(exportProfile);
      setPages([]);
      setMode('edit');
      setSavedProjectId(projectId);
      setLang(resolvedLang);
      setTitleMarkupHtml(preparedTitleMarkup);
      onAfterEnterEdit();
      resetPosterPageRefs(pageRefs, 0);
    },
    [onAfterEnterEdit, pageRefs, lyricsLanguage],
  );

  const enterExportFlow = useCallback(async () => {
    if (!bodyHtml.trim()) return;
    await ensurePosterFontsLoaded();
    const pageHtmls = buildPosterPagesFromBody(
      bodyHtml,
      title,
      editLayoutProfile,
      artist,
      lyricsLanguage,
      lang,
      titleMarkupHtml,
      getPosterRenderOpts(),
    );
    setLayoutProfile(editLayoutProfile);
    setPages(pageHtmls);
    setMode('export');
    resetPosterPageRefs(pageRefs, pageHtmls.length);
  }, [
    bodyHtml,
    title,
    artist,
    lyricsLanguage,
    lang,
    titleMarkupHtml,
    getPosterRenderOpts,
    editLayoutProfile,
    pageRefs,
  ]);

  const openProject = useCallback(
    async (project: SavedLyricsProject) => {
      const profile = project.layoutProfile ?? editLayoutProfile;
      studyCardsBundleIdRef.current = project.id;
      await syncStudyCardsFromRaw(project.rawLyrics, project.id, {
        title: project.title,
        artist: project.artist,
        lang: project.lang,
        includeVocabAndGrammar: project.includeVocabAndGrammar,
      });
      await enterEditWithLayout(
        project.bodyHtml,
        project.title,
        project.rawLyrics,
        profile,
        project.id,
        project.artist,
        project.lang,
        project.titleMarkupHtml,
      );
    },
    [enterEditWithLayout, syncStudyCardsFromRaw, studyCardsBundleIdRef, editLayoutProfile],
  );

  const handleLayoutFromHtml = useCallback(
    async (
      nextBodyHtml: string,
      nextTitle: string,
      rawPaste: string,
      nextArtist?: string,
      nextLang?: LangCode,
    ) => {
      studyCardsBundleIdRef.current = createStudyCardsBundleId();
      const bundleId = studyCardsBundleIdRef.current;
      await enterEditWithLayout(
        nextBodyHtml,
        nextTitle,
        rawPaste,
        editLayoutProfile,
        null,
        nextArtist,
        nextLang,
      );
      await syncStudyCardsFromRaw(rawPaste, bundleId, {
        title: nextTitle,
        artist: nextArtist,
        lang: nextLang,
        includeVocabAndGrammar: defaultIncludeVocabAndGrammar,
      });
    },
    [
      enterEditWithLayout,
      syncStudyCardsFromRaw,
      defaultIncludeVocabAndGrammar,
      studyCardsBundleIdRef,
      editLayoutProfile,
    ],
  );

  const handleLayoutChange = useCallback(
    async (profile: PosterLayoutProfile) => {
      if (profile === layoutProfile || !bodyHtml.trim()) return;
      await ensurePosterFontsLoaded();
      const pageHtmls = buildPosterPagesFromBody(
        bodyHtml,
        title,
        profile,
        artist,
        lyricsLanguage,
        lang,
        titleMarkupHtml,
        getPosterRenderOpts(),
      );
      setLayoutProfile(profile);
      setPages(pageHtmls);
      resetPosterPageRefs(pageRefs, pageHtmls.length);
    },
    [
      layoutProfile,
      bodyHtml,
      title,
      artist,
      lyricsLanguage,
      lang,
      titleMarkupHtml,
      getPosterRenderOpts,
      pageRefs,
    ],
  );

  const handleBackToEdit = useCallback(() => {
    setMode('edit');
  }, []);

  const handleReset = useCallback(() => {
    titleRef.current = '';
    artistRef.current = '';
    bodyHtmlRef.current = '';
    lyricsRef.current = '';
    layoutProfileRef.current = editLayoutProfile;
    pagesRef.current = [];
    setMode('input');
    setLyrics('');
    setTitle('');
    setArtist('');
    setBodyHtml('');
    setPages([]);
    setLayoutProfile(editLayoutProfile);
    setSavedProjectId(null);
    setLang(undefined);
    setTitleMarkupHtml(undefined);
    onAfterReset();
    resetPosterPageRefs(pageRefs, 0);
  }, [editLayoutProfile, onAfterReset, pageRefs]);

  /** 原生桥 set_content：与剪贴板粘贴共用 enterEditWithLayout + 词卡同步 */
  const enterWorkspaceFromBridge = useCallback(
    async (payload: SetContentPayload) => {
      const { bodyHtml: bh, rawText: rt, title: t, layoutProfile: lp } = payload;
      const trimmedRaw = rt?.trim() ?? '';

      if (trimmedRaw) {
        const { preparePasteForLayout } = await import('../services/lyricsHtml');
        const prepared = preparePasteForLayout(trimmedRaw);
        studyCardsBundleIdRef.current = createStudyCardsBundleId();
        const bundleId = studyCardsBundleIdRef.current;
        await enterEditWithLayout(
          prepared.bodyHtml,
          prepared.title || t,
          trimmedRaw,
          lp,
          null,
          prepared.artist,
          prepared.lang,
        );
        await syncStudyCardsFromRaw(trimmedRaw, bundleId, {
          title: prepared.title || t,
          artist: prepared.artist,
          lang: prepared.lang,
          includeVocabAndGrammar: defaultIncludeVocabAndGrammar,
        });
        return;
      }

      const trimmedBody = bh?.trim() ?? '';
      if (!trimmedBody) {
        throw new Error('set_content 缺少 bodyHtml 或 rawText');
      }

      await enterEditWithLayout(trimmedBody, t, '', lp, null);
    },
    [
      enterEditWithLayout,
      syncStudyCardsFromRaw,
      defaultIncludeVocabAndGrammar,
      studyCardsBundleIdRef,
    ],
  );

  return {
    mode,
    setMode,
    lyrics,
    title,
    artist,
    bodyHtml,
    setBodyHtml,
    pages,
    setPages,
    layoutProfile,
    setLayoutProfile,
    savedProjectId,
    setSavedProjectId,
    lang,
    titleMarkupHtml,
    setTitleMarkupHtml,
    setTitle,
    setArtist,
    refs: {
      bodyHtmlRef,
      titleRef,
      artistRef,
      pagesRef,
      layoutProfileRef,
      lyricsRef,
    },
    enterEditWithLayout,
    enterWorkspaceFromBridge,
    enterExportFlow,
    openProject,
    handleLayoutFromHtml,
    handleLayoutChange,
    handleBackToEdit,
    handleReset,
  };
}
