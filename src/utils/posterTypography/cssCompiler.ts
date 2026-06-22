import {
  EN_FONT_FAMILY,
  KO_FONT_FAMILY,
  KOZMIN_PRO_REGULAR_FAMILY,
  KOZUKA_MINCHO_EL_FAMILY,
  ZH_FONT_FAMILY,
  getPosterEnglishFontFaceCss,
  getPosterJapaneseFontsFaceCss,
  getPosterKoreanFontFaceCss,
} from '../shufuriPoster/fonts.ts';
import { dimForProfile } from '../shufuriPoster/dimensions.ts';
import {
  buildCjkNoBreakClassCss,
  buildCjkWrapCss,
  buildLatinWrapCss,
} from '../shufuriPoster/cjkTypography.ts';
import { ZH_CHAR_SLOT_CLASS } from '../zhLayout/zhRubyMarkup.ts';
import {
  AUX_WEIGHT,
  JP_RUBY_WEIGHT,
  KO_PRIMARY_WEIGHT,
  LYRIC_PRIMARY_WEIGHT,
  LYRIC_SECONDARY_WEIGHT,
} from './typographyConstants.ts';
import type { ResolvedTypography } from './tokenRegistry.ts';
import { mm, pxToMm, type PrintPageSpec } from '../vectorPrint/printPageSpec.ts';

export type CompilePosterCssOptions = {
  unit?: 'px' | 'mm';
  spec?: PrintPageSpec;
  viewMode?: 'screen' | 'edit';
  includeFontFaces?: boolean;
  showRuby?: boolean;
};

function compileRubyVisibilityCss(showRuby: boolean): string {
  if (showRuby) return '';
  return `
  .fv-html-poster-root[data-ruby-visible="false"] ruby rt,
  .fv-html-poster-root[data-ruby-visible="false"] ruby rp {
    display: none !important;
    height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    font-size: 0 !important;
    line-height: 0 !important;
  }`;
}

function size(px: number, unit: 'px' | 'mm', spec?: PrintPageSpec): string {
  if (unit === 'px') return `${px}px`;
  if (!spec) throw new Error('PrintPageSpec required for mm unit');
  return mm(pxToMm(px, spec));
}

function emSize(em: string, basePx: number, unit: 'px' | 'mm', spec?: PrintPageSpec): string {
  const num = parseFloat(em);
  if (unit === 'px') return `${Math.round(num * basePx)}px`;
  if (!spec) throw new Error('PrintPageSpec required for mm unit');
  return mm(pxToMm(num * basePx, spec));
}

