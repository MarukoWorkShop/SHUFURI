import type { PosterLayoutProfile, FuriganaEngineDim } from './types';
import { B5_DIM, MOBILE_DIM, POSTER_ELASTIC_FONT_BASE_PX } from './dimensions';
import {
  KOZUKA_MINCHO_EL_FAMILY,
  POSTER_JP_FONT_FACE_CSS,
  ZH_FONT_FAMILY,
} from './fonts';

/** 根据 profile 返回排版参数 */
export function dimForFuriganaPoster(profile: PosterLayoutProfile): FuriganaEngineDim {
  if (profile === 'mobilePoster') return { ...MOBILE_DIM };
  return { ...B5_DIM };
}

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
  if (profile === 'mobilePoster') {
    return 64;
  }
  return 32;
}

/** 与 paginateFuriganaHtml 一致的 body 溢出判定（供预览 debug 复用） */
export function detectFuriganaPosterBodyOverflow(body: HTMLElement): boolean {
  const clientH = body.clientHeight;
  return clientH >= 1 && body.scrollHeight > clientH + 1;
}

/** 词汇/语法条目间距 = 日文正文行高（line-height × font-size）× 1.5 */
function itemEntryGapPx(jpLineHeight: number, jpFontSizePx: number): number {
  return Math.round(1.5 * jpLineHeight * jpFontSizePx);
}

/**
 * 打印版：标题约为正文 1.25×、日文行 26px（经 elasticFontBase 缩放）、中文行 14px
 * 手机版：标题约为正文 1.22×；词汇/语法条目间距为日文行高的 1.5 倍
 */
