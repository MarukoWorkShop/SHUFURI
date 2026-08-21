import type { PosterLayoutProfile, PosterLayoutVariant } from './types.ts';
import { dimForFuriganaPoster } from './dimensions.ts';
import type { LyricsLanguage, LangCode, ColorTheme } from '../../services/appSettings.ts';
import {
  resolvePosterTypography,
  resolveLangFromOptions,
  compilePosterCss,
  compileEditCssOverrides,
} from '../posterTypography/index.ts';
import { POSTER_BG_COLOR } from '../posterTypography/typographyConstants.ts';
import { WATERMARK_TEXT_CLEARANCE_PX, watermarkDesignScale } from './posterWatermark.ts';

export { dimForFuriganaPoster };

/**
 * 导出/测量共享的栅格化安全 CSS。
 * html2canvas 1.4.x 用拉丁样本 "Hidden Text" 测 font baseline，对 CJK 基线常偏大，
 * 字形画到行盒下方；任一祖先 overflow≠visible 都会把下半截裁掉（中文行底部切边）。
 * 通过 overflow:visible + padding-bottom + 抬高 line-height 补偿。
 * 关键：createPosterMeasurer 也注入此规则并给 shell 设 data-export-raster="1"，
 * 使分页测量的行高与导出栅格化完全一致，避免"测能装下、导出溢出压水印"。
 */
export const RASTER_SAFE_CSS = `
.fv-html-poster-root[data-export-raster="1"],
.fv-html-poster-root[data-export-raster="1"] .fv-body-h,
.fv-html-poster-root[data-export-raster="1"] .lyrics-group,
.fv-html-poster-root[data-export-raster="1"] .lyrics-group .jp-line,
.fv-html-poster-root[data-export-raster="1"] .lyrics-group .ko-line,
.fv-html-poster-root[data-export-raster="1"] .lyrics-group .zh-line,
.fv-html-poster-root[data-export-raster="1"] .lyrics-group .cn-line,
.fv-html-poster-root[data-export-raster="1"] .lyrics-group .gloss-line,
.fv-html-poster-root[data-export-raster="1"] .lyrics-pagination-unit,
.fv-html-poster-root[data-export-raster="1"] .lyrics-pagination-unit .vocab-line1,
.fv-html-poster-root[data-export-raster="1"] .lyrics-pagination-unit .vocab-ex-ja,
.fv-html-poster-root[data-export-raster="1"] .lyrics-pagination-unit .vocab-ex-ko,
.fv-html-poster-root[data-export-raster="1"] .lyrics-pagination-unit .vocab-ex-zh,
.fv-html-poster-root[data-export-raster="1"] .lyrics-pagination-unit .vocab-ex-cn,
.fv-html-poster-root[data-export-raster="1"] .lyrics-pagination-unit .vocab-ex-gloss,
.fv-html-poster-root[data-export-raster="1"] .lyrics-pagination-unit h3.grammar-point-title,
.fv-html-poster-root[data-export-raster="1"] .lyrics-pagination-unit .grammar-detail,
.fv-html-poster-root[data-export-raster="1"] .lyrics-pagination-unit .grammar-ex-ja,
.fv-html-poster-root[data-export-raster="1"] .lyrics-pagination-unit .grammar-ex-ko,
.fv-html-poster-root[data-export-raster="1"] .lyrics-pagination-unit .grammar-ex-zh,
.fv-html-poster-root[data-export-raster="1"] .lyrics-pagination-unit .grammar-ex-cn,
.fv-html-poster-root[data-export-raster="1"] .lyrics-pagination-unit .grammar-ex-gloss {
  overflow: visible !important;
}
.fv-html-poster-root[data-export-raster="1"] .lyrics-group .jp-line,
.fv-html-poster-root[data-export-raster="1"] .lyrics-group .ko-line,
.fv-html-poster-root[data-export-raster="1"] .lyrics-group .zh-line,
.fv-html-poster-root[data-export-raster="1"] .lyrics-group .cn-line,
.fv-html-poster-root[data-export-raster="1"] .lyrics-group .gloss-line {
  padding-bottom: 0.22em !important;
  line-height: 1.55 !important;
}
.fv-html-poster-root[data-export-raster="1"] .lyrics-group .zh-line,
.fv-html-poster-root[data-export-raster="1"] .lyrics-group .zh-line * {
  line-height: 1.55 !important;
}
`;

/** 画布宽高 */
export function getFuriganaPosterCanvasDimensions(profile: PosterLayoutProfile): {
  width: number;
  height: number;
} {
  const d = dimForFuriganaPoster(profile);
  return { width: d.canvasWidth, height: d.canvasHeight };
}

