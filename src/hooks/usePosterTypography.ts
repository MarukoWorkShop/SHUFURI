import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LangCode, LyricsLanguage } from '../services/appSettings';
import { ensurePosterFontsLoaded } from '../utils/shufuriPoster/fonts';
import { buildPosterPagesFromBody } from '../utils/shufuriPoster/buildPosterPages';
import { resetPosterPageRefs } from '../utils/posterPageRefs';
import {
  resolvePosterPipelineLang,
  resolvePosterRubyToggleSupported,
} from '../utils/shufuriPoster/inferPosterLang';
import {
  DEFAULT_PREVIEW_TYPOGRAPHY,
  buildPosterRenderOptions,
  type PosterLayoutProfile,
  type PosterPageSlice,
  type PreviewTypography,
} from '../utils/shufuriPoster/types';
import type { AppMode } from './usePosterWorkspace';

type Options = {
  mode: AppMode;
  lang: LangCode | undefined;
  bodyHtml: string;
  title: string;
  artist: string;
  layoutProfile: PosterLayoutProfile;
  titleMarkupHtml: string | undefined;
  lyricsLanguage: LyricsLanguage;
  setPages: (pages: PosterPageSlice[]) => void;
  pageRefs: { current: (HTMLDivElement | null)[] };
  onResetInkShowRuby?: () => void;
};

export function usePosterTypography({
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
  onResetInkShowRuby,
}: Options) {
  const [showRubyAnnotations, setShowRubyAnnotations] = useState(true);
  const [previewTypography, setPreviewTypography] = useState<PreviewTypography>(
    DEFAULT_PREVIEW_TYPOGRAPHY,
  );
  const [repaginating, setRepaginating] = useState(false);
  const repaginateDebounceRef = useRef<number | null>(null);

  const posterPipelineLang = useMemo(
    () => resolvePosterPipelineLang(lang, bodyHtml, lyricsLanguage),
    [lang, bodyHtml, lyricsLanguage],
  );
  const rubyToggleSupported = useMemo(
    () => resolvePosterRubyToggleSupported(lang, bodyHtml, lyricsLanguage),
    [lang, bodyHtml, lyricsLanguage],
  );
  const posterRenderOpts = useMemo(
    () => buildPosterRenderOptions(showRubyAnnotations, previewTypography),
    [showRubyAnnotations, previewTypography],
  );

  const rebuildExportPages = useCallback(async () => {
    if (!bodyHtml.trim()) {
      setPages([]);
      resetPosterPageRefs(pageRefs, 0);
      return;
    }
    setRepaginating(true);
    try {
      await ensurePosterFontsLoaded();
      const pageHtmls = buildPosterPagesFromBody(
        bodyHtml,
        title,
        layoutProfile,
        artist,
        lyricsLanguage,
        lang,
        titleMarkupHtml,
        buildPosterRenderOptions(showRubyAnnotations, previewTypography),
      );
      setPages(pageHtmls);
      resetPosterPageRefs(pageRefs, pageHtmls.length);
    } finally {
      setRepaginating(false);
    }
  }, [
    bodyHtml,
    title,
    layoutProfile,
    artist,
    lyricsLanguage,
    lang,
    titleMarkupHtml,
    showRubyAnnotations,
    previewTypography,
    setPages,
    pageRefs,
  ]);

  const scheduleRebuildExportPages = useCallback(() => {
    if (repaginateDebounceRef.current != null) {
      window.clearTimeout(repaginateDebounceRef.current);
    }
    repaginateDebounceRef.current = window.setTimeout(() => {
      repaginateDebounceRef.current = null;
      void rebuildExportPages();
    }, 300);
  }, [rebuildExportPages]);

  const handleShowRubyChange = useCallback(
    (next: boolean) => {
      setShowRubyAnnotations(next);
      if (mode === 'export') {
        void rebuildExportPages();
      }
    },
    [mode, rebuildExportPages],
  );

  const resetTypographyPreview = useCallback(() => {
    setShowRubyAnnotations(true);
    setPreviewTypography(DEFAULT_PREVIEW_TYPOGRAPHY);
    onResetInkShowRuby?.();
  }, [onResetInkShowRuby]);

  useEffect(() => {
    return () => {
      if (repaginateDebounceRef.current != null) {
        window.clearTimeout(repaginateDebounceRef.current);
      }
    };
  }, []);

  return {
    showRubyAnnotations,
    previewTypography,
    setPreviewTypography,
    repaginating,
    posterPipelineLang,
    rubyToggleSupported,
    posterRenderOpts,
    rebuildExportPages,
    scheduleRebuildExportPages,
    handleShowRubyChange,
    resetTypographyPreview,
  };
}
