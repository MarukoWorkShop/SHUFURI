import {
  applyPosterBodyMaxHeight,
  buildShufuriPosterInnerCss,
  buildShufuriPosterRootStyle,
  getShufuriPosterCanvasDimensions,
  RASTER_SAFE_CSS,
} from './shufuriPoster/shufuriPosterShared';
import type { PosterLayoutProfile, PosterRenderOptions } from './shufuriPoster/types';
import type { LyricsLanguage, LangCode } from '../services/appSettings';
import { getAppSettings } from '../services/appSettings';
import { applyPosterTitleElement } from './shufuriPoster/posterTitle';
import { resolvePosterPipelineLang } from './shufuriPoster/inferPosterLang';
import { appendPosterWatermark } from './shufuriPoster/posterWatermark';
import { getPosterBackgroundUrl, getPosterBackgroundBgColor } from '../config/posterBackgrounds';
import { NOTEBOOK_PAPER_BG, SPLIT_PAPER_BG } from './posterTypography/typographyConstants';

/**
 * 导出 html2canvas 渲染补偿因子。
 * html2canvas 的 canvas 文字排版比浏览器 DOM 渲染略大（~1-3%），
 * 导致分页测量时认为能装下的内容在 PDF 中溢出/截断。
 * 此处将 CSS spacingScale 微缩 2% 以补偿该差异，
 * 确保屏幕预览与 PDF 导出 1:1 对齐。
 */
const EXPORT_HTML2CANVAS_SCALE_FUDGE = 0.98;



/** 导出 backdrop 完全移出左缘：画布宽 + 视口宽 + 余量（-200vw 不足以隐藏 1080px 手机竖屏画布） */
function getExportBackdropOffscreenLeft(canvasW: number): number {
  const vw =
    typeof window !== 'undefined'
      ? Math.ceil(window.visualViewport?.width ?? window.innerWidth ?? canvasW)
      : canvasW;
  return -(canvasW + vw + 64);
}

function sanitizeFragmentHtml(html: string): string {
  let s = html.replace(/\r\n/g, '\n');
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  return s;
}

export type PosterExportPageMount = {
  root: HTMLDivElement;
  /** 栅格化前触发布局；导出 DOM 始终离屏，不会移入视口 */
  prepare: () => void;
  dispose: () => void;
};

/**
 * 与预览页结构一致，离屏挂载到**主文档**，供 PDF/PNG 栅格化。
 *
 * 不再使用独立 10×10 iframe：iframe 内 containing block / 字体 metrics 与
 * 主文档不一致，叠加歌词行 overflow:hidden 后 html2canvas 会横切半字形。
 * 移动端「能拿到 PDF」由 pdfExport.deliverPosterPdfBlob（share/dataURL）负责，
 * 与挂载方式无关；防抖动靠离屏 fixed + contain，勿再引入过小 iframe。
 */
