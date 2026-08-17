import { useCallback, useState, type RefObject } from 'react';
import type { LangCode } from '../services/appSettings';
import { saveLyricsProject } from '../services/savedLyricsStore';
import { replaceStudyCardsForBundle } from '../services/studyCardsStore';
import {
  tryMigrateStudyCardsBundle,
  trySyncStudyCardsFromRaw,
} from '../studyCards/syncStudyCards';
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
import { L } from '../utils/i18n';
import type {
  PosterLayoutProfile,
  PosterPageSlice,
  PosterRenderOptions,
} from '../utils/shufuriPoster/types';
import type { AppMode } from './usePosterWorkspace';
import type { ShowAppToast } from '../context/AppToastContext';

function createSavedProjectId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

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
  defaultPedagogicalLevel: import('../services/appSettings').PedagogicalLevel;
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
  defaultPedagogicalLevel,
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
      const cleanedBody = prepareBodyHtmlForPreview(bodyHtml);
      const cleanedTitleMarkup = prepareTitleMarkupHtml(titleMarkupHtml);
      const documentLang = resolveDocumentLang(lang, bodyHtml, lyricsLanguage);
      const exportTitle = resolveExportTitle(title);
      const rawForSync = lyricsRef.current.trim() || lyrics.trim();
      const projectId = savedProjectId ?? createSavedProjectId();
      const sessionBundleId = studyCardsBundleIdRef.current;

      // 词卡先于字体/分页写入，避免保存成功但词卡被跳过或 session 被误清空
      let written = await trySyncStudyCardsFromRaw({
        rawLyrics: rawForSync,
        bundleId: projectId,
        title: exportTitle,
        artist: artist.trim() || undefined,
        lang: documentLang,
        includeVocabAndGrammar: defaultIncludeVocabAndGrammar,
      });
      if (sessionBundleId.startsWith('session-') && sessionBundleId !== projectId) {
        if (written > 0) {
          await replaceStudyCardsForBundle(sessionBundleId, []);
        } else {
          const migrated = await tryMigrateStudyCardsBundle(sessionBundleId, projectId);
          written = Math.max(written, migrated);
        }
      }
      studyCardsBundleIdRef.current = projectId;

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

      const saved = await saveLyricsProject({
        id: projectId,
        title: exportTitle,
        artist: artist.trim() || undefined,
        rawLyrics: rawForSync,
        bodyHtml: cleanedBody,
        pageHtmls,
        layoutProfile,
        lang: documentLang,
        includeVocabAndGrammar: defaultIncludeVocabAndGrammar,
        pedagogicalLevel: defaultIncludeVocabAndGrammar ? defaultPedagogicalLevel : undefined,
        ...(cleanedTitleMarkup ? { titleMarkupHtml: cleanedTitleMarkup } : {}),
      });
      setSavedProjectId(saved.id);

      const includeCards =
        saved.includeVocabAndGrammar ?? defaultIncludeVocabAndGrammar;
      if (written > 0) {
        showToast(L(`已同步学习卡到「我的学习卡」`, `Synced study cards to My Study Cards`), 2400);
      } else if (
        (includeCards || rawLyricsHasStudyCardSections(rawForSync)) &&
        rawForSync &&
        rawLyricsHasStudyCardSections(rawForSync)
      ) {
        showToast(
          L('词卡同步失败，请打开控制台查看 [study-cards]', 'Failed to sync study cards. Check [study-cards] in the console.'),
          3200,
        );
      }
      onLibrarySaved();
      showToast(L('已保存到我的歌词库', 'Saved to My Lyrics.'), 2400);
      hapticSuccess();
    } catch (e) {
      hapticError();
      showToast(e instanceof Error ? e.message : L('保存失败', 'Failed to save.'), 5000);
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
    defaultPedagogicalLevel,
    onLibrarySaved,
    setPages,
    pageRefs,
    setSavedProjectId,
    studyCardsBundleIdRef,
    lyricsRef,
  ]);

  return { saving, handleSave };
}