export function buildFuriganaPosterInnerCss(profile: PosterLayoutProfile): string {
  const d = dimForFuriganaPoster(profile);
  const isM = profile === 'mobilePoster';
  const base = POSTER_ELASTIC_FONT_BASE_PX;
  const scaleBody = d.elasticFontBase / base;

  const jpFs = Math.round(26 * scaleBody);
  const titleFs = isM
    ? Math.round(jpFs * 1.22)
    : Math.round(jpFs * 1.25);
  const titleMb = d.titleToBodyGap;

  const zhLyricsPx = Math.round(18 * scaleBody);

  const h2Fs = Math.round(18 * scaleBody);
  const grammarPointTitleFs = Math.round(26 * scaleBody);

  const jpLh = isM ? d.elasticLhBase : 1.75;
  const zhLyricsLh = isM ? 1.3 : 1.35;
  const jpWght = 200;
  const jpEmphasisWght = 700;
  const zhAuxWght = 300;
  const groupMb = isM ? '1.5em' : '1.35em';
  const lyricsJpZhGap = isM ? '0.06em' : '0.04em';
  const auxJpZhGap = isM ? '0.05em' : '0.03em';
  const itemEntryMb = `${itemEntryGapPx(jpLh, jpFs)}px`;
  const grammarDetailMb = isM ? '0.7em' : '0.55em';
  const grammarExMt = isM ? '0.65em' : '0.5em';
  const grammarTitleMt = isM ? '1.15em' : '1.35em';
  const bodyBottomPad = getFuriganaBodyBottomPaddingPx(profile);

  return `
  ${POSTER_JP_FONT_FACE_CSS}
  .fv-html-poster-root .fv-title-h {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY};
    font-size: ${titleFs}px;
    font-weight: ${jpEmphasisWght};
    color: #111827;
    text-align: center;
    margin: 0 0 ${titleMb}px 0;
    line-height: ${isM ? d.titleLineHeightRatio : 1.45};
  }
  .fv-html-poster-root .fv-title-h {
    flex: 0 0 auto;
  }
  .fv-html-poster-root .fv-body-h {
    font-family: ${ZH_FONT_FAMILY};
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
    padding-bottom: ${bodyBottomPad}px;
  }
  .fv-html-poster-root .fv-body-h .lyrics-group {
    margin-bottom: ${groupMb};
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .fv-html-poster-root .fv-body-h > .lyrics-group:last-child {
    margin-bottom: 0;
  }
  .fv-html-poster-root .fv-body-h .lyrics-pagination-unit {
    margin-bottom: 0;
  }
  /* 条目间距：仅在含翻译行的块末尾生效（避免 :last-child 误伤分页后「每单元一条」） */
  .fv-html-poster-root .fv-body-h .lyrics-vocab-item:has(.vocab-ex-zh),
  .fv-html-poster-root .fv-body-h .lyrics-grammar-item:has(.grammar-ex-zh) {
    margin-bottom: ${itemEntryMb};
  }
  .fv-html-poster-root .fv-body-h > .lyrics-pagination-unit:last-child .lyrics-vocab-item:has(.vocab-ex-zh),
  .fv-html-poster-root .fv-body-h > .lyrics-pagination-unit:last-child .lyrics-grammar-item:has(.grammar-ex-zh),
  .fv-html-poster-root .fv-body-h .lyrics-vocabulary > .lyrics-vocab-item:last-child,
  .fv-html-poster-root .fv-body-h .lyrics-grammar > .lyrics-grammar-item:last-child {
    margin-bottom: 0;
  }
  .fv-html-poster-root .fv-body-h .lyrics-vocab-item,
  .fv-html-poster-root .fv-body-h .lyrics-grammar-item {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .fv-html-poster-root .fv-body-h .lyrics-group .jp-line,
  .fv-html-poster-root .fv-body-h .lyrics-group .zh-line {
    overflow: visible;
  }
  .fv-html-poster-root .fv-body-h .lyrics-pagination-unit .vocab-line1,
  .fv-html-poster-root .fv-body-h .lyrics-pagination-unit .vocab-ex-ja,
  .fv-html-poster-root .fv-body-h .lyrics-pagination-unit .vocab-ex-zh,
  .fv-html-poster-root .fv-body-h .lyrics-pagination-unit h3.grammar-point-title,
  .fv-html-poster-root .fv-body-h .lyrics-pagination-unit .grammar-detail,
  .fv-html-poster-root .fv-body-h .lyrics-pagination-unit .grammar-ex-ja,
  .fv-html-poster-root .fv-body-h .lyrics-pagination-unit .grammar-ex-zh {
    overflow: visible;
  }
  .fv-html-poster-root .fv-body-h.fv-body-overflow-debug {
    outline: 2px solid #ef4444;
    outline-offset: -2px;
  }
  .fv-html-poster-root .fv-body-h .lyrics-group .jp-line,
  .fv-html-poster-root .fv-body-h .lyrics-group .zh-line {
    width: fit-content;
    max-width: 100%;
    margin-left: auto;
    margin-right: auto;
    text-align: left;
  }
  .fv-html-poster-root .fv-body-h .lyrics-vocabulary,
  .fv-html-poster-root .fv-body-h .lyrics-grammar,
  .fv-html-poster-root .fv-body-h .lyrics-grammar-spacer,
  .fv-html-poster-root .fv-body-h .lyrics-vocab-item,
  .fv-html-poster-root .fv-body-h .lyrics-grammar-item {
    text-align: left;
  }
  .fv-html-poster-root .fv-body-h .lyrics-group .jp-line,
  .fv-html-poster-root .fv-body-h .lyrics-group .jp-line *:not(rt):not(rp) {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY} !important;
    font-size: ${jpFs}px !important;
    font-weight: ${jpWght} !important;
    color: #0a0a0a !important;
    line-height: ${jpLh} !important;
    margin: 0 !important;
    letter-spacing: normal;
    font-kerning: normal;
    font-feature-settings: "palt" 0;
  }
  .fv-html-poster-root .fv-body-h .lyrics-group .zh-line,
  .fv-html-poster-root .fv-body-h .lyrics-group .zh-line * {
    font-size: ${zhLyricsPx}px !important;
    font-weight: ${zhAuxWght} !important;
    color: #0a0a0a !important;
    line-height: ${zhLyricsLh} !important;
    font-family: ${ZH_FONT_FAMILY} !important;
    margin: ${lyricsJpZhGap} 0 0 0 !important;
  }
  .fv-html-poster-root .fv-body-h .jp-line,
  .fv-html-poster-root .fv-body-h .jp-line *:not(rt):not(rp) {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY} !important;
    font-size: ${jpFs}px !important;
    font-weight: ${jpWght} !important;
    color: #0a0a0a !important;
    line-height: ${jpLh} !important;
    letter-spacing: normal;
    font-kerning: normal;
    font-feature-settings: "palt" 0;
  }
  .fv-html-poster-root .fv-body-h .vocab-ex-ja,
  .fv-html-poster-root .fv-body-h .vocab-ex-ja *:not(rt):not(rp),
  .fv-html-poster-root .fv-body-h .grammar-ex-ja,
  .fv-html-poster-root .fv-body-h .grammar-ex-ja *:not(rt):not(rp) {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY} !important;
    font-size: ${jpFs}px !important;
    font-weight: ${jpWght} !important;
    color: #0a0a0a !important;
    line-height: ${jpLh} !important;
    margin: 0 !important;
  }
  .fv-html-poster-root .fv-body-h .vocab-ex-zh,
  .fv-html-poster-root .fv-body-h .vocab-ex-zh *,
  .fv-html-poster-root .fv-body-h .grammar-ex-zh,
  .fv-html-poster-root .fv-body-h .grammar-ex-zh *,
  .fv-html-poster-root .fv-body-h .grammar-detail,
  .fv-html-poster-root .fv-body-h .grammar-detail *:not(rt):not(rp),
  .fv-html-poster-root .fv-body-h .vocab-line1 {
    font-size: ${zhLyricsPx}px !important;
    font-weight: ${zhAuxWght} !important;
    color: #0a0a0a !important;
    line-height: ${zhLyricsLh} !important;
    font-family: ${ZH_FONT_FAMILY} !important;
  }
  .fv-html-poster-root .fv-body-h .vocab-line1 {
    margin: 0 0 ${auxJpZhGap} 0 !important;
  }
  .fv-html-poster-root .fv-body-h .vocab-ex-zh,
  .fv-html-poster-root .fv-body-h .grammar-ex-zh {
    margin: ${auxJpZhGap} 0 0 0 !important;
  }
  .fv-html-poster-root .fv-body-h .grammar-detail {
    margin: 0.15em 0 ${grammarDetailMb} 0 !important;
  }
  .fv-html-poster-root .fv-body-h .grammar-ex-ja {
    margin-top: ${grammarExMt} !important;
  }
  .fv-html-poster-root .fv-body-h .vocab-line1 .vocab-word,
  .fv-html-poster-root .fv-body-h .vocab-line1 .vocab-word *:not(rt):not(rp) {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY} !important;
    font-size: ${jpFs}px !important;
    font-weight: ${jpEmphasisWght} !important;
    color: #0a0a0a !important;
    line-height: ${jpLh} !important;
  }
  .fv-html-poster-root .fv-body-h .vocab-line1 .vocab-word ruby rt {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY} !important;
    font-size: ${isM ? '0.54em' : '0.58em'} !important;
    font-weight: ${jpWght} !important;
    color: #64748b !important;
    line-height: 1.1 !important;
  }
  .fv-html-poster-root .fv-body-h ruby {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY};
    ruby-position: over;
    -webkit-ruby-position: before;
    ruby-align: start;
  }
  .fv-html-poster-root .fv-body-h ruby rt {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY};
    font-size: ${isM ? '0.54em' : '0.58em'};
    font-weight: ${jpWght};
    color: #64748b;
    line-height: 1.1;
    letter-spacing: normal;
    font-feature-settings: "palt" 0;
  }
  .fv-html-poster-root .fv-body-h h2.lyrics-section-title {
    font-family: ${ZH_FONT_FAMILY};
    font-size: ${h2Fs}px;
    font-weight: 600;
    color: #1e293b;
    margin: ${isM ? '1em' : '1.25em'} 0 0.5em;
  }
  .fv-html-poster-root .fv-body-h .lyrics-grammar > h2.lyrics-section-title:first-child,
  .fv-html-poster-root .fv-body-h .lyrics-vocabulary > h2.lyrics-section-title:first-child {
    margin-top: ${isM ? '0.35em' : '0.5em'};
  }
  .fv-html-poster-root .fv-body-h .lyrics-grammar-item:first-child h3.grammar-point-title {
    margin-top: ${isM ? '0.45em' : '0.55em'};
  }
  .fv-html-poster-root .fv-body-h h3.grammar-point-title,
  .fv-html-poster-root .fv-body-h h3.grammar-point-title *:not(rp) {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY} !important;
    font-size: ${grammarPointTitleFs}px !important;
    font-weight: ${jpEmphasisWght} !important;
    color: #2c3e50 !important;
    line-height: ${isM ? d.elasticLhBase : 1.35};
  }
  .fv-html-poster-root .fv-body-h h3.grammar-point-title {
    margin: ${grammarTitleMt} 0 0.4em 0;
  }
  .fv-html-poster-root .fv-body-h h3.grammar-point-title ruby rt {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY};
    font-weight: ${jpEmphasisWght};
    color: #64748b;
  }
`;
}

/** 与预览页一致的海报根节点 inline 样式 */
export function buildFuriganaPosterRootStyle(
  profile: PosterLayoutProfile,
): Record<string, string | number> {
  const { width: w, height: h } = getFuriganaPosterCanvasDimensions(profile);
  const pad = getFuriganaCanvasInsets(profile);
  return {
    width: w,
    height: h,
    boxSizing: 'border-box',
    padding: `${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px`,
    background: '#fff',
    overflow: 'hidden',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  };
}
