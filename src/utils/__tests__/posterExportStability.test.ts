/**
 * 海报导出挂载稳固性（不跑真实 html2canvas 栅格）。
 * 覆盖：DOM 同构、版式×底色、禁止隐藏壳层、minimal 封面、sanitize、批量缺 renderOptions 契约。
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  mountPosterExportPage,
  getPosterExportCanvasSize,
} from '../posterExportMount.ts';
import {
  NOTEBOOK_PAPER_BG,
  SPLIT_PAPER_BG,
  MINIMAL_PAPER_BG,
} from '../posterTypography/typographyConstants.ts';
import { getPosterBackgroundBgColor } from '../../config/posterBackgrounds.ts';
import { paginateShufuriPosterBodyHtml } from '../shufuriPoster/paginateShufuriPosterHtml.ts';
import type { PosterLayoutProfile, PosterLayoutVariant } from '../shufuriPoster/types.ts';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const mounts: Array<{ dispose: () => void }> = [];

afterEach(() => {
  while (mounts.length) {
    mounts.pop()?.dispose();
  }
});

/** jsdom 会把 style.background 归一成 rgb() */
function hexToRgbCss(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgb(${r}, ${g}, ${b})`;
}

function mount(
  opts: Parameters<typeof mountPosterExportPage>[1],
): ReturnType<typeof mountPosterExportPage> {
  const m = mountPosterExportPage(document, opts);
  mounts.push(m);
  return m;
}

const BODY_SIMPLE =
  '<div class="lyrics-group"><p class="jp-line">一行</p><p class="zh-line">一行</p></div>';

const PROFILES: PosterLayoutProfile[] = [
  'mobilePoster',
  'squarePoster',
  'clipPosterPrint',
  'socialPoster',
];

describe('导出挂载：结构与锁定约束', () => {
  it('返回 root=shell；backdrop>wrapper>shell；dispose 卸掉 backdrop', () => {
    const { root, dispose } = mount({
      title: '歌',
      showTitle: true,
      bodyFragmentHtml: BODY_SIMPLE,
      pageIndex: 0,
      pageCount: 1,
      layoutProfile: 'mobilePoster',
    });
    expect(root.classList.contains('fv-html-poster-root')).toBe(true);
    expect(root.dataset.exportRaster).toBe('1');

    const wrapper = root.parentElement;
    const backdrop = wrapper?.parentElement;
    expect(wrapper).toBeTruthy();
    expect(backdrop).toBeTruthy();
    expect(backdrop?.parentElement).toBe(document.body);
    expect(getComputedStyle(backdrop!).position).toBe('fixed');
    expect(getComputedStyle(root).position).not.toBe('fixed');

    dispose();
    expect(backdrop?.parentElement).toBeNull();
    // 已 dispose，勿再 afterEach 二次 dispose
    mounts.pop();
  });

  it('shell 记录 exportCanvasW/H，与 getPosterExportCanvasSize 一致', () => {
    for (const profile of PROFILES) {
      const { width, height } = getPosterExportCanvasSize(profile);
      const { root } = mount({
        title: 'T',
        showTitle: true,
        bodyFragmentHtml: BODY_SIMPLE,
        pageIndex: 0,
        pageCount: 1,
        layoutProfile: profile,
      });
      expect(root.dataset.exportCanvasW).toBe(String(width));
      expect(root.dataset.exportCanvasH).toBe(String(height));
    }
  });

  it('禁止隐藏壳层：opacity/visibility/clip-path 不得用于 shell', () => {
    const { root } = mount({
      title: 'T',
      showTitle: true,
      bodyFragmentHtml: BODY_SIMPLE,
      pageIndex: 0,
      pageCount: 1,
      layoutProfile: 'mobilePoster',
    });
    expect(root.style.opacity).not.toBe('0');
    expect(root.style.visibility).not.toBe('hidden');
    expect(root.style.clipPath || '').toBe('');
    expect(root.style.zIndex).not.toBe('-1');
    expect(root.style.overflow).toBe('visible');
  });

  it('backdrop 完全离屏（left 负向且覆盖画布宽）', () => {
    const profile: PosterLayoutProfile = 'mobilePoster';
    const { width } = getPosterExportCanvasSize(profile);
    const { root } = mount({
      title: 'T',
      showTitle: true,
      bodyFragmentHtml: BODY_SIMPLE,
      pageIndex: 0,
      pageCount: 1,
      layoutProfile: profile,
    });
    const backdrop = root.parentElement?.parentElement as HTMLElement;
    const left = parseFloat(backdrop.style.left);
    expect(left).toBeLessThan(0);
    expect(Math.abs(left)).toBeGreaterThanOrEqual(width);
  });

  it('含 style + body + watermark；首页有 title', () => {
    const { root } = mount({
      title: '世界に一つだけの花',
      artist: 'SMAP',
      showTitle: true,
      bodyFragmentHtml: BODY_SIMPLE,
      pageIndex: 0,
      pageCount: 2,
      layoutProfile: 'mobilePoster',
    });
    expect(root.querySelector('style')).toBeTruthy();
    expect(root.querySelector('h1.fv-title-h')).toBeTruthy();
    expect(root.querySelector('.fv-body-h')).toBeTruthy();
    expect(root.querySelector('.fv-poster-watermark')).toBeTruthy();
  });

  it('非首页不插标题', () => {
    const { root } = mount({
      title: 'T',
      showTitle: false,
      bodyFragmentHtml: BODY_SIMPLE,
      pageIndex: 1,
      pageCount: 2,
      layoutProfile: 'mobilePoster',
    });
    expect(root.querySelector('h1.fv-title-h')).toBeNull();
  });
});

describe('导出挂载：版式 × exportBg（约束 C）', () => {
  const cases: Array<{
    variant?: PosterLayoutVariant;
    bg: string;
    expectAttr: boolean;
  }> = [
    { variant: undefined, bg: getPosterBackgroundBgColor(undefined), expectAttr: false },
    { variant: 'standard', bg: getPosterBackgroundBgColor(undefined), expectAttr: false },
    { variant: 'notebook', bg: NOTEBOOK_PAPER_BG, expectAttr: true },
    { variant: 'split', bg: SPLIT_PAPER_BG, expectAttr: true },
    { variant: 'minimal', bg: MINIMAL_PAPER_BG, expectAttr: true },
  ];

  it.each(cases)('layoutVariant=$variant → exportBg=$bg', ({ variant, bg, expectAttr }) => {
    const { root } = mount({
      title: 'T',
      showTitle: true,
      bodyFragmentHtml: BODY_SIMPLE,
      pageIndex: 0,
      pageCount: 1,
      layoutProfile: 'mobilePoster',
      renderOptions: variant ? { layoutVariant: variant } : undefined,
    });
    expect(root.dataset.exportBg).toBe(bg);
    const backdrop = root.parentElement?.parentElement as HTMLElement;
    const bgNormalized = (backdrop.style.background || backdrop.style.backgroundColor || '')
      .replace(/\s+/g, '')
      .toLowerCase();
    expect(bgNormalized).toBe(hexToRgbCss(bg).replace(/\s+/g, '').toLowerCase());
    if (expectAttr) {
      expect(root.dataset.layoutVariant).toBe(variant);
    } else {
      expect(root.dataset.layoutVariant).toBeFalsy();
    }
    const css = root.querySelector('style')?.textContent ?? '';
    if (variant && variant !== 'standard') {
      expect(css.includes(`[data-layout-variant="${variant}"]`)).toBe(true);
    }
  });
});

describe('导出挂载：minimal 封面', () => {
  it('首页 minimal 注入 .fv-minimal-image；续页不注入', () => {
    const first = mount({
      title: 'T',
      showTitle: true,
      bodyFragmentHtml: BODY_SIMPLE,
      pageIndex: 0,
      pageCount: 2,
      layoutProfile: 'mobilePoster',
      renderOptions: { layoutVariant: 'minimal' },
    });
    expect(first.root.querySelector('.fv-minimal-image')).toBeTruthy();

    const rest = mount({
      title: 'T',
      showTitle: false,
      bodyFragmentHtml: BODY_SIMPLE,
      pageIndex: 1,
      pageCount: 2,
      layoutProfile: 'mobilePoster',
      renderOptions: { layoutVariant: 'minimal' },
    });
    expect(rest.root.querySelector('.fv-minimal-image')).toBeNull();
  });

  it('minimalImageUrl 写入 img[src]', () => {
    const url = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    const { root } = mount({
      title: 'T',
      showTitle: true,
      bodyFragmentHtml: BODY_SIMPLE,
      pageIndex: 0,
      pageCount: 1,
      layoutProfile: 'squarePoster',
      renderOptions: { layoutVariant: 'minimal', minimalImageUrl: url },
    });
    const img = root.querySelector('.fv-minimal-image img') as HTMLImageElement | null;
    expect(img?.getAttribute('src')).toBe(url);
  });
});

describe('导出挂载：sanitize 与 split 分页 HTML 透传', () => {
  it('剥离 script 与内联事件', () => {
    const dirty =
      BODY_SIMPLE +
      `<script>window.x=1</script><p class="zh-line" onclick="alert(1)">坏</p>`;
    const { root } = mount({
      title: 'T',
      showTitle: true,
      bodyFragmentHtml: dirty,
      pageIndex: 0,
      pageCount: 1,
      layoutProfile: 'mobilePoster',
    });
    const html = root.querySelector('.fv-body-h')?.innerHTML ?? '';
    expect(html.toLowerCase()).not.toContain('<script');
    expect(html.toLowerCase()).not.toContain('onclick');
  });

  it('split 分页 HTML 挂载后仍含双栏根', () => {
    // stub CJK range for paginate
    if (typeof Range !== 'undefined' && !Range.prototype.getBoundingClientRect) {
      Range.prototype.getBoundingClientRect = () =>
        ({
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          width: 0,
          height: 0,
          toJSON: () => ({}),
        }) as DOMRect;
    }
    const body =
      `<div class="clip-body"><div class="lyrics">` +
      Array.from({ length: 6 }, (_, i) =>
        `<div class="lyrics-group"><p class="jp-line">行${i}</p><p class="zh-line">译${i}</p></div>`,
      ).join('') +
      `</div>` +
      `<div class="lyrics-vocabulary" data-lyrics-force-next-page="1">` +
      `<h2 class="lyrics-section-title">重点词汇</h2>` +
      `<div class="lyrics-vocab-item"><p class="vocab-line1"><span class="vocab-word">詞</span></p>` +
      `<p class="vocab-ex-ja">例</p><p class="vocab-ex-zh">译</p></div></div></div>`;

    const pages = paginateShufuriPosterBodyHtml(
      body,
      'Title',
      'mobilePoster',
      document,
      'A',
      'jp',
      'jp',
      undefined,
      { layoutVariant: 'split' },
    );
    expect(pages.some((p) => p.html.includes('fv-split-root'))).toBe(true);
    const slice = pages.find((p) => p.html.includes('fv-split-root')) ?? pages[0]!;
    const { root } = mount({
      title: 'Title',
      showTitle: true,
      bodyFragmentHtml: slice.html,
      pageIndex: 0,
      pageCount: pages.length,
      layoutProfile: 'mobilePoster',
      spacingScale: slice.spacingScale,
      renderOptions: { layoutVariant: 'split' },
    });
    expect(root.querySelector('.fv-split-root')).toBeTruthy();
    expect(root.dataset.exportBg).toBe(SPLIT_PAPER_BG);
  });
});

describe('导出契约：html2canvas 读 exportBg；批量路径当前不传版式', () => {
  it('pdfExport.buildHtml2CanvasOpts 使用 dataset.exportBg（源码契约）', () => {
    const src = readFileSync(
      resolve(__dirname, '../pdfExport.ts'),
      'utf8',
    );
    expect(src).toContain("target.dataset.exportBg || '#ffffff'");
    expect(src).toContain('windowWidth: expectedW');
    expect(src).toContain('windowHeight: expectedH');
  });

  it('batchExportPdf 当前不传 renderOptions（锁定已知行为，避免静默改版式）', () => {
    const src = readFileSync(
      resolve(__dirname, '../batchExportPdf.ts'),
      'utf8',
    );
    // mount 调用块内不应出现 renderOptions:
    const mountBlock = src.slice(src.indexOf('mountPosterExportPage'));
    const callChunk = mountBlock.slice(0, 500);
    expect(callChunk).toContain('mountPosterExportPage');
    expect(callChunk).not.toMatch(/renderOptions\s*:/);
  });

  it('mount 注入 export scale fudge 0.98（spacingScale 乘子）', () => {
    const src = readFileSync(
      resolve(__dirname, '../posterExportMount.ts'),
      'utf8',
    );
    expect(src).toContain('EXPORT_HTML2CANVAS_SCALE_FUDGE = 0.98');
    expect(src).toContain('spacingScale * EXPORT_HTML2CANVAS_SCALE_FUDGE');
  });
});
