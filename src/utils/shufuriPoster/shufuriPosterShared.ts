import type { PosterLayoutProfile } from './types.ts';
import { dimForFuriganaPoster } from './dimensions.ts';
import type { LyricsLanguage, LangCode, ColorTheme } from '../../services/appSettings.ts';
import {
  resolvePosterTypography,
  resolveLangFromOptions,
  compilePosterCss,
  compileEditCssOverrides,
} from '../posterTypography/index.ts';

export { dimForFuriganaPoster };

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

/** 页码区预留高度（供分页测量） */
export function getFuriganaPageNumberReservePx(profile: PosterLayoutProfile): number {
  const d = dimForFuriganaPoster(profile);
  return Math.round(d.textBottomClearance + 22);
}

/** 正文底部内边距，避免最后一行贴边或被裁切 */
export function getFuriganaBodyBottomPaddingPx(profile: PosterLayoutProfile): number {
  if (profile === 'mobilePoster') return 64;
  if (profile === 'squarePoster') return 48;
  return 32;
}

/** 分页测量与预览共用的正文区安全余量（吸收 WebKit 字体/ruby 子像素误差） */
export function getPosterBodySafetyMarginPx(profile: PosterLayoutProfile): number {
  if (profile === 'mobilePoster') return 12;
  if (profile === 'squarePoster') return 10;
  return 8;
}

/** 计算 fv-body-h 的 max-height（px），测量与预览共用同一公式 */
export function computePosterBodyMaxHeightPx(
  profile: PosterLayoutProfile,
  options: { showTitle: boolean; titleEl: HTMLElement | null },
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

  const margin = getPosterBodySafetyMarginPx(profile);
  return Math.max(0, shellInnerH - titleH - titleMB - margin);
}

export function applyPosterBodyMaxHeight(
  body: HTMLElement,
  profile: PosterLayoutProfile,
  options: { showTitle: boolean; titleEl: HTMLElement | null },
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
  profile: PosterLayoutProfile = 'clipPosterPrint',
): boolean {
  void body.offsetHeight;
  const clientH = body.clientHeight;
  if (clientH < 1) return false;
  const slack = profile === 'mobilePoster' || profile === 'squarePoster' ? 10 : 1;
  return body.scrollHeight > clientH + slack;
}

export type FuriganaPosterCssOptions = {
  spacingScale?: number;
  language?: LyricsLanguage;
  lang?: LangCode;
  colorTheme?: ColorTheme;
  showRuby?: boolean;
  userFontScale?: number;
  userLineHeightScale?: number;
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
  return compilePosterCss(resolved, { unit: 'px', viewMode: 'screen', showRuby });
}

/** @deprecated 使用 buildShufuriPosterInnerCss */
export const buildFuriganaPosterInnerCss = buildShufuriPosterInnerCss;

export function buildFuriganaPosterRootStyle(
  profile: PosterLayoutProfile,
): Record<string, string | number> {
  const { width: w, height: h } = getFuriganaPosterCanvasDimensions(profile);
  const pad = getFuriganaCanvasInsets(profile);
  return {
    width: `${w}px`,
    height: `${h}px`,
    boxSizing: 'border-box',
    padding: `${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px`,
    background: '#fff',
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
    background: '#fff',
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
