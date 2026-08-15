import {
  applyPosterBodyMaxHeight,
  buildShufuriPosterInnerCss,
  buildShufuriPosterRootStyle,
  getShufuriPosterCanvasDimensions,
} from './shufuriPoster/shufuriPosterShared';
import type { PosterLayoutProfile, PosterRenderOptions } from './shufuriPoster/types';
import type { LyricsLanguage, LangCode } from '../services/appSettings';
import { getAppSettings } from '../services/appSettings';
import {
  getPosterJapaneseFontsFaceCss,
  getPosterSansationFontFaceCss,
  getPosterSourceHanSerifScFontFaceCss,
} from './shufuriPoster/fonts';
import { applyPosterTitleElement } from './shufuriPoster/posterTitle';
import { resolvePosterPipelineLang } from './shufuriPoster/inferPosterLang';
import { appendPosterWatermark } from './shufuriPoster/posterWatermark';

/**
 * 导出 html2canvas 渲染补偿因子。
 * html2canvas 的 canvas 文字排版比浏览器 DOM 渲染略大（~1-3%），
 * 导致分页测量时认为能装下的内容在 PDF 中溢出/截断。
 * 此处将 CSS spacingScale 微缩 2% 以补偿该差异，
 * 确保屏幕预览与 PDF 导出 1:1 对齐。
 */
const EXPORT_HTML2CANVAS_SCALE_FUDGE = 0.98;

const EXPORT_IFRAME_FONT_STYLE_ID = 'poster-export-font-faces';

/** 导出用离屏 iframe 单例：与主文档文档流完全隔离，根除移动端 append 大节点导致的重排抖动 */
let exportIframe: HTMLIFrameElement | null = null;

/** iframe head 注入完整海报 @font-face（与 compilePosterCss 一致；URL 相对主文档绝对化） */
function injectExportIframeFontFaces(idoc: Document): void {
  const css =
    getPosterJapaneseFontsFaceCss() +
    getPosterSourceHanSerifScFontFaceCss() +
    getPosterSansationFontFaceCss();
  let el = idoc.getElementById(EXPORT_IFRAME_FONT_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = idoc.createElement('style');
    el.id = EXPORT_IFRAME_FONT_STYLE_ID;
    idoc.head.appendChild(el);
  }
  el.textContent = css;
}

/**
 * 将导出 iframe 视口扩到至少画布尺寸。
 * 10×10 会让内部 layout / 文字 metrics 按极小 containing block 计算，
 * html2canvas 再叠加 overflow:hidden → 字形被横切成「只剩一半」。
 */
function sizeExportIframe(iframe: HTMLIFrameElement, canvasW: number, canvasH: number): void {
  const curW = parseInt(iframe.style.width, 10) || 0;
  const curH = parseInt(iframe.style.height, 10) || 0;
  const w = Math.max(canvasW, curW);
  const h = Math.max(canvasH, curH);
  iframe.style.width = `${w}px`;
  iframe.style.height = `${h}px`;
  const idoc = iframe.contentDocument;
  if (!idoc) return;
  idoc.documentElement.style.width = `${w}px`;
  idoc.documentElement.style.height = `${h}px`;
  idoc.body.style.margin = '0';
  idoc.body.style.width = `${w}px`;
  idoc.body.style.minHeight = `${h}px`;
}

function getExportIframe(): HTMLIFrameElement {
  if (exportIframe && exportIframe.isConnected) return exportIframe;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('tabindex', '-1');
  // 离屏但保持渲染：用 absolute 移出视口（不可 hidden/clip/opacity:0，否则 html2canvas 抓空）
  // 宽高在 mount 时按画布尺寸设置，不可长期钉死 10×10。
  iframe.style.position = 'absolute';
  iframe.style.left = '-100000px';
  iframe.style.top = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.border = '0';
  iframe.style.visibility = 'visible';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);
  // 确保 iframe 内文档就绪
  if (!iframe.contentDocument) {
    iframe.src = 'about:blank';
  }
  const idoc = iframe.contentDocument!;
  idoc.open();
  idoc.write('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>');
  idoc.close();
  try {
    injectExportIframeFontFaces(idoc);
  } catch {
    /* 字体注入失败可降级 */
  }
  exportIframe = iframe;
  return iframe;
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

