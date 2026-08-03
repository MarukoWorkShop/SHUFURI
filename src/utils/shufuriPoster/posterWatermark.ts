/**
 * 导出 / 预览页底部居中水印：页码 + 品牌名 SHUFURI
 * 取代原右下角「— 01 / 03 —」页码。
 *
 * 设计基准为手机竖屏（1080 宽）；B5 等窄画布按 canvasWidth 等比缩放。
 */
import { dimForProfile, MOBILE_DIM } from './dimensions';
import type { PosterLayoutProfile } from './types';

export const WATERMARK_BRAND = 'SHUFURI';

/** 距页面底部（mobile 基准 px） */
export const WATERMARK_BOTTOM_PX = 40;
/** 页码与品牌名垂直间距 */
export const WATERMARK_GAP_PX = 4;
/** 页码字号 */
export const WATERMARK_PAGE_FONT_PX = 14;
/** 品牌名字号 */
export const WATERMARK_BRAND_FONT_PX = 10;
/** 品牌名字距 */
export const WATERMARK_BRAND_LETTER_SPACING_PX = 4;

export const WATERMARK_PAGE_COLOR = 'rgba(0, 0, 0, 0.3)';
export const WATERMARK_BRAND_COLOR = 'rgba(0, 0, 0, 0.2)';

/** 与 @font-face "Sansation" Regular 对齐 */
export const WATERMARK_FONT_FAMILY = '"Sansation", sans-serif';

/** 相对手机竖屏画布宽度的缩放（B5 ≈ 600/1080） */
export function watermarkDesignScale(profile: PosterLayoutProfile): number {
  const w = dimForProfile(profile).canvasWidth;
  return w / MOBILE_DIM.canvasWidth;
}

function scaledWatermarkPx(px: number, scale: number): number {
  return Math.max(1, Math.round(px * scale));
}

/** 页码行：— 1 —（em dash，两侧各一空格） */
export function formatWatermarkPageLabel(pageNumber: number): string {
  const n = Math.max(1, Math.floor(pageNumber));
  return `— ${n} —`;
}

export function buildPosterWatermarkHtml(pageNumber: number): string {
  const page = formatWatermarkPageLabel(pageNumber);
  return (
    `<div class="fv-poster-watermark" aria-hidden="true">` +
    `<div class="fv-poster-watermark__page">${page}</div>` +
    `<div class="fv-poster-watermark__brand">${WATERMARK_BRAND}</div>` +
    `</div>`
  );
}

/** 挂载到海报 shell（导出 DOM） */
export function appendPosterWatermark(
  parent: HTMLElement,
  pageNumber: number,
  doc: Document = document,
): HTMLElement {
  const root = doc.createElement('div');
  root.className = 'fv-poster-watermark';
  root.setAttribute('aria-hidden', 'true');

  const pageEl = doc.createElement('div');
  pageEl.className = 'fv-poster-watermark__page';
  pageEl.textContent = formatWatermarkPageLabel(pageNumber);

  const brandEl = doc.createElement('div');
  brandEl.className = 'fv-poster-watermark__brand';
  brandEl.textContent = WATERMARK_BRAND;

  root.appendChild(pageEl);
  root.appendChild(brandEl);
  parent.appendChild(root);
  return root;
}

export type WatermarkCssSizeFn = (px: number) => string;

export type BuildPosterWatermarkCssOptions = {
  /** 缺省按 mobile 基准（scale=1） */
  profile?: PosterLayoutProfile;
  /** 用于 px / mm 换算（打印） */
  sizeFn?: WatermarkCssSizeFn;
};

/** 水印样式；B5 等按画布宽度相对 mobile 等比缩小 */
export function buildPosterWatermarkCss(
  options: BuildPosterWatermarkCssOptions | WatermarkCssSizeFn = {},
): string {
  // 兼容旧调用：buildPosterWatermarkCss((px) => `${px}px`)
  const opts: BuildPosterWatermarkCssOptions =
    typeof options === 'function' ? { sizeFn: options } : options;
  const scale = opts.profile ? watermarkDesignScale(opts.profile) : 1;
  const sizeFn = opts.sizeFn ?? ((px: number) => `${px}px`);
  const s = (px: number) => sizeFn(scaledWatermarkPx(px, scale));

  return `
  .fv-poster-watermark {
    position: absolute;
    bottom: ${s(WATERMARK_BOTTOM_PX)};
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${s(WATERMARK_GAP_PX)};
    pointer-events: none;
    z-index: 2;
  }
  .fv-poster-watermark__page {
    font-family: ${WATERMARK_FONT_FAMILY};
    font-weight: 400;
    font-size: ${s(WATERMARK_PAGE_FONT_PX)};
    line-height: 1;
    color: ${WATERMARK_PAGE_COLOR};
  }
  .fv-poster-watermark__brand {
    font-family: ${WATERMARK_FONT_FAMILY};
    font-weight: 400;
    font-size: ${s(WATERMARK_BRAND_FONT_PX)};
    line-height: 1;
    letter-spacing: ${s(WATERMARK_BRAND_LETTER_SPACING_PX)};
    color: ${WATERMARK_BRAND_COLOR};
  }`;
}