/** 画布内边距 */
export function getFuriganaCanvasInsets(profile: PosterLayoutProfile) {
  const d = dimForFuriganaPoster(profile);
  return {
    top: d.pagePadTopCont,
    right: d.padH,
    bottom: d.pageBottomDefault,
    left: d.padH,
  };
}

/** 页码区预留高度（供分页测量）。
 *  返回"水印文字安全距离（缩放后）+ 正文底部内边距"，确保分页测量时为正文
 *  预留出与水印文字不重叠的空间，修复导出时最后一行歌词压到水印的问题。 */
export function getFuriganaPageNumberReservePx(profile: PosterLayoutProfile): number {
  const clearance = Math.round(WATERMARK_TEXT_CLEARANCE_PX * watermarkDesignScale(profile));
  const bodyPad = getFuriganaBodyBottomPaddingPx(profile);
  return clearance + bodyPad;
}

/** 正文底部内边距，避免最后一行贴边或被裁切 */
export function getFuriganaBodyBottomPaddingPx(profile: PosterLayoutProfile): number {
  if (profile === 'mobilePoster') return 24;
  if (profile === 'squarePoster') return 20;
  return 16;
}

/**
 * 分页测量与预览共用的正文区安全余量（吸收 WebKit 字体/ruby 子像素误差）。
 * Notebook 版式在 lyrics-group / 区段卡片上有额外装饰增量（margin/padding/border），
 * 这些增量在满页时虽随 spacingScale 收缩（见 compileLayoutVariantCss），但为彻底避免
 * verifyAndRepairPages 对不可拆分原子的"静默放行"截断，这里额外预留 Notebook 余量，
 * 让测量阶段更早换页（AGENTS.md 第九节 约束A / 方向A2）。
 */
export function getPosterBodySafetyMarginPx(
  profile: PosterLayoutProfile,
  layoutVariant?: PosterLayoutVariant,
): number {
  let margin: number;
  if (profile === 'mobilePoster') margin = 20;
  else if (profile === 'squarePoster') margin = 24;
  else margin = 12;
  if (layoutVariant === 'notebook') {
    // mobile 页高更大、可容纳更多 group，绝对增量更可观；print 页密、相对敏感
    margin += profile === 'mobilePoster' ? 20 : profile === 'squarePoster' ? 18 : 14;
  }
  return margin;
}

/** 计算 fv-body-h 的 max-height（px），测量与预览共用同一公式 */
export function computePosterBodyMaxHeightPx(
  profile: PosterLayoutProfile,
  options: { showTitle: boolean; titleEl: HTMLElement | null; layoutVariant?: PosterLayoutVariant },
): number {
  const { height: h } = getFuriganaPosterCanvasDimensions(profile);
  const insets = getFuriganaCanvasInsets(profile);
  const shellInnerH = h - insets.top - insets.bottom;

  let titleH = 0;
  let titleMB = 0;
  if (options.showTitle && options.titleEl) {
    void options.titleEl.offsetHeight;
    titleH = options.titleEl.offsetHeight;
    titleMB = parseFloat(getComputedStyle(options.titleEl).marginBottom) || 0;
  }

  const margin = getPosterBodySafetyMarginPx(profile, options.layoutVariant);
  // C-1: 额外扣除水印文字安全距离（缩放后），使正文 max-height 不进入水印文字区，
  // 配合 getFuriganaPageNumberReservePx 的一致预留，避免导出末行压水印。
  const clearance = Math.round(WATERMARK_TEXT_CLEARANCE_PX * watermarkDesignScale(profile));
  return Math.max(0, shellInnerH - titleH - titleMB - margin - clearance);
}

export function applyPosterBodyMaxHeight(
  body: HTMLElement,
  profile: PosterLayoutProfile,
  options: { showTitle: boolean; titleEl: HTMLElement | null; layoutVariant?: PosterLayoutVariant },
): void {
  const maxPx = computePosterBodyMaxHeightPx(profile, options);
  applyPosterBodyMaxHeightToPx(body, maxPx);
}

export function measurePosterBodyNaturalHeightPx(body: HTMLElement): number {
  const prevMax = body.style.maxHeight;
  const prevOverflow = body.style.overflow;
  const prevHeight = body.style.height;
  body.style.maxHeight = 'none';
  body.style.height = 'auto';
  body.style.overflow = 'visible';
  void body.offsetHeight;
  const natural = body.scrollHeight;
  body.style.maxHeight = prevMax;
  body.style.height = prevHeight;
  body.style.overflow = prevOverflow;
  void body.offsetHeight;
  return natural;
}

export function posterBodyExceedsMaxHeight(body: HTMLElement, maxPx: number): boolean {
  if (!Number.isFinite(maxPx) || maxPx <= 0) return false;
  applyPosterBodyMaxHeightToPx(body, maxPx);
  void body.offsetHeight;
  return body.scrollHeight > maxPx + 1;
}

