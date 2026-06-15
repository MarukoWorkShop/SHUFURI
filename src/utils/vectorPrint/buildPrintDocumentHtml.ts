import type { PosterLayoutProfile, PosterPageSlice } from '../furiganaLayout/types';
import { buildPosterTitleInnerHtml } from '../furiganaLayout/posterTitle';
import { sanitizeFuriganaPosterHtml } from '../../components/FuriganaPosterPreview';
import { buildVectorPrintInnerCss } from './buildVectorPrintInnerCss';
import { getPrintFontFaceCss } from './printFonts';
import { printPageSpec } from './printPageSpec';

/** html2canvas 渲染补偿因子（与 posterExportMount.ts 保持同步） */
const EXPORT_HTML2CANVAS_SCALE_FUDGE = 0.98;

function formatPosterPageNo(current: number, total: number): string {
  const a = String(current).padStart(2, '0');
  const b = String(total).padStart(2, '0');
  return `— ${a} / ${b} —`;
}

function scopePrintCss(css: string, scope: string): string {
  return css
    .replace(/@page[\s\S]*?\}\s*/g, '')
    .replace(/\*[\s\S]*?\}\s*/g, '')
    .replace(/html, body[\s\S]*?\}\s*/g, '')
    .replace(/\.print-page[\s\S]*?\}\s*/g, '')
    .replace(/\.print-page:last-child[\s\S]*?\}\s*/g, '')
    .replace(/(\.fv-)/g, `${scope} $1`);
}

function buildSinglePrintPageHtml(
  slice: PosterPageSlice,
  pageIndex: number,
  pageCount: number,
  title: string,
  artist: string | undefined,
  showTitle: boolean,
): string {
  const safeBody = sanitizeFuriganaPosterHtml(slice.html);
  const titleBlock = showTitle
    ? `<h1 class="fv-title-h">${buildPosterTitleInnerHtml(title, artist)}</h1>`
    : '';
  const pageNo = formatPosterPageNo(pageIndex + 1, pageCount);
  const exportScale = slice.spacingScale * EXPORT_HTML2CANVAS_SCALE_FUDGE;
  const scaleAttr =
    slice.spacingScale !== 1 ? ` data-spacing-scale="${exportScale}"` : '';

  return `<section class="print-page"${scaleAttr}>
  <div class="fv-html-poster-root">
    ${titleBlock}
    <div class="fv-body-h">${safeBody}</div>
    <div class="fv-poster-page-no" aria-hidden="true">${pageNo}</div>
  </div>
</section>`;
}

/** 组装完整 HTML 文档，供 expo-print 后台矢量渲染 */
export async function buildPrintDocumentHtml(
  pageSlices: PosterPageSlice[],
  title: string,
  layoutProfile: PosterLayoutProfile,
  artist?: string,
): Promise<string> {
  if (pageSlices.length === 0) {
    throw new Error('没有可导出的页面');
  }

  const spec = printPageSpec(layoutProfile);
  const fontFaceCss = await getPrintFontFaceCss();
  const baseCss = buildVectorPrintInnerCss(layoutProfile, spec, { spacingScale: EXPORT_HTML2CANVAS_SCALE_FUDGE });

  const spacingScales = [...new Set(pageSlices.map((s) => s.spacingScale * EXPORT_HTML2CANVAS_SCALE_FUDGE))].filter((s) => s !== EXPORT_HTML2CANVAS_SCALE_FUDGE);
  const scaledCss = spacingScales
    .map((scale) => {
      const inner = buildVectorPrintInnerCss(layoutProfile, spec, { spacingScale: scale });
      return scopePrintCss(inner, `.print-page[data-spacing-scale="${scale}"]`);
    })
    .join('\n');

  const n = pageSlices.length;
  const pagesHtml = pageSlices
    .map((slice, i) => buildSinglePrintPageHtml(slice, i, n, title, artist, i === 0))
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
  ${fontFaceCss}
  ${baseCss}
  ${scaledCss}
  </style>
</head>
<body>
${pagesHtml}
</body>
</html>`;
}
