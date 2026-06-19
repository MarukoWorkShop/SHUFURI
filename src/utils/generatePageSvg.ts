/**
 * 矢量 SVG 页面生成器
 *
 * 将海报页面 HTML 转换为自包含 SVG（含嵌入字体与全量 CSS），
 * 支持任意缩放无锯齿，通过 foreignObject 保留原始 HTML 布局。
 */
import type { PosterLayoutProfile, PosterRenderOptions } from './shufuriPoster/types';
import {
  buildShufuriPosterInnerCss,
  buildShufuriPosterRootStyle,
  getShufuriCanvasInsets,
  getShufuriPosterCanvasDimensions,
} from './shufuriPoster/shufuriPosterShared';
import { applyPosterTitleElement } from './shufuriPoster/posterTitle';
import {
  getPosterJapaneseFontsFaceCss,
  getPosterKoreanFontFaceCss,
  ZH_FONT_FAMILY,
} from './shufuriPoster/fonts';
import type { LyricsLanguage, LangCode } from '../services/appSettings';
import { getAppSettings } from '../services/appSettings';
import { resolvePosterPipelineLang } from './shufuriPoster/inferPosterLang';

/** 将 JS 样式对象转为内联 style 属性字符串 */
function styleObjToAttr(style: Record<string, string | number>): string {
  return Object.entries(style)
    .map(([key, val]) => {
      const cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      return `${cssKey}:${val}`;
    })
    .join(';');
}

/** SVG 特殊字符转义 */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface GeneratePageSvgOptions {
  title: string;
  artist?: string;
  showTitle: boolean;
  bodyFragmentHtml: string;
  pageIndex: number;
  pageCount: number;
  layoutProfile: PosterLayoutProfile;
  spacingScale?: number;
  language?: LyricsLanguage;
  lang?: LangCode;
  renderOptions?: PosterRenderOptions;
}

/**
 * 生成单页自包含矢量 SVG（foreignObject + 内联 CSS + 嵌入字体）
 */
export async function generatePageSvg(opts: GeneratePageSvgOptions): Promise<string> {
  const {
    title,
    artist,
    showTitle,
    bodyFragmentHtml,
    pageIndex,
    pageCount,
    layoutProfile,
    spacingScale = 1,
    language = 'jp',
    lang,
    renderOptions,
  } = opts;

  const showRuby = renderOptions?.showRuby ?? true;

  const { width: w, height: h } = getShufuriPosterCanvasDimensions(layoutProfile);
  const pad = getShufuriCanvasInsets(layoutProfile);
  const rootStyle = buildShufuriPosterRootStyle(layoutProfile);
  const pipelineLang = resolvePosterPipelineLang(lang, bodyFragmentHtml, language);
  const innerCss = buildShufuriPosterInnerCss(layoutProfile, {
    spacingScale,
    language,
    lang: pipelineLang,
    colorTheme: getAppSettings().colorTheme,
    showRuby: renderOptions?.showRuby,
    userFontScale: renderOptions?.userFontScale,
    userLineHeightScale: renderOptions?.userLineHeightScale,
  });

  const jpFontCss = getPosterJapaneseFontsFaceCss();
  const koFontCss = getPosterKoreanFontFaceCss();

  const pageNoText = `— ${String(pageIndex + 1).padStart(2, '0')} / ${String(pageCount).padStart(2, '0')} —`;
  const pageNoBottom = layoutProfile === 'mobilePoster'
    ? Math.round(pad.bottom * 0.42)
    : layoutProfile === 'squarePoster'
      ? Math.round(pad.bottom * 0.38)
      : Math.round(pad.bottom * 0.28);

  let titleHtml = '';
  if (showTitle) {
    const tmp = document.createElement('h1');
    tmp.className = 'fv-title-h';
    applyPosterTitleElement(tmp, title, artist);
    titleHtml = `\n    ${tmp.outerHTML}`;
  }

  const cleanBody = bodyFragmentHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  const rootInlineStyle = styleObjToAttr(rootStyle);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${w}" height="${h}"
     viewBox="0 0 ${w} ${h}"
     version="1.1">
  <defs>
    <style>
      ${xmlEscape(jpFontCss)}
      ${xmlEscape(koFontCss)}
      ${xmlEscape(innerCss)}
      .fv-poster-page-no {
        position: absolute;
        right: ${pad.right}px;
        bottom: ${pageNoBottom}px;
        font-size: 13px;
        color: #94A3B8;
        font-family: ${ZH_FONT_FAMILY};
        font-weight: 400;
        letter-spacing: 0.04em;
      }
    </style>
  </defs>
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml"
         class="fv-html-poster-root"
         data-ruby-visible="${showRuby ? 'true' : 'false'}"
         style="${rootInlineStyle}">${titleHtml}
      <div class="fv-body-h" style="flex:1 1 auto;min-height:0;overflow:hidden;box-sizing:border-box;text-align:left;">
        ${cleanBody}
      </div>
      <div class="fv-poster-page-no">${xmlEscape(pageNoText)}</div>
    </div>
  </foreignObject>
</svg>`;
}

/**
 * 生成多页 SVG 合集（多 SVG 包装在 HTML 中，供浏览器预览/打印）
 */
export async function generateMultiPageSvgHtml(
  pages: GeneratePageSvgOptions[],
): Promise<string> {
  const svgs = await Promise.all(pages.map(generatePageSvg));
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SHUFURI Poster Export</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #f0f0f0; padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 20px; }
    .svg-page { max-width: 100%; height: auto; box-shadow: 0 2px 16px rgba(0,0,0,0.12); background: #fff; }
    @media print {
      body { background: #fff; padding: 0; gap: 0; }
      .svg-page { box-shadow: none; page-break-after: always; width: 100%; height: 100vh; }
      .svg-page:last-child { page-break-after: auto; }
    }
  </style>
</head>
<body>
  ${svgs.map((svg) => `<div class="svg-page">${svg}</div>`).join('\n  ')}
</body>
</html>`;
}
