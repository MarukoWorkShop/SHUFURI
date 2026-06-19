import {
  applyPosterBodyMaxHeight,
  buildShufuriPosterInnerCss,
  buildShufuriPosterRootStyle,
  getShufuriCanvasInsets,
  getShufuriPosterCanvasDimensions,
} from './shufuriPoster/shufuriPosterShared';
import { ZH_FONT_FAMILY } from './shufuriPoster/fonts';
import type { PosterLayoutProfile, PosterRenderOptions } from './shufuriPoster/types';
import type { LyricsLanguage, LangCode } from '../services/appSettings';
import { getAppSettings } from '../services/appSettings';
import { applyPosterTitleElement } from './shufuriPoster/posterTitle';
import { resolvePosterPipelineLang } from './shufuriPoster/inferPosterLang';

const PAGE_NUMBER_FONT_PX = 13;
const PAGE_NUMBER_TEXT_COLOR = '#94A3B8';
const PAGE_NUMBER_FONT_FAMILY = ZH_FONT_FAMILY;

/**
 * 导出 html2canvas 渲染补偿因子。
 * html2canvas 的 canvas 文字排版比浏览器 DOM 渲染略大（~1-3%），
 * 导致分页测量时认为能装下的内容在 PDF 中溢出/截断。
 * 此处将 CSS spacingScale 微缩 2% 以补偿该差异，
 * 确保屏幕预览与 PDF 导出 1:1 对齐。
 */
const EXPORT_HTML2CANVAS_SCALE_FUDGE = 0.98;

function sanitizeFragmentHtml(html: string): string {
  let s = html.replace(/\r\n/g, '\n');
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  return s;
}

function formatPosterPageNo(current: number, total: number): string {
  const a = String(current).padStart(2, '0');
  const b = String(total).padStart(2, '0');
  return `— ${a} / ${b} —`;
}

export type PosterExportPageMount = {
  root: HTMLDivElement;
  /** 在栅格化前调用；visible:false 时保持离屏，避免长按保存时全屏白屏 */
  prepare: (opts?: { visible?: boolean }) => void;
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
  const { width: canvasW, height: canvasH } = getShufuriPosterCanvasDimensions(layoutProfile);
  const pad = getShufuriCanvasInsets(layoutProfile);
  const rootStyle = buildShufuriPosterRootStyle(layoutProfile);

  // 全屏白色 backdrop：为 html2canvas 提供干净的渲染表面，同时视觉上隐藏导出 DOM。
  // 关键约束：
  // 1) 不能使用 clip-path / opacity:0 / visibility:hidden / z-index:-1
  //    —— html2canvas 会直接裁切或忽略不可见内容，导致栅格化全空白。
  // 2) position:fixed 用于 backdrop 遮罩没问题，html2canvas 以 shell（position:relative）
  //    为渲染 target，其坐标在 backdrop 的 absolute 坐标系内，不受 viewport 影响。
  //
  // 【闪烁修复】初始将 backdrop 移出视口（left: -99999vw），避免挂载时的白屏闪现。
  // 调用方在准备好栅格化前调用 prepare() 将其移回可见位置。
  const backdrop = doc.createElement('div');
  backdrop.style.position = 'fixed';
  backdrop.style.left = '-99999vw'; // 初始隐藏，prepare() 时移回 0
  backdrop.style.top = '0';
  backdrop.style.width = '100vw';
  backdrop.style.height = '100vh';
  backdrop.style.background = '#ffffff';
  backdrop.style.zIndex = '2147483646';

  const wrapper = doc.createElement('div');
  wrapper.style.position = 'absolute';
  wrapper.style.left = '0';
  wrapper.style.top = '0';
  wrapper.style.width = `${canvasW}px`;
  wrapper.style.height = `${canvasH}px`;
  wrapper.style.overflow = 'hidden';
  wrapper.style.pointerEvents = 'none';

  const shell = doc.createElement('div');
  shell.className = 'fv-html-poster-root';
  // rootStyle 已包含 position:relative、width、height（带px单位）、padding、overflow:hidden、
  // display:flex 等全部关键样式
  Object.assign(shell.style, rootStyle);
  // 将预期画布尺寸存为 data 属性，供 rasterize 阶段读取以确保 canvas 尺寸精确
  shell.dataset.exportCanvasW = String(canvasW);
  shell.dataset.exportCanvasH = String(canvasH);
  shell.dataset.rubyVisible = (renderOptions?.showRuby ?? true) ? 'true' : 'false';

  const styleEl = doc.createElement('style');
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
    const h1 = doc.createElement('h1');
    h1.className = 'fv-title-h';
    applyPosterTitleElement(h1, title, artist);
    shell.appendChild(h1);
  }

  const body = doc.createElement('div');
  body.className = 'fv-body-h';
  body.innerHTML = sanitizeFragmentHtml(bodyFragmentHtml);
  shell.appendChild(body);

  const pageNo = doc.createElement('div');
  pageNo.className = 'fv-poster-page-no';
  pageNo.setAttribute('aria-hidden', 'true');
  pageNo.textContent = formatPosterPageNo(pageIndex + 1, pageCount);
  Object.assign(pageNo.style, {
    position: 'absolute',
    right: `${pad.right}px`,
    bottom: `${
      layoutProfile === 'mobilePoster'
        ? Math.round(pad.bottom * 0.42)
        : Math.round(pad.bottom * 0.28)
    }px`,
    fontSize: `${PAGE_NUMBER_FONT_PX}px`,
    color: PAGE_NUMBER_TEXT_COLOR,
    fontFamily: PAGE_NUMBER_FONT_FAMILY,
    fontWeight: '400',
    letterSpacing: '0.04em',
    zIndex: '2',
  });
  shell.appendChild(pageNo);

  const titleElForMeasure = showTitle ? shell.querySelector('h1.fv-title-h') : null;
  applyPosterBodyMaxHeight(body, layoutProfile, {
    showTitle,
    titleEl: titleElForMeasure instanceof HTMLElement ? titleElForMeasure : null,
  });

  wrapper.appendChild(shell);
  backdrop.appendChild(wrapper);
  doc.body.appendChild(backdrop);
  void shell.offsetHeight;

  let prepared = false;

  return {
    root: shell,
    prepare: (opts?: { visible?: boolean }) => {
      const visible = opts?.visible ?? true;
      if (!prepared) {
        prepared = true;
        if (visible) {
          backdrop.style.left = '0';
        }
      } else if (visible) {
        backdrop.style.left = '0';
      }
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