function compileZhLayoutCss(r: ResolvedTypography, unit: 'px' | 'mm', spec?: PrintPageSpec): string {
  const zh = r.zhLayout;
  if (!zh) return '';
  const cjkWrap = buildCjkWrapCss();
  const latinWrap = buildLatinWrapCss();
  const ZH_CHAR_SLOT = `.${ZH_CHAR_SLOT_CLASS}`;
  const root = unit === 'mm' ? '.fv-body-h' : '.fv-html-poster-root .fv-body-h';
  const scoped = (sel: string) => `\n  ${root} ${sel}`;
  const zhVocab = (sel: string) =>
    `${scoped(`.lyrics-vocabulary--zh ${sel}`)},${scoped(`.lyrics-vocab-item--zh ${sel}`)}`;
  const zhGrammar = (sel: string) =>
    `${scoped(`.lyrics-grammar--zh ${sel}`)},${scoped(`.lyrics-grammar-item--zh ${sel}`)}`;
  const fs = (px: number) => size(px, unit, spec);
  const gap = (em: number) =>
    unit === 'px' ? `${em}em` : emSize(`${em}`, r.layout.auxPx, unit, spec);

  return `
  ${root} .lyrics-group--zh,
  ${root} .lyrics-group:has(.cn-line) {
    display: flex;
    flex-direction: column;
  }
  ${scoped('.cn-line')},
  ${scoped('.cn-line *:not(rt):not(rp):not(' + ZH_CHAR_SLOT + ')')},
  ${zhVocab('.vocab-word-cn')},
  ${zhVocab('.vocab-word-cn *:not(rt):not(rp):not(' + ZH_CHAR_SLOT + ')')},
  ${zhGrammar('.grammar-title-cn')},
  ${zhGrammar('.grammar-title-cn *:not(rt):not(rp):not(' + ZH_CHAR_SLOT + ')')} {
    font-family: ${ZH_FONT_FAMILY} !important;
    font-size: ${fs(zh.cnFs)} !important;
    font-weight: ${LYRIC_PRIMARY_WEIGHT} !important;
    line-height: ${zh.mainLh} !important;
    color: #0a0a0a !important;
    letter-spacing: ${r.cjkLetterSpacing} !important;
    ${cjkWrap}
  }
  ${zhVocab('.vocab-ex-cn')},
  ${zhVocab('.vocab-ex-cn *:not(rt):not(rp):not(' + ZH_CHAR_SLOT + ')')},
  ${zhGrammar('.grammar-ex-cn')},
  ${zhGrammar('.grammar-ex-cn *:not(rt):not(rp):not(' + ZH_CHAR_SLOT + ')')} {
    font-family: ${ZH_FONT_FAMILY} !important;
    font-size: ${fs(zh.glossFs)} !important;
    font-weight: ${LYRIC_PRIMARY_WEIGHT} !important;
    line-height: ${zh.mainLh} !important;
    color: #0a0a0a !important;
    letter-spacing: ${r.cjkLetterSpacing} !important;
    ${cjkWrap}
  }
  ${scoped('.cn-line')},
  ${zhVocab('.vocab-word-cn')},
  ${zhVocab('.vocab-ex-cn')},
  ${zhGrammar('.grammar-title-cn')},
  ${zhGrammar('.grammar-ex-cn')} {
    margin: 0 !important;
  }
  ${zhVocab('.vocab-line1')} {
    font-size: unset !important;
    font-weight: unset !important;
    line-height: unset !important;
    color: unset !important;
    margin: 0 !important;
  }
  ${zhVocab('.vocab-ex-cn')} {
    margin-top: ${gap(zh.lyricsAuxGapEm)} !important;
  }
  ${scoped('.lyrics-vocab-item--zh')} {
    margin-bottom: ${gap(zh.vocabItemMbEm)} !important;
  }
  ${root} > .lyrics-pagination-unit:last-child .lyrics-vocab-item--zh,
  ${root} .lyrics-vocabulary--zh > .lyrics-vocab-item--zh:last-child {
    margin-bottom: 0 !important;
  }
  ${scoped('.lyrics-grammar-item--zh')} {
    margin-bottom: ${fs(zh.grammarItemMbPx)} !important;
  }
  ${root} > .lyrics-pagination-unit:last-child .lyrics-grammar-item--zh,
  ${root} .lyrics-grammar--zh > .lyrics-grammar-item--zh:last-child {
    margin-bottom: 0 !important;
  }
  ${zhGrammar('h3.grammar-point-title')} {
    position: relative;
    padding-left: ${zh.bulletBasePx + 6}px;
    margin: 0 0 ${gap(zh.lyricsAuxGapEm)} 0 !important;
    font-size: unset !important;
    font-weight: unset !important;
    line-height: unset !important;
    color: unset !important;
  }
  ${zhGrammar('h3.grammar-point-title::before')} {
    content: '';
    position: absolute;
    left: 0;
    top: ${zh.bulletTopPx}px;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: ${zh.bulletLegPx}px 0 ${zh.bulletLegPx}px ${zh.bulletBasePx}px;
    border-color: transparent transparent transparent ${zh.pinyinColor};
  }
  ${scoped('.cn-line ' + ZH_CHAR_SLOT)},
  ${zhVocab('.vocab-word-cn ' + ZH_CHAR_SLOT)},
  ${zhVocab('.vocab-ex-cn ' + ZH_CHAR_SLOT)},
  ${zhGrammar('.grammar-title-cn ' + ZH_CHAR_SLOT)},
  ${zhGrammar('.grammar-ex-cn ' + ZH_CHAR_SLOT)} {
    display: inline-block;
    margin-right: ${gap(zh.rubyGapEm)};
    vertical-align: bottom;
  }
  ${scoped('.cn-line ruby')},
  ${zhVocab('.vocab-word-cn ruby')},
  ${zhVocab('.vocab-ex-cn ruby')},
  ${zhGrammar('.grammar-title-cn ruby')},
  ${zhGrammar('.grammar-ex-cn ruby')} {
    font-family: ${ZH_FONT_FAMILY} !important;
    font-weight: ${LYRIC_PRIMARY_WEIGHT} !important;
    ruby-position: over;
    -webkit-ruby-position: over;
    ruby-align: center;
    letter-spacing: 0 !important;
  }
  ${scoped('.cn-line ruby rt')},
  ${zhVocab('.vocab-word-cn ruby rt')},
  ${zhVocab('.vocab-ex-cn ruby rt')},
  ${zhGrammar('.grammar-title-cn ruby rt')},
  ${zhGrammar('.grammar-ex-cn ruby rt')} {
    font-family: ${ZH_FONT_FAMILY} !important;
    font-size: ${zh.rtEm}em !important;
    font-weight: ${LYRIC_PRIMARY_WEIGHT} !important;
    letter-spacing: normal !important;
    text-align: center !important;
    color: ${zh.pinyinColor} !important;
    line-height: 1.1 !important;
    user-select: none;
  }
  ${scoped('.gloss-line')},
  ${scoped('.gloss-line *')} {
    font-family: ${KOZMIN_PRO_REGULAR_FAMILY} !important;
    font-size: ${fs(zh.glossFs)} !important;
    font-weight: ${LYRIC_SECONDARY_WEIGHT} !important;
    line-height: ${zh.glossLh} !important;
    color: #64748b !important;
    letter-spacing: 0 !important;
    ${latinWrap}
  }
  ${zhVocab('.vocab-ex-gloss')},
  ${zhVocab('.vocab-ex-gloss *')},
  ${zhGrammar('.grammar-title-gloss')},
  ${zhGrammar('.grammar-ex-gloss')},
  ${zhGrammar('.grammar-ex-gloss *')} {
    font-family: ${ZH_FONT_FAMILY} !important;
    font-size: ${fs(zh.glossFs)} !important;
    font-weight: ${LYRIC_SECONDARY_WEIGHT} !important;
    line-height: ${zh.glossLh} !important;
    color: #64748b !important;
    letter-spacing: 0 !important;
    ${latinWrap}
  }
  ${zhVocab('.vocab-meaning')} {
    font-family: ${ZH_FONT_FAMILY} !important;
    font-size: ${fs(zh.glossFs)} !important;
    font-weight: ${LYRIC_SECONDARY_WEIGHT} !important;
    line-height: ${zh.glossLh} !important;
    color: #64748b !important;
    letter-spacing: 0 !important;
    ${latinWrap}
  }
  ${zhGrammar('.grammar-detail')} {
    font-family: ${ZH_FONT_FAMILY} !important;
    font-size: ${fs(zh.glossFs)} !important;
    font-weight: ${LYRIC_SECONDARY_WEIGHT} !important;
    line-height: ${zh.glossLh} !important;
    color: #64748b !important;
    letter-spacing: 0 !important;
    margin: 0 0 ${gap(zh.lyricsAuxGapEm)} 0 !important;
    ${latinWrap}
  }
  ${zhGrammar('.grammar-ex-cn')} {
    margin-top: ${gap(zh.lyricsAuxGapEm)} !important;
  }
  ${scoped('.gloss-line')},
  ${zhVocab('.vocab-ex-gloss')},
  ${zhGrammar('.grammar-ex-gloss')} {
    margin: ${gap(zh.lyricsAuxGapEm)} 0 0 0 !important;
  }`;
}