export function mountPosterExportPage(
  doc: Document,
  opts: {
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
  },
): PosterExportPageMount {
  const {
    title,
    artist,
    showTitle,
    bodyFragmentHtml,
    pageIndex,
    pageCount: _pageCount,
    layoutProfile,
    spacingScale = 1,
    language = 'jp',
    lang,
    renderOptions,
  } = opts;
  void _pageCount;
  const { width: canvasW, height: canvasH } = getShufuriPosterCanvasDimensions(layoutProfile);
  const backgroundImage = getPosterBackgroundUrl(renderOptions?.backgroundId);
  // 底色与版式联动：notebook 用暖米白做旧纸底，split 用极浅蓝实色兜底，
  // 避免 html2canvas 把非白底刷白（PDF 零字节回归）
  const pageBgColor =
    renderOptions?.layoutVariant === 'notebook'
      ? NOTEBOOK_PAPER_BG
      : renderOptions?.layoutVariant === 'split'
        ? SPLIT_PAPER_BG
        : getPosterBackgroundBgColor(renderOptions?.backgroundId);
  const rootStyle = buildShufuriPosterRootStyle(layoutProfile, backgroundImage);

  // 离屏 backdrop：为 html2canvas 提供白底，尺寸与画布一致，永不移入视口。
  // 关键约束：
  // 1) 不能使用 clip-path / opacity:0 / visibility:hidden / z-index:-1 on shell
  //    —— html2canvas 会直接裁切或忽略不可见内容，导致栅格化全空白。
  // 2) 禁止 100vw 全屏遮罩或 prepare 时移入视口 —— 会触发视口/缩放重算与全屏白闪。
  // 3) left 须 ≤ -(canvasW + viewportW)：translateX(-200vw) 无法盖住 1080px 画布，会漏出左侧大字。
  const backdrop = doc.createElement('div');
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.style.position = 'fixed';
  backdrop.style.left = `${getExportBackdropOffscreenLeft(canvasW)}px`;
  backdrop.style.top = '0';
  backdrop.style.width = `${canvasW}px`;
  backdrop.style.height = `${canvasH}px`;
  // 导出挂载勿用 overflow:hidden / contain:paint：二者都会在 html2canvas 里变成
  // ClipEffect，把 CJK 基线偏移画出的下半字形裁掉。页边界由强制 canvas 尺寸保证。
  backdrop.style.overflow = 'visible';
  backdrop.style.background = '#ffffff';
  backdrop.style.pointerEvents = 'none';
  backdrop.style.contain = 'layout style';
  backdrop.style.zIndex = '2147483646';
  // backdrop 底色与版式底色联动，避免 html2canvas 把非白底刷白（PDF 零字节回归）
  backdrop.style.background = pageBgColor;

  const wrapper = doc.createElement('div');
  wrapper.style.position = 'absolute';
  wrapper.style.left = '0';
  wrapper.style.top = '0';
  wrapper.style.width = `${canvasW}px`;
  wrapper.style.height = `${canvasH}px`;
  wrapper.style.overflow = 'visible';
  wrapper.style.pointerEvents = 'none';

  const shell = doc.createElement('div');
  shell.className = 'fv-html-poster-root';
  shell.dataset.exportRaster = '1';
  // rootStyle 含 overflow:hidden；导出必须覆盖为 visible，否则半字形切边复发
  Object.assign(shell.style, rootStyle);
  shell.style.overflow = 'visible';
  // 将预期画布尺寸存为 data 属性，供 rasterize 阶段读取以确保 canvas 尺寸精确
  shell.dataset.exportCanvasW = String(canvasW);
  shell.dataset.exportCanvasH = String(canvasH);
  shell.dataset.rubyVisible = (renderOptions?.showRuby ?? true) ? 'true' : 'false';
  // 导出底色：供 html2canvas backgroundColor 联动，避免非白底被刷白（PDF 零字节回归）
  shell.dataset.exportBg = pageBgColor;
  if (renderOptions?.layoutVariant && renderOptions.layoutVariant !== 'standard') {
    shell.dataset.layoutVariant = renderOptions.layoutVariant;
  }

  const styleEl = doc.createElement('style');
  // 叠加 html2canvas 渲染补偿因子，确保 PDF 栅格化不溢出
  const exportScale = spacingScale * EXPORT_HTML2CANVAS_SCALE_FUDGE;
  const pipelineLang = resolvePosterPipelineLang(lang, bodyFragmentHtml, language);
  styleEl.textContent =
    buildShufuriPosterInnerCss(layoutProfile, {
      spacingScale: exportScale,
      language,
      lang: pipelineLang,
      colorTheme: getAppSettings().colorTheme,
      showRuby: renderOptions?.showRuby,
      userFontScale: renderOptions?.userFontScale,
      userLineHeightScale: renderOptions?.userLineHeightScale,
      backgroundImage,
      layoutVariant: renderOptions?.layoutVariant,
    }) + RASTER_SAFE_CSS;
  shell.appendChild(styleEl);

  if (showTitle) {
    const h1 = doc.createElement('h1');
    h1.className = 'fv-title-h';
    applyPosterTitleElement(h1, title, artist, pipelineLang ?? 'jp');
    shell.appendChild(h1);
  }

  const body = doc.createElement('div');
  body.className = 'fv-body-h';
  body.innerHTML = sanitizeFragmentHtml(bodyFragmentHtml);
  shell.appendChild(body);

  appendPosterWatermark(shell, pageIndex + 1, doc);

  const titleElForMeasure = showTitle ? shell.querySelector('h1.fv-title-h') : null;
  applyPosterBodyMaxHeight(body, layoutProfile, {
    showTitle,
    titleEl: titleElForMeasure instanceof HTMLElement ? titleElForMeasure : null,
    layoutVariant: renderOptions?.layoutVariant,
  });

  wrapper.appendChild(shell);
  backdrop.appendChild(wrapper);
  doc.body.appendChild(backdrop);
  void shell.offsetHeight;

  return {
    root: shell,
    prepare: () => {
      void shell.offsetHeight;
    },
    dispose: () => {
      if (backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }
    },
  };
}

export function mountPosterExportPages(
  doc: Document,
  pageSlices: Array<{ html: string; spacingScale?: number }>,
  title: string,
  layoutProfile: PosterLayoutProfile,
  artist?: string,
  language: import('../services/appSettings').LyricsLanguage = 'jp',
  lang?: LangCode,
  renderOptions?: PosterRenderOptions,
): PosterExportPageMount[] {
  const n = pageSlices.length;
  return pageSlices.map((slice, i) =>
    mountPosterExportPage(doc, {
      title,
      artist,
      showTitle: i === 0,
      bodyFragmentHtml: slice.html,
      pageIndex: i,
      pageCount: n,
      layoutProfile,
      spacingScale: slice.spacingScale ?? 1,
      language,
      lang,
      renderOptions,
    }),
  );
}

export function getPosterExportCanvasSize(layoutProfile: PosterLayoutProfile): {
  width: number;
  height: number;
} {
  return getShufuriPosterCanvasDimensions(layoutProfile);
}
