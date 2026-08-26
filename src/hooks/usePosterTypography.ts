import { useCallback, useEffect, useMemo, useState } from 'react';
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
  DEFAULT_POSTER_LAYOUT_VARIANT,
  type PosterLayoutProfile,
  type PosterLayoutVariant,
  type PosterPageSlice,
} from '../utils/shufuriPoster/types';
import { DEFAULT_POSTER_BACKGROUND_ID } from '../config/posterBackgrounds';
import { setRenderOptsBridge } from '../utils/shufuriPoster/posterRenderOptsBridge';
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
  const [layoutVariant, setLayoutVariant] = useState<PosterLayoutVariant>(DEFAULT_POSTER_LAYOUT_VARIANT);
  const [minimalImageUrl, setMinimalImageUrl] = useState('');
  const previewTypography = DEFAULT_PREVIEW_TYPOGRAPHY;

  const posterPipelineLang = useMemo(
    () => resolvePosterPipelineLang(lang, bodyHtml, lyricsLanguage),
    [lang, bodyHtml, lyricsLanguage],
  );
  const rubyToggleSupported = useMemo(
    () => resolvePosterRubyToggleSupported(lang, bodyHtml, lyricsLanguage),
    [lang, bodyHtml, lyricsLanguage],
  );

  // 同步最新版式/背景/图片到桥接，供父层 getPosterRenderOpts 读取（enterExportFlow /
  // handleLayoutChange / handleSave 重分页时使用），避免分栏被回退为标准单栏 HTML。
  useEffect(() => {
    setRenderOptsBridge(layoutVariant, backgroundId, minimalImageUrl);
  }, [layoutVariant, backgroundId, minimalImageUrl]);
  const posterRenderOpts = useMemo(
    () =>
      buildPosterRenderOptions(
        showRubyAnnotations,
        previewTypography,
        backgroundId,
        layoutVariant,
        minimalImageUrl,
      ),
    [showRubyAnnotations, previewTypography, backgroundId, layoutVariant, minimalImageUrl],
  );

  const rebuildExportPages = useCallback(
    async (overrideLayoutVariant?: PosterLayoutVariant) => {
      const effectiveVariant = overrideLayoutVariant ?? layoutVariant;
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
          buildPosterRenderOptions(
            showRubyAnnotations,
            previewTypography,
            backgroundId,
            effectiveVariant,
            minimalImageUrl,
          ),
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
    layoutVariant,
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
    setLayoutVariant(DEFAULT_POSTER_LAYOUT_VARIANT);
    setMinimalImageUrl('');
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

  const handleMinimalImageChange = useCallback(
    (nextUrl: string) => {
      setMinimalImageUrl(nextUrl);
      if (mode === 'export') {
        void rebuildExportPages();
      }
    },
    [mode, rebuildExportPages],
  );

  const handleLayoutVariantChange = useCallback(
    (next: PosterLayoutVariant) => {
      setLayoutVariant(next);
      // 版式变体会改变分页 HTML 结构（split 需要 fv-split-root 双栏），
      // 必须立即用新 variant 重新分页；否则预览仍是旧的单栏 HTML，CSS 皮肤无的放矢。
      // 编辑与导出两种模式都消费同一份 pages，故两种模式均重建。
      void rebuildExportPages(next);
    },
    [rebuildExportPages],
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
    layoutVariant,
    minimalImageUrl,
    rebuildExportPages,
    handleShowRubyChange,
    handleBackgroundChange,
    handleLayoutVariantChange,
    handleMinimalImageChange,
    resetTypographyPreview,
  };
}
