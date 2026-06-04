import type { PosterLayoutProfile } from '../furiganaLayout/types';
import { dimForFuriganaPoster } from '../furiganaLayout/furiganaPosterShared';
import { POSTER_ELASTIC_FONT_BASE_PX } from '../furiganaLayout/dimensions';
import { KOZUKA_MINCHO_EL_FAMILY, ZH_FONT_FAMILY } from '../furiganaLayout/fonts';
import { mm, pxToMm, type PrintPageSpec } from './printPageSpec';

export type VectorPrintCssOptions = {
  spacingScale?: number;
};

function itemEntryGapMm(jpLh: number, jpFsPx: number, spec: PrintPageSpec): string {
  return mm(pxToMm(1.5 * jpLh * jpFsPx, spec));
}

/**
 * 打印专用 CSS（mm 单位），与屏幕预览 class 命名一致，供 expo-print / WKWebView 矢量渲染。
 */
export function buildVectorPrintInnerCss(
  profile: PosterLayoutProfile,
  spec: PrintPageSpec,
  options: VectorPrintCssOptions = {},
): string {
  const spacingScale = options.spacingScale ?? 1;
  const scale = (n: number) => n * spacingScale;
  const d = dimForFuriganaPoster(profile);
  const isM = profile === 'mobilePoster';
  const base = POSTER_ELASTIC_FONT_BASE_PX;
  const scaleBody = d.elasticFontBase / base;

  const jpFsPx = Math.round(26 * scaleBody);
  const titleFsPx = isM ? Math.round(jpFsPx * 1.22) : Math.round(jpFsPx * 1.25);
  const titleMbMm = mm(pxToMm(d.titleToBodyGap, spec));
  const zhLyricsPx = Math.round(18 * scaleBody);
  const h2FsPx = Math.round(18 * scaleBody);

  const jpLhBase = isM ? d.elasticLhBase : 1.75;
  const zhLyricsLhBase = isM ? 1.3 : 1.35;
  const jpLh = scale(jpLhBase);
  const zhLyricsLh = scale(zhLyricsLhBase);
  const jpWght = 200;
  const jpEmphasisWght = 700;
  const zhAuxWght = 300;

  const jpFs = mm(pxToMm(jpFsPx, spec));
  const titleFs = mm(pxToMm(titleFsPx, spec));
  const zhLyricsFs = mm(pxToMm(zhLyricsPx, spec));
  const h2Fs = mm(pxToMm(h2FsPx, spec));
  const pageNoFs = mm(pxToMm(13, spec));

  const groupMb = mm(pxToMm((isM ? 1.5 : 1.35) * jpFsPx, spec));
  const lyricsJpZhGap = mm(pxToMm((isM ? 0.06 : 0.04) * jpFsPx, spec));
  const auxJpZhGap = mm(pxToMm((isM ? 0.05 : 0.03) * zhLyricsPx, spec));
  const itemEntryMb = itemEntryGapMm(jpLhBase, jpFsPx, spec);
  const grammarDetailMb = mm(pxToMm((isM ? 0.7 : 0.55) * zhLyricsPx, spec));
  const grammarExMt = mm(pxToMm((isM ? 0.65 : 0.5) * jpFsPx, spec));
  const grammarTitleMt = mm(pxToMm((isM ? 1.15 : 1.35) * jpFsPx, spec));
  const grammarTitleFirstMt = mm(pxToMm((isM ? 0.45 : 0.55) * jpFsPx, spec));
  const sectionTitleMt = mm(pxToMm((isM ? 1 : 1.25) * h2FsPx, spec));
  const sectionTitleFirstMt = mm(pxToMm((isM ? 0.35 : 0.5) * h2FsPx, spec));
  const bodyBottomPad = mm(pxToMm(isM ? 64 : 32, spec));

  const pageNoBottom = mm(
    pxToMm(isM ? Math.round(d.pageBottomDefault * 0.42) : Math.round(d.pageBottomDefault * 0.28), spec),
  );
  const pageNoRight = mm(pxToMm(d.padH, spec));

  return `
  @page {
    size: ${spec.pageSizeCss};
    margin: 0;
  }
  * {
    box-sizing: border-box;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
  }
  .print-page {
    width: ${mm(spec.widthMm)};
    height: ${mm(spec.heightMm)};
    position: relative;
    box-sizing: border-box;
    padding: ${mm(spec.padTopMm)} ${mm(spec.padRightMm)} ${mm(spec.padBottomMm)} ${mm(spec.padLeftMm)};
    background: #fff;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
    display: flex;
    flex-direction: column;
  }
  .print-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .fv-html-poster-root {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    text-align: left;
  }
  .fv-title-h {
    font-family: ${ZH_FONT_FAMILY};
    font-size: ${titleFs};
    font-weight: ${zhAuxWght};
    color: #111827;
    text-align: center;
    margin: 0 0 ${titleMbMm} 0;
    line-height: ${isM ? d.titleLineHeightRatio : 1.45};
    flex: 0 0 auto;
    display: flex;
    align-items: baseline;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.35em;
  }
  .fv-title-artist {
    font-size: 0.58em;
    font-weight: ${zhAuxWght};
    color: #64748b;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .fv-body-h {
    font-family: ${ZH_FONT_FAMILY};
    flex: 0 1 auto;
    width: 100%;
    min-height: 0;
    overflow: hidden;
    padding-bottom: ${bodyBottomPad};
  }
  .fv-body-h .lyrics-group {
    margin-bottom: ${groupMb};
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .fv-body-h > .lyrics-group:last-child {
    margin-bottom: 0;
  }
  .fv-body-h .lyrics-vocab-item:has(.vocab-ex-zh),
  .fv-body-h .lyrics-grammar-item:has(.grammar-ex-zh) {
    margin-bottom: ${itemEntryMb};
  }
  .fv-body-h > .lyrics-pagination-unit:last-child .lyrics-vocab-item:has(.vocab-ex-zh),
  .fv-body-h > .lyrics-pagination-unit:last-child .lyrics-grammar-item:has(.grammar-ex-zh),
  .fv-body-h .lyrics-vocabulary > .lyrics-vocab-item:last-child,
  .fv-body-h .lyrics-grammar > .lyrics-grammar-item:last-child {
    margin-bottom: 0;
  }
  .fv-body-h .lyrics-vocab-item,
  .fv-body-h .lyrics-grammar-item {
    break-inside: avoid;
    page-break-inside: avoid;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  .fv-body-h .lyrics-group .jp-line,
  .fv-body-h .lyrics-group .zh-line {
    width: fit-content;
    max-width: 100%;
    margin-left: auto;
    margin-right: auto;
    text-align: left;
    overflow: visible;
  }
  .fv-body-h .jp-line,
  .fv-body-h .jp-line *:not(rt):not(rp) {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY};
    font-size: ${jpFs};
    font-weight: ${jpWght};
    color: #0a0a0a;
    line-height: ${jpLh};
    letter-spacing: normal;
  }
  .fv-body-h .lyrics-group .zh-line,
  .fv-body-h .lyrics-group .zh-line * {
    font-size: ${zhLyricsFs};
    font-weight: ${zhAuxWght};
    color: #0a0a0a;
    line-height: ${zhLyricsLh};
    font-family: ${ZH_FONT_FAMILY};
    margin: ${lyricsJpZhGap} 0 0 0;
  }
  .fv-body-h .vocab-ex-ja,
  .fv-body-h .vocab-ex-ja *:not(rt):not(rp),
  .fv-body-h .grammar-ex-ja,
  .fv-body-h .grammar-ex-ja *:not(rt):not(rp) {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY};
    font-size: ${jpFs};
    font-weight: ${jpWght};
    color: #0a0a0a;
    line-height: ${jpLh};
    margin: 0;
  }
  .fv-body-h .vocab-ex-zh,
  .fv-body-h .vocab-ex-zh *,
  .fv-body-h .grammar-ex-zh,
  .fv-body-h .grammar-ex-zh *,
  .fv-body-h .grammar-detail,
  .fv-body-h .grammar-detail *:not(rt):not(rp),
  .fv-body-h .vocab-line1 {
    font-size: ${zhLyricsFs};
    font-weight: ${zhAuxWght};
    color: #0a0a0a;
    line-height: ${zhLyricsLh};
    font-family: ${ZH_FONT_FAMILY};
  }
  .fv-body-h .vocab-line1 {
    margin: 0 0 ${auxJpZhGap} 0;
    border-bottom: 0.5px solid #e0e0e0;
    padding-bottom: ${auxJpZhGap};
    max-width: 100%;
    overflow-wrap: break-word;
    word-break: break-word;
    white-space: normal;
  }
  .fv-body-h .vocab-ex-zh,
  .fv-body-h .grammar-ex-zh {
    margin: ${auxJpZhGap} 0 0 0;
  }
  .fv-body-h .grammar-detail {
    margin: 0.15em 0 ${grammarDetailMb} 0;
    max-width: 100%;
    overflow-wrap: break-word;
    word-break: break-word;
    white-space: normal;
  }
  .fv-body-h .grammar-ex-ja {
    margin-top: ${grammarExMt};
    max-width: 100%;
    overflow-wrap: break-word;
    word-break: break-word;
    white-space: normal;
  }
  .fv-body-h .vocab-ex-ja,
  .fv-body-h .vocab-ex-zh,
  .fv-body-h .grammar-ex-zh {
    max-width: 100%;
    overflow-wrap: break-word;
    word-break: break-word;
    white-space: normal;
  }
  .fv-body-h .vocab-line1 .vocab-word,
  .fv-body-h .vocab-line1 .vocab-word *:not(rt):not(rp) {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY};
    font-size: ${jpFs};
    font-weight: ${jpEmphasisWght};
    color: #0a0a0a;
    line-height: ${jpLh};
  }
  .fv-body-h ruby {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY};
    ruby-position: over;
    -webkit-ruby-position: before;
    ruby-align: start;
  }
  .fv-body-h ruby rt {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY};
    font-size: ${isM ? '0.54em' : '0.58em'};
    font-weight: ${jpWght};
    color: #64748b;
    line-height: 1.1;
  }
  .fv-body-h h2.lyrics-section-title {
    font-family: ${ZH_FONT_FAMILY};
    font-size: ${h2Fs};
    font-weight: ${zhAuxWght};
    color: #1e293b;
    margin: ${sectionTitleMt} 0 0.5em;
    border-top: 0.5px solid #e0e0e0;
    padding-top: ${sectionTitleFirstMt};
  }
  .fv-body-h .lyrics-grammar > h2.lyrics-section-title:first-child,
  .fv-body-h .lyrics-vocabulary > h2.lyrics-section-title:first-child {
    margin-top: ${sectionTitleFirstMt};
    border-top: none;
    padding-top: 0;
  }
  .fv-body-h h3.grammar-point-title {
    font-family: ${ZH_FONT_FAMILY};
    font-size: ${zhLyricsFs};
    font-weight: ${zhAuxWght};
    color: #0a0a0a;
    line-height: ${zhLyricsLh};
    margin: ${grammarTitleMt} 0 0.4em 0;
    width: 100%;
    max-width: 100%;
    overflow-wrap: break-word;
    word-break: break-word;
    white-space: normal;
  }
  .fv-body-h h3.grammar-point-title .grammar-title-ja,
  .fv-body-h h3.grammar-point-title .grammar-title-ja *:not(rt):not(rp) {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY};
    font-size: ${jpFs};
    font-weight: ${jpEmphasisWght};
    line-height: ${jpLh};
    color: #0a0a0a;
  }
  .fv-body-h h3.grammar-point-title .grammar-title-zh,
  .fv-body-h h3.grammar-point-title .grammar-title-zh * {
    font-family: ${ZH_FONT_FAMILY};
    font-size: ${zhLyricsFs};
    font-weight: ${zhAuxWght};
    line-height: ${zhLyricsLh};
    color: #0a0a0a;
  }
  .fv-body-h h3.grammar-point-title ruby rt {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY};
    font-size: ${isM ? '0.54em' : '0.58em'};
    font-weight: ${jpWght};
    color: #64748b;
    line-height: 1.1;
  }
  .fv-body-h .vocab-line1 .vocab-meaning,
  .fv-body-h h3.grammar-point-title .grammar-title-zh,
  .fv-body-h h3.grammar-point-title .grammar-title-zh * {
    font-family: ${ZH_FONT_FAMILY};
    font-weight: ${zhAuxWght};
  }
  .fv-body-h .lyrics-grammar-item:first-child h3.grammar-point-title {
    margin-top: ${grammarTitleFirstMt};
  }
  .fv-poster-page-no {
    position: absolute;
    right: ${pageNoRight};
    bottom: ${pageNoBottom};
    font-size: ${pageNoFs};
    color: #94a3b8;
    font-family: ${ZH_FONT_FAMILY};
    font-weight: 400;
    letter-spacing: 0.04em;
  }
`;
}