function compileBodyRules(r: ResolvedTypography, unit: 'px' | 'mm', spec?: PrintPageSpec): string {
  const { layout: L, flags: F, roles: R } = r;
  const cjkWrap = buildCjkWrapCss();
  const latinWrap = buildLatinWrapCss();
  const root = unit === 'mm' ? '' : '.fv-html-poster-root ';
  const bodySel = `${root}.fv-body-h`;
  const titleSel = `${root}.fv-title-h`;
  const fs = (px: number) => size(px, unit, spec);
  const titleFs = fs(L.titleFsPx);
  const mainFs = fs(L.mainPx);
  const auxFs = fs(L.auxPx);
  const h2Fs = fs(L.h2Px);

  const jpLyricFont = F.isEnglish ? EN_FONT_FAMILY : KOZMIN_PRO_REGULAR_FAMILY;
  const jpStudyFont = F.isEnglish ? EN_FONT_FAMILY : KOZMIN_PRO_REGULAR_FAMILY;
  const primaryWght = LYRIC_PRIMARY_WEIGHT;
  const zhAuxWght = LYRIC_SECONDARY_WEIGHT;
  const koWght = KO_PRIMARY_WEIGHT;
  const rtEm = L.mainRtEm;

  const titleFont = R.posterTitle.fontFamily;
  const titleWght = R.posterTitle.fontWeight;
  const artistWght = R.posterArtist.fontWeight;
  const sectionTitleFont = R.sectionTitle.fontFamily;
  const studyTermLh = r.lang === 'ko' || r.lang === 'en' ? L.koLh : L.jpLh;
  const studyTerm = R.studyTerm;

  return `
  ${titleSel} {
    font-family: ${titleFont};
    font-size: ${titleFs};
    font-weight: ${titleWght};
    color: #111827;
    text-align: center;
    margin: 0 0 ${fs(L.titleMbPx)} 0;
    line-height: ${L.titleLineHeight};
    display: flex;
    align-items: baseline;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.35em;
    ${unit === 'mm' ? 'flex: 0 0 auto;' : ''}
  }
  ${root}.fv-title-artist {
    font-size: 0.58em;
    font-weight: ${artistWght};
    color: #64748b;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  ${root}.fv-title-name--placeholder,
  ${root}.fv-title-artist--placeholder {
    color: #cbd5e1;
    font-weight: 400;
  }
  ${bodySel} {
    font-family: ${ZH_FONT_FAMILY};
    display: block;
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
    padding-bottom: ${fs(L.bodyBottomPadPx)};
    text-align: left;
    ${unit === 'mm' ? 'flex: 0 1 auto; min-height: 0;' : ''}
  }
  ${bodySel} .lyrics-group {
    margin-bottom: ${unit === 'px' ? L.groupMb : emSize(L.groupMb, L.mainPx, unit, spec)};
    break-inside: avoid;
    page-break-inside: avoid;
    overflow: hidden;
    max-width: 100%;
    box-sizing: border-box;
  }
  ${bodySel} > .lyrics-group:last-child { margin-bottom: 0; }
  ${bodySel} .lyrics-pagination-unit { margin-bottom: 0; }
  ${bodySel} .lyrics-vocab-item:has(.vocab-ex-zh),
  ${bodySel} .lyrics-grammar-item:has(.grammar-ex-zh) {
    margin-bottom: ${unit === 'px' ? L.itemEntryMb : size(Math.round(1.5 * (L.jpLh / r.spacingScale) * L.mainPx), unit, spec)};
  }
  ${bodySel} > .lyrics-pagination-unit:last-child .lyrics-vocab-item:has(.vocab-ex-zh),
  ${bodySel} > .lyrics-pagination-unit:last-child .lyrics-grammar-item:has(.grammar-ex-zh),
  ${bodySel} .lyrics-vocabulary > .lyrics-vocab-item:last-child,
  ${bodySel} .lyrics-grammar > .lyrics-grammar-item:last-child {
    margin-bottom: 0;
  }
  ${bodySel} .lyrics-vocab-item,
  ${bodySel} .lyrics-grammar-item {
    break-inside: avoid;
    page-break-inside: avoid;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  ${bodySel} .lyrics-group .jp-line,
  ${bodySel} .lyrics-group .ko-line,
  ${bodySel} .lyrics-group .zh-line,
  ${bodySel} .lyrics-group .cn-line {
    overflow: hidden;
    ${cjkWrap}
    ${unit === 'mm' ? 'width: 100%; max-width: 100%; text-align: left; margin: 0;' : ''}
  }
  ${bodySel} .lyrics-pagination-unit .vocab-line1,
  ${bodySel} .lyrics-pagination-unit .vocab-ex-ja,
  ${bodySel} .lyrics-pagination-unit .vocab-ex-ko,
  ${bodySel} .lyrics-pagination-unit .vocab-ex-zh,
  ${bodySel} .lyrics-pagination-unit .vocab-ex-cn,
  ${bodySel} .lyrics-pagination-unit h3.grammar-point-title,
  ${bodySel} .lyrics-pagination-unit .grammar-ex-ja,
  ${bodySel} .lyrics-pagination-unit .grammar-ex-ko,
  ${bodySel} .lyrics-pagination-unit .grammar-ex-zh,
  ${bodySel} .lyrics-pagination-unit .grammar-ex-cn {
    overflow: hidden;
    ${cjkWrap}
  }
  ${bodySel} .lyrics-pagination-unit .grammar-detail,
  ${bodySel} .lyrics-pagination-unit .vocab-ex-gloss,
  ${bodySel} .lyrics-pagination-unit .grammar-ex-gloss,
  ${bodySel} .lyrics-pagination-unit .gloss-line {
    overflow: hidden;
    ${latinWrap}
  }
  ${bodySel} .lyrics-group .jp-line,
  ${bodySel} .lyrics-group .jp-line *:not(rt):not(rp) {
    font-family: ${jpLyricFont} !important;
    font-size: ${mainFs} !important;
    font-weight: ${primaryWght} !important;
    color: #0a0a0a !important;
    line-height: ${L.jpLh} !important;
    margin: 0 !important;
    letter-spacing: ${r.cjkLetterSpacing};
    font-kerning: normal;
    font-feature-settings: "palt" 0;
  }
  ${bodySel} .lyrics-group .ko-line,
  ${bodySel} .lyrics-group .ko-line * { margin: 0 !important; }
  ${bodySel} .lyrics-group .zh-line,
  ${bodySel} .lyrics-group .zh-line * {
    font-size: ${auxFs} !important;
    font-weight: ${zhAuxWght} !important;
    color: #0a0a0a !important;
    line-height: ${L.zhLyricsLh} !important;
    font-family: ${ZH_FONT_FAMILY} !important;
    margin: ${unit === 'px' ? L.lyricsJpZhGap : emSize(L.lyricsJpZhGap, L.mainPx, unit, spec)} 0 0 0 !important;
    letter-spacing: ${r.cjkLetterSpacing};
  }
  ${bodySel} .lyrics-group .gloss-line,
  ${bodySel} .lyrics-group .gloss-line * {
    font-family: ${KOZMIN_PRO_REGULAR_FAMILY} !important;
    font-size: ${auxFs} !important;
    font-weight: ${zhAuxWght} !important;
    color: ${F.isZhPipeline ? '#64748b' : '#0a0a0a'} !important;
    line-height: ${L.zhLyricsLh} !important;
    margin: ${unit === 'px' ? L.lyricsJpZhGap : emSize(L.lyricsJpZhGap, L.mainPx, unit, spec)} 0 0 0 !important;
    letter-spacing: 0 !important;
    ${latinWrap}
  }
  ${bodySel} .jp-line,
  ${bodySel} .jp-line *:not(rt):not(rp) {
    font-family: ${jpLyricFont} !important;
    font-size: ${mainFs} !important;
    font-weight: ${primaryWght} !important;
    color: #0a0a0a !important;
    line-height: ${L.jpLh} !important;
    letter-spacing: ${r.cjkLetterSpacing};
    font-kerning: normal;
    font-feature-settings: "palt" 0;
  }
  ${bodySel} .ko-line,
  ${bodySel} .ko-line * {
    font-family: ${KO_FONT_FAMILY} !important;
    font-size: ${mainFs} !important;
    font-weight: ${koWght} !important;
    color: #0a0a0a !important;
    line-height: ${L.koLh} !important;
    letter-spacing: ${r.cjkLetterSpacing};
  }
  ${bodySel} .vocab-ex-ja,
  ${bodySel} .vocab-ex-ja *:not(rt):not(rp),
  ${bodySel} .grammar-ex-ja,
  ${bodySel} .grammar-ex-ja *:not(rt):not(rp) {
    font-family: ${jpStudyFont} !important;
    font-size: ${auxFs} !important;
    font-weight: ${primaryWght} !important;
    color: #0a0a0a !important;
    line-height: ${L.jpLh} !important;
    margin: 0 !important;
  }
  ${bodySel} .vocab-ex-ko,
  ${bodySel} .vocab-ex-ko *,
  ${bodySel} .grammar-ex-ko,
  ${bodySel} .grammar-ex-ko * {
    font-family: ${KO_FONT_FAMILY} !important;
    font-size: ${auxFs} !important;
    font-weight: ${koWght} !important;
    color: #0a0a0a !important;
    line-height: ${L.koLh} !important;
    margin: 0 !important;
  }
  ${bodySel} .vocab-ex-zh,
  ${bodySel} .vocab-ex-zh *,
  ${bodySel} .grammar-ex-zh,
  ${bodySel} .grammar-ex-zh *,
  ${bodySel} .grammar-detail,
  ${bodySel} .grammar-detail *:not(rt):not(rp)${F.isZhPipeline ? '' : `,\n  ${bodySel} .vocab-line1`} {
    font-size: ${auxFs} !important;
    font-weight: ${zhAuxWght} !important;
    color: #0a0a0a !important;
    line-height: ${L.zhLyricsLh} !important;
    font-family: ${ZH_FONT_FAMILY} !important;
  }
  ${F.isZhPipeline ? '' : `
  ${bodySel} .vocab-line1 {
    margin: 0 0 ${unit === 'px' ? L.auxJpZhGap : emSize(L.auxJpZhGap, L.auxPx, unit, spec)} 0 !important;
    max-width: 100%;
    ${cjkWrap}
    ${unit === 'mm' ? `border-bottom: 0.5px solid #e0e0e0; padding-bottom: ${emSize(L.auxJpZhGap, L.auxPx, unit, spec)};` : ''}
  }`}
  ${bodySel} .vocab-ex-zh,
  ${bodySel} .grammar-ex-zh {
    margin: ${unit === 'px' ? L.auxJpZhGap : emSize(L.auxJpZhGap, L.auxPx, unit, spec)} 0 0 0 !important;
  }
  ${bodySel} .vocab-ex-gloss,
  ${bodySel} .vocab-ex-gloss *,
  ${bodySel} .grammar-title-gloss,
  ${bodySel} .grammar-ex-gloss,
  ${bodySel} .grammar-ex-gloss * {
    font-family: ${ZH_FONT_FAMILY} !important;
    font-size: ${auxFs} !important;
    font-weight: ${zhAuxWght} !important;
    color: #0a0a0a !important;
    line-height: ${L.zhLyricsLh} !important;
    ${latinWrap}
  }
  ${bodySel} .grammar-detail {
    margin: 0.15em 0 ${unit === 'px' ? L.grammarDetailMb : emSize(L.grammarDetailMb, L.auxPx, unit, spec)} 0 !important;
    max-width: 100%;
    ${latinWrap}
  }
  ${bodySel} .vocab-ex-ja,
  ${bodySel} .vocab-ex-ko,
  ${bodySel} .vocab-ex-zh,
  ${bodySel} .grammar-ex-ja,
  ${bodySel} .grammar-ex-ko,
  ${bodySel} .grammar-ex-zh {
    max-width: 100%;
    ${cjkWrap}
  }
  ${bodySel} .grammar-ex-ja {
    margin-top: ${unit === 'px' ? L.grammarExMt : emSize(L.grammarExMt, L.mainPx, unit, spec)} !important;
  }
  ${bodySel} .vocab-line1 .vocab-word,
  ${bodySel} .vocab-line1 .vocab-word *:not(rt):not(rp),
  ${bodySel} h3.grammar-point-title .grammar-title-ja,
  ${bodySel} h3.grammar-point-title .grammar-title-ja *:not(rt):not(rp) {
    font-family: ${studyTerm.fontFamily} !important;
    font-size: ${mainFs} !important;
    font-weight: ${studyTerm.fontWeight} !important;
    color: ${studyTerm.color} !important;
    line-height: ${studyTermLh} !important;
  }
  ${bodySel} .vocab-line1 .vocab-word-ko,
  ${bodySel} .vocab-line1 .vocab-word-ko *,
  ${bodySel} h3.grammar-point-title .grammar-title-ko,
  ${bodySel} h3.grammar-point-title .grammar-title-ko * {
    font-family: ${KO_FONT_FAMILY} !important;
    font-size: ${mainFs} !important;
    font-weight: ${koWght} !important;
    color: ${r.vocabEmphasisColor} !important;
    line-height: ${L.koLh} !important;
  }
  ${bodySel} .vocab-line1 .vocab-word ruby rt {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY} !important;
    font-size: ${rtEm}em !important;
    font-weight: ${JP_RUBY_WEIGHT} !important;
    color: #64748b !important;
    line-height: 1.1 !important;
  }
  ${F.isZhPipeline ? '' : `
  ${bodySel} ruby {
    font-family: ${jpStudyFont};
    ruby-position: over;
    -webkit-ruby-position: before;
    ruby-align: start;
  }
  ${bodySel} ruby rt {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY};
    font-size: ${rtEm}em;
    font-weight: ${JP_RUBY_WEIGHT};
    color: #64748b;
    line-height: 1.1;
    letter-spacing: normal;
    font-feature-settings: "palt" 0;
    max-width: 100%;
  }`}
  ${bodySel} h2.lyrics-section-title {
    font-family: ${sectionTitleFont};
    font-size: ${h2Fs};
    font-weight: ${AUX_WEIGHT};
    color: #1e293b;
    margin: ${unit === 'px' ? L.sectionTitleMt : emSize(L.sectionTitleMt, L.h2Px, unit, spec)} 0 0.5em;
    ${unit === 'mm' ? `border-top: 0.5px solid #e0e0e0; padding-top: ${emSize(L.sectionTitleFirstMt, L.h2Px, unit, spec)};` : ''}
  }
  ${bodySel} .lyrics-grammar > h2.lyrics-section-title:first-child,
  ${bodySel} .lyrics-vocabulary > h2.lyrics-section-title:first-child {
    margin-top: ${unit === 'px' ? L.sectionTitleFirstMt : emSize(L.sectionTitleFirstMt, L.h2Px, unit, spec)};
    ${unit === 'mm' ? 'border-top: none; padding-top: 0;' : ''}
  }
  ${bodySel} .lyrics-grammar-item:first-child h3.grammar-point-title {
    margin-top: ${unit === 'px' ? L.grammarTitleFirstMt : emSize(L.grammarTitleFirstMt, L.mainPx, unit, spec)};
  }
  ${bodySel} h3.grammar-point-title {
    font-size: unset !important;
    font-weight: unset !important;
    line-height: unset !important;
    color: unset !important;
    font-family: unset !important;
    margin: ${unit === 'px' ? L.grammarTitleMt : emSize(L.grammarTitleMt, L.mainPx, unit, spec)} 0 0.4em 0;
    width: 100%;
    max-width: 100%;
    letter-spacing: ${r.cjkLetterSpacing};
    ${cjkWrap}
  }
  ${bodySel} h3.grammar-point-title .grammar-title-zh,
  ${bodySel} h3.grammar-point-title .grammar-title-zh *,
  ${bodySel} h3.grammar-point-title .grammar-title-gloss,
  ${bodySel} h3.grammar-point-title .grammar-title-gloss * {
    font-family: ${ZH_FONT_FAMILY} !important;
    font-size: ${auxFs} !important;
    font-weight: ${zhAuxWght} !important;
    line-height: ${L.zhLyricsLh} !important;
    color: #0a0a0a !important;
    -webkit-text-size-adjust: 100%;
    ${latinWrap}
  }
  ${bodySel} h3.grammar-point-title ruby rt {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY};
    font-size: ${rtEm}em;
    font-weight: ${JP_RUBY_WEIGHT};
    color: #64748b;
    line-height: 1.1;
    max-width: 100%;
  }
  ${bodySel} .vocab-line1 .vocab-meaning {
    font-family: ${ZH_FONT_FAMILY} !important;
    font-weight: ${zhAuxWght} !important;
  }`;
}

function compilePrintPageShell(spec: PrintPageSpec): string {
  return `
  @page {
    size: ${spec.pageSizeCss};
    margin: 0;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
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
    text-align: left;
    justify-content: flex-start;
    align-items: stretch;
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
    justify-content: flex-start;
    align-items: stretch;
    position: relative;
    text-align: left;
  }`;
}

function compilePageNumberCss(
  r: ResolvedTypography,
  unit: 'px' | 'mm',
  spec?: PrintPageSpec,
): string {
  if (unit === 'px') return '';
  const d = dimForProfile(r.profile);
  const pageNoBottomPx =
    r.profile === 'mobilePoster'
      ? Math.round(d.pageBottomDefault * 0.42)
      : r.profile === 'squarePoster'
        ? Math.round(d.pageBottomDefault * 0.38)
        : Math.round(d.pageBottomDefault * 0.28);
  return `
  .fv-poster-page-no {
    position: absolute;
    right: ${size(d.padH, unit, spec)};
    bottom: ${size(pageNoBottomPx, unit, spec)};
    font-size: ${size(13, unit, spec)};
    color: #94a3b8;
    font-family: ${r.roles.posterTitle.fontFamily};
    font-weight: 400;
    letter-spacing: 0.04em;
  }`;
}

export function compilePosterCss(
  resolved: ResolvedTypography,
  options: CompilePosterCssOptions = {},
): string {
  const unit = options.unit ?? 'px';
  const spec = options.spec;
  const includeFontFaces = options.includeFontFaces ?? unit === 'px';

  const fontFaces = includeFontFaces
    ? `${getPosterJapaneseFontsFaceCss()}${getPosterKoreanFontFaceCss()}${getPosterEnglishFontFaceCss()}`
    : '';

  const printShell = unit === 'mm' && spec ? compilePrintPageShell(spec) : '';
  const bodyRules = compileBodyRules(resolved, unit, spec);
  const zhRules = resolved.flags.isZhPipeline
    ? compileZhLayoutCss(resolved, unit, spec)
    : '';
  const pageNo = compilePageNumberCss(resolved, unit, spec);
  const cjkNoBreak = buildCjkNoBreakClassCss();
  const showRuby = options.showRuby ?? resolved.flags.showRuby;
  const rubyVisibility = compileRubyVisibilityCss(showRuby);

  return `${fontFaces}${printShell}${bodyRules}${zhRules}${pageNo}${cjkNoBreak}${rubyVisibility}`;
}

export function compileEditCssOverrides(): string {
  return `
  .fv-html-poster-root.fv-edit-document-root {
    height: auto !important;
    min-height: unset !important;
    overflow: visible !important;
  }
  .fv-html-poster-root.fv-edit-document-root .fv-body-h {
    overflow: visible !important;
    max-height: none !important;
    height: auto !important;
    flex: none !important;
  }`;
}
