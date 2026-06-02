import {
  buildFuriganaPosterInnerCss,
  buildFuriganaPosterRootStyle,
  getFuriganaCanvasInsets,
  getFuriganaPosterCanvasDimensions,
} from './furiganaLayout/furiganaPosterShared';
import type { PosterLayoutProfile } from './furiganaLayout/types';

const PAGE_NUMBER_FONT_PX = 13;
const PAGE_NUMBER_TEXT_COLOR = '#94A3B8';
const PAGE_NUMBER_FONT_FAMILY =
  '"PingFang SC", "PingFang TC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';

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
  dispose: () => void;
};

/** 与预览页结构一致，离屏挂载，供 PDF/PNG 栅格化（不依赖预览 ref） */
export function mountPosterExportPage(
  doc: Document,
  opts: {
    title: string;
    showTitle: boolean;
    bodyFragmentHtml: string;
    pageIndex: number;
    pageCount: number;
    layoutProfile: PosterLayoutProfile;
  },
): PosterExportPageMount {
  const { title, showTitle, bodyFragmentHtml, pageIndex, pageCount, layoutProfile } = opts;
  const { width: canvasW, height: canvasH } = getFuriganaPosterCanvasDimensions(layoutProfile);
  const pad = getFuriganaCanvasInsets(layoutProfile);
  const rootStyle = buildFuriganaPosterRootStyle(layoutProfile);

  // 全屏白色 backdrop：为 html2canvas 提供干净的渲染表面，同时视觉上隐藏导出 DOM。
  // 关键约束：
  // 1) 不能使用 clip-path / opacity:0 / visibility:hidden / z-index:-1
  //    —— html2canvas 会直接裁切或忽略不可见内容，导致栅格化全空白。
  // 2) position:fixed 用于 backdrop 遮罩没问题，html2canvas 以 shell（position:relative）
  //    为渲染 target，其坐标在 backdrop 的 absolute 坐标系内，不受 viewport 影响。
  const backdrop = doc.createElement('div');
  backdrop.style.position = 'fixed';
  backdrop.style.left = '0';
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
  // rootStyle 已包含 position:relative、width、height、padding、overflow:hidden、
  // display:flex 等全部关键样式
  Object.assign(shell.style, rootStyle);

  const styleEl = doc.createElement('style');
  styleEl.textContent = buildFuriganaPosterInnerCss(layoutProfile);
  shell.appendChild(styleEl);

  if (showTitle) {
    const h1 = doc.createElement('h1');
    h1.className = 'fv-title-h';
    h1.textContent = title.trim() || '歌词笔记';
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

  wrapper.appendChild(shell);
  backdrop.appendChild(wrapper);
  doc.body.appendChild(backdrop);
  void shell.offsetHeight;

  return {
    root: shell,
    dispose: () => {
      if (backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }
    },
  };
}

export function mountPosterExportPages(
  doc: Document,
  pageHtmls: string[],
  title: string,
  layoutProfile: PosterLayoutProfile,
): PosterExportPageMount[] {
  const n = pageHtmls.length;
  return pageHtmls.map((html, i) =>
    mountPosterExportPage(doc, {
      title,
      showTitle: i === 0,
      bodyFragmentHtml: html,
      pageIndex: i,
      pageCount: n,
      layoutProfile,
    }),
  );
}

export function getPosterExportCanvasSize(layoutProfile: PosterLayoutProfile): {
  width: number;
  height: number;
} {
  return getFuriganaPosterCanvasDimensions(layoutProfile);
}
