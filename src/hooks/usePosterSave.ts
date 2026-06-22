import { useCallback, useState, type RefObject } from 'react';
import type { LangCode } from '../services/appSettings';
import { saveLyricsProject } from '../services/savedLyricsStore';
import { replaceStudyCardsForBundle } from '../services/studyCardsStore';
import { trySyncStudyCardsFromRaw } from '../studyCards/syncStudyCards';
import { rawLyricsHasStudyCardSections } from '../studyCards/extractStudyCards';
import { hapticError, hapticSuccess } from './useHaptics';
import { ensurePosterFontsLoaded } from '../utils/shufuriPoster/fonts';
import { buildPosterPagesFromBody, posterPageHtmls } from '../utils/shufuriPoster/buildPosterPages';
import {
  prepareBodyHtmlForPreview,
  prepareTitleMarkupHtml,
} from '../utils/inkEditUtils';
import { resetPosterPageRefs } from '../utils/posterPageRefs';
import { resolveExportTitle } from '../utils/shufuriPoster/posterTitle';
import { resolveDocumentLang } from '../services/documentLang';
import type {
  PosterLayoutProfile,
  PosterPageSlice,
  PosterRenderOptions,
} from '../utils/shufuriPoster/types';
import type { AppMode } from './usePosterWorkspace';
import type { ShowAppToast } from '../context/AppToastContext';

type Options = {
  mode: AppMode;
  bodyHtml: string;
  title: string;
  artist: string;
  lyrics: string;
  layoutProfile: PosterLayoutProfile;
  lang: LangCode | undefined;
  titleMarkupHtml: string | undefined;
  savedProjectId: string | null;
  lyricsLanguage: import('../services/appSettings').LyricsLanguage;
  posterRenderOpts: PosterRenderOptions;
  defaultIncludeVocabAndGrammar: boolean;
  studyCardsBundleIdRef: RefObject<string>;
  lyricsRef: RefObject<string>;
  pageRefs: RefObject<(HTMLDivElement | null)[]>;
  setPages: (pages: PosterPageSlice[]) => void;
  setSavedProjectId: (id: string) => void;
  showToast: ShowAppToast;
  onLibrarySaved: () => void;
};

export function usePosterSave({
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
}: Options) {
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!bodyHtml.trim() || saving) {
      return;
    }
    setSaving(true);
    try {
      await ensurePosterFontsLoaded();
      const slices = buildPosterPagesFromBody(
        bodyHtml,
        title,
        layoutProfile,
        artist,
        lyricsLanguage,
        lang,
        titleMarkupHtml,
        posterRenderOpts,
      );
      const pageHtmls = posterPageHtmls(slices);
      if (mode === 'export') {
        setPages(slices);
        resetPosterPageRefs(pageRefs, slices.length);
      }
      const cleanedBody = prepareBodyHtmlForPreview(bodyHtml);
      const cleanedTitleMarkup = prepareTitleMarkupHtml(titleMarkupHtml);
      const documentLang = resolveDocumentLang(lang, bodyHtml, lyricsLanguage);
      const saved = await saveLyricsProject({
        id: savedProjectId ?? undefined,
        title: resolveExportTitle(title),
        artist: artist.trim() || undefined,
        rawLyrics: lyricsRef.current.trim() || lyrics,
        bodyHtml: cleanedBody,
        pageHtmls,
        layoutProfile,
        lang: documentLang,
        includeVocabAndGrammar: defaultIncludeVocabAndGrammar,
        ...(cleanedTitleMarkup ? { titleMarkupHtml: cleanedTitleMarkup } : {}),
      });
      setSavedProjectId(saved.id);
      const sessionBundleId = studyCardsBundleIdRef.current;
      const rawForSync = saved.rawLyrics?.trim() || lyricsRef.current.trim() || lyrics.trim();
      const written = await trySyncStudyCardsFromRaw({
        rawLyrics: rawForSync,
        bundleId: saved.id,
        title: resolveExportTitle(title),
        artist: artist.trim() || undefined,
        lang: documentLang,
        includeVocabAndGrammar:
          saved.includeVocabAndGrammar ?? defaultIncludeVocabAndGrammar,
      });
      studyCardsBundleIdRef.current = saved.id;
      if (sessionBundleId.startsWith('session-') && sessionBundleId !== saved.id) {
        await replaceStudyCardsForBundle(sessionBundleId, []);
      }
      const includeCards =
        saved.includeVocabAndGrammar ?? defaultIncludeVocabAndGrammar;
      if (written > 0) {
        showToast(`已同步 ${written} 张学习卡`, 2400);
      } else if (
        includeCards &&
        rawForSync &&
        rawLyricsHasStudyCardSections(rawForSync)
      ) {
        showToast('词卡同步失败，请打开控制台查看 [study-cards]', 3200);
      }
      onLibrarySaved();
      showToast('已保存到我的歌词库', 2400);
      hapticSuccess();
    } catch (e) {
      hapticError();
      alert(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }, [
    bodyHtml,
    mode,
    savedProjectId,
    title,
    artist,
    lyrics,
    layoutProfile,
    saving,
    showToast,
    titleMarkupHtml,
    lyricsLanguage,
    lang,
    posterRenderOpts,
    defaultIncludeVocabAndGrammar,
    onLibrarySaved,
    setPages,
    pageRefs,
    setSavedProjectId,
    studyCardsBundleIdRef,
    lyricsRef,
  ]);

  return { saving, handleSave };
}
