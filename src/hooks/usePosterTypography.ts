import { useCallback, useMemo, useState } from 'react';
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
} from '../utils/shufuriPoster/types';
import { DEFAULT_POSTER_BACKGROUND_ID } from '../config/posterBackgrounds';
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

/**
 * 导出密度（字号/行距倍率）固定为默认 100%；
 * mobilePoster 的行距基准已对齐编辑页 Kami，分页仍可按 spacingScale 弹性收紧。
 * PDF/预览共用同一套 buildPosterRenderOptions + 分页管线。
 */
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
  const [repaginating, setRepaginating] = useState(false);
  const [backgroundId, setBackgroundId] = useState(DEFAULT_POSTER_BACKGROUND_ID);
  const previewTypography = DEFAULT_PREVIEW_TYPOGRAPHY;

  const posterPipelineLang = useMemo(
    () => resolvePosterPipelineLang(lang, bodyHtml, lyricsLanguage),
    [lang, bodyHtml, lyricsLanguage],
  );
  const rubyToggleSupported = useMemo(
    () => resolvePosterRubyToggleSupported(lang, bodyHtml, lyricsLanguage),
    [lang, bodyHtml, lyricsLanguage],
  );
  const posterRenderOpts = useMemo(
    () => buildPosterRenderOptions(showRubyAnnotations, previewTypography, backgroundId),
    [showRubyAnnotations, previewTypography, backgroundId],
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
        buildPosterRenderOptions(showRubyAnnotations, previewTypography, backgroundId),
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
    backgroundId,
    setPages,
    pageRefs,
  ]);

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
    setBackgroundId(DEFAULT_POSTER_BACKGROUND_ID);
    onResetInkShowRuby?.();
  }, [onResetInkShowRuby]);

  const handleBackgroundChange = useCallback(
    (nextId: string) => {
      setBackgroundId(nextId);
      if (mode === 'export') {
        void rebuildExportPages();
      }
    },
    [mode, rebuildExportPages],
  );

  return {
    showRubyAnnotations,
    previewTypography,
    repaginating,
    posterPipelineLang,
    rubyToggleSupported,
    posterRenderOpts,
    backgroundId,
    setBackgroundId,
    rebuildExportPages,
    handleShowRubyChange,
    handleBackgroundChange,
    resetTypographyPreview,
  };
}