/** 与预览页结构一致，离屏挂载，供 PDF/PNG 栅格化（不依赖预览 ref） */
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
  void doc; // 离屏节点改挂独立 iframe（见 getExportIframe），不再直接使用主文档
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
  const rootStyle = buildShufuriPosterRootStyle(layoutProfile);

  // 离屏 backdrop：为 html2canvas 提供白底，尺寸与画布一致，永不移入视口。
  // 关键约束：
  // 1) 不能使用 clip-path / opacity:0 / visibility:hidden / z-index:-1 on shell
  //    —— html2canvas 会直接裁切或忽略不可见内容，导致栅格化全空白。
  // 2) 整个离屏节点挂在独立的隐藏 iframe 文档里（而非主文档 body）：
  //    彻底隔离主文档文档流，根除移动端 append 1080×1920 大节点导致的反复重排「字号抖动」与卡死。
  // 3) iframe 视口宽高必须 ≥ 画布尺寸，否则文字 metrics / containing block 失真 → 半字形切边。
  const iframe = getExportIframe();
  sizeExportIframe(iframe, canvasW, canvasH);
  const idoc = iframe.contentDocument!;
  try {
    injectExportIframeFontFaces(idoc);
  } catch {
    /* 字体注入失败可降级 */
  }
  const backdrop = idoc.createElement('div');
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.style.position = 'absolute';
  backdrop.style.left = '0';
  backdrop.style.top = '0';
  backdrop.style.width = `${canvasW}px`;
  backdrop.style.height = `${canvasH}px`;
  backdrop.style.overflow = 'hidden';
  backdrop.style.background = '#ffffff';
  backdrop.style.pointerEvents = 'none';
  backdrop.style.contain = 'layout style paint';

  const wrapper = idoc.createElement('div');
  wrapper.style.position = 'absolute';
  wrapper.style.left = '0';
  wrapper.style.top = '0';
  wrapper.style.width = `${canvasW}px`;
  wrapper.style.height = `${canvasH}px`;
  wrapper.style.overflow = 'hidden';
  wrapper.style.pointerEvents = 'none';

  const shell = idoc.createElement('div');
  shell.className = 'fv-html-poster-root';
  // rootStyle 已包含 position:relative、width、height（带px单位）、padding、overflow:hidden、
  // display:flex 等全部关键样式
  Object.assign(shell.style, rootStyle);
  // 将预期画布尺寸存为 data 属性，供 rasterize 阶段读取以确保 canvas 尺寸精确
  shell.dataset.exportCanvasW = String(canvasW);
  shell.dataset.exportCanvasH = String(canvasH);
  shell.dataset.rubyVisible = (renderOptions?.showRuby ?? true) ? 'true' : 'false';

  const styleEl = idoc.createElement('style');
  // 叠加 html2canvas 渲染补偿因子，确保 PDF 栅格化不溢出
  const exportScale = spacingScale * EXPORT_HTML2CANVAS_SCALE_FUDGE;
  const pipelineLang = resolvePosterPipelineLang(lang, bodyFragmentHtml, language);
  styleEl.textContent = buildShufuriPosterInnerCss(layoutProfile, {
    spacingScale: exportScale,
    language,
    lang: pipelineLang,
    colorTheme: getAppSettings().colorTheme,
    showRuby: renderOptions?.showRuby,
    userFontScale: renderOptions?.userFontScale,
    userLineHeightScale: renderOptions?.userLineHeightScale,
  });
  shell.appendChild(styleEl);

  if (showTitle) {
    const h1 = idoc.createElement('h1');
    h1.className = 'fv-title-h';
    applyPosterTitleElement(h1, title, artist, pipelineLang ?? 'jp');
    shell.appendChild(h1);
  }

  const body = idoc.createElement('div');
  body.className = 'fv-body-h';
  body.innerHTML = sanitizeFragmentHtml(bodyFragmentHtml);
  shell.appendChild(body);

  appendPosterWatermark(shell, pageIndex + 1, idoc);

  const titleElForMeasure = showTitle ? shell.querySelector('h1.fv-title-h') : null;
  applyPosterBodyMaxHeight(body, layoutProfile, {
    showTitle,
    titleEl: titleElForMeasure instanceof HTMLElement ? titleElForMeasure : null,
  });

  wrapper.appendChild(shell);
  backdrop.appendChild(wrapper);
  idoc.body.appendChild(backdrop);
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