function applyPosterBodyMaxHeightToPx(body: HTMLElement, maxPx: number): void {
  body.style.flexShrink = '0';
  body.style.flexGrow = '0';
  body.style.maxHeight = `${maxPx}px`;
  body.style.overflow = 'hidden';
  body.dataset.posterBodyMaxHeight = String(maxPx);
}

export function detectFuriganaPosterBodyOverflow(
  body: HTMLElement,
  _profile: PosterLayoutProfile = 'clipPosterPrint',
): boolean {
  void _profile;
  void body.offsetHeight;
  const clientH = body.clientHeight;
  if (clientH < 1) return false;
  return body.scrollHeight > clientH + 1;
}

export type FuriganaPosterCssOptions = {
  spacingScale?: number;
  language?: LyricsLanguage;
  lang?: LangCode;
  colorTheme?: ColorTheme;
  showRuby?: boolean;
  userFontScale?: number;
  userLineHeightScale?: number;
  /** 默认 true；测量容器应 false，避免每个 measurer 再注入 @font-face 触发下载 */
  includeFontFaces?: boolean;
  /** 背景图 URL；为空时保持 POSTER_BG_COLOR 纯色背景 */
  backgroundImage?: string;
  /** 版式变体（standard / notebook） */
  layoutVariant?: PosterLayoutVariant;
};

export function buildShufuriPosterInnerCss(
  profile: PosterLayoutProfile,
  options: FuriganaPosterCssOptions = {},
): string {
  const lang = resolveLangFromOptions(options);
  const showRuby = options.showRuby ?? true;
  const resolved = resolvePosterTypography({
    profile,
    lang,
    spacingScale: options.spacingScale,
    colorTheme: options.colorTheme,
    language: options.language,
    showRuby,
    userFontScale: options.userFontScale,
    userLineHeightScale: options.userLineHeightScale,
  });
  return (
    compilePosterCss(resolved, {
      unit: 'px',
      viewMode: 'screen',
      showRuby,
      includeFontFaces: options.includeFontFaces,
      backgroundImage: options.backgroundImage,
      layoutVariant: options.layoutVariant,
    }) + RASTER_SAFE_CSS
  );
}

/** @deprecated 使用 buildShufuriPosterInnerCss */
export const buildFuriganaPosterInnerCss = buildShufuriPosterInnerCss;

export function buildFuriganaPosterRootStyle(
  profile: PosterLayoutProfile,
  backgroundImage?: string,
): Record<string, string | number> {
  const { width: w, height: h } = getFuriganaPosterCanvasDimensions(profile);
  const pad = getFuriganaCanvasInsets(profile);
  const bg = backgroundImage
    ? `${POSTER_BG_COLOR} url('${backgroundImage}') center/cover no-repeat`
    : POSTER_BG_COLOR;
  return {
    width: `${w}px`,
    height: `${h}px`,
    boxSizing: 'border-box',
    padding: `${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px`,
    background: bg,
    overflow: 'hidden',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    position: 'relative',
  };
}

export function buildFuriganaEditDocumentCssOverrides(): string {
  return compileEditCssOverrides();
}

export function buildFuriganaEditDocumentRootStyle(
  profile: PosterLayoutProfile,
): Record<string, string | number> {
  const { width: w, height: h } = getFuriganaPosterCanvasDimensions(profile);
  const pad = getFuriganaCanvasInsets(profile);
  return {
    width: `${w}px`,
    height: 'auto',
    minHeight: `${h}px`,
    boxSizing: 'border-box',
    padding: `${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px`,
    /* 编辑画布：随 data-theme 浅色令牌（导出/分页预览仍用白底） */
    background: 'var(--color-edit-canvas-bg)',
    overflow: 'visible',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    position: 'relative',
  };
}

/** shufuriPoster 规范命名（主名） */
export const getShufuriPosterCanvasDimensions = getFuriganaPosterCanvasDimensions;
export const getShufuriCanvasInsets = getFuriganaCanvasInsets;
export const getShufuriPageNumberReservePx = getFuriganaPageNumberReservePx;
export const getShufuriBodyBottomPaddingPx = getFuriganaBodyBottomPaddingPx;
export const detectShufuriPosterBodyOverflow = detectFuriganaPosterBodyOverflow;
export type ShufuriPosterCssOptions = FuriganaPosterCssOptions;
export const buildShufuriPosterRootStyle = buildFuriganaPosterRootStyle;
export const buildShufuriEditDocumentCssOverrides = buildFuriganaEditDocumentCssOverrides;
export const buildShufuriEditDocumentRootStyle = buildFuriganaEditDocumentRootStyle;
