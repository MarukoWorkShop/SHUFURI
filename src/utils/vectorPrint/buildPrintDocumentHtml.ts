import type { PosterLayoutProfile, PosterPageSlice, PosterRenderOptions } from '../shufuriPoster/types.ts';
import { buildPosterTitleInnerHtml } from '../shufuriPoster/posterTitle.ts';
import { sanitizeShufuriPosterHtml } from '../../components/ShufuriPosterPreview.tsx';
import { buildVectorPrintInnerCss } from './buildVectorPrintInnerCss';
import { getPrintFontFaceCss } from './printFonts';
import { printPageSpec } from './printPageSpec';
import type { LyricsLanguage, LangCode } from '../../services/appSettings';
import { getAppSettings } from '../../services/appSettings';
import { buildPosterWatermarkHtml } from '../shufuriPoster/posterWatermark';

/** html2canvas 渲染补偿因子（与 posterExportMount.ts 保持同步） */
const EXPORT_HTML2CANVAS_SCALE_FUDGE = 0.98;

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
  _pageCount: number,
  title: string,
  artist: string | undefined,
  showTitle: boolean,
  showRuby: boolean,
  lang: LangCode = 'jp',
): string {
  void _pageCount;
  const safeBody = sanitizeShufuriPosterHtml(slice.html);
  const titleBlock = showTitle
    ? `<h1 class="fv-title-h">${buildPosterTitleInnerHtml(title, artist, lang)}</h1>`
    : '';
  const watermark = buildPosterWatermarkHtml(pageIndex + 1);
  const exportScale = slice.spacingScale * EXPORT_HTML2CANVAS_SCALE_FUDGE;
  const scaleAttr =
    slice.spacingScale !== 1 ? ` data-spacing-scale="${exportScale}"` : '';
  const rubyAttr = showRuby ? '' : ' data-ruby-visible="false"';

  return `<section class="print-page"${scaleAttr}>
  <div class="fv-html-poster-root"${rubyAttr}>
    ${titleBlock}
    <div class="fv-body-h">${safeBody}</div>
    ${watermark}
  </div>
</section>`;
}

/** 组装完整 HTML 文档，供 expo-print 后台矢量渲染 */
export async function buildPrintDocumentHtml(
  pageSlices: PosterPageSlice[],
  title: string,
  layoutProfile: PosterLayoutProfile,
  artist?: string,
  language: LyricsLanguage = 'jp',
  lang?: LangCode,
  renderOptions?: PosterRenderOptions,
): Promise<string> {
  if (pageSlices.length === 0) {
    throw new Error('没有可导出的页面');
  }

  const showRuby = renderOptions?.showRuby ?? true;
  const colorTheme = getAppSettings().colorTheme;
  const spec = printPageSpec(layoutProfile);
  const fontFaceCss = await getPrintFontFaceCss();
  const cssCommon = {
    language,
    lang,
    colorTheme,
    showRuby,
    userFontScale: renderOptions?.userFontScale,
    userLineHeightScale: renderOptions?.userLineHeightScale,
  };
  const baseCss = buildVectorPrintInnerCss(layoutProfile, spec, {
    spacingScale: EXPORT_HTML2CANVAS_SCALE_FUDGE,
    ...cssCommon,
  });

  const spacingScales = [...new Set(pageSlices.map((s) => s.spacingScale * EXPORT_HTML2CANVAS_SCALE_FUDGE))].filter((s) => s !== EXPORT_HTML2CANVAS_SCALE_FUDGE);
  const scaledCss = spacingScales
    .map((scale) => {
      const inner = buildVectorPrintInnerCss(layoutProfile, spec, {
        spacingScale: scale,
        ...cssCommon,
      });
      return scopePrintCss(inner, `.print-page[data-spacing-scale="${scale}"]`);
    })
    .join('\n');

  const n = pageSlices.length;
  const pagesHtml = pageSlices
    .map((slice, i) =>
      buildSinglePrintPageHtml(slice, i, n, title, artist, i === 0, showRuby, lang ?? 'jp'),
    )
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
