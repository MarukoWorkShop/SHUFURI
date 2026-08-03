import {
  EN_FONT_FAMILY,
  KO_FONT_FAMILY,
  KOZMIN_PRO_REGULAR_FAMILY,
  ZH_FONT_FAMILY,
  ZH_SONGTI_FONT_FAMILY,
  getPosterEnglishFontFaceCss,
  getPosterJapaneseFontsFaceCss,
  getPosterKoreanFontFaceCss,
  getPosterSourceHanSerifScFontFaceCss,
  getPosterSansationFontFaceCss,
} from '../shufuriPoster/fonts.ts';
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
  BODY_TEXT_COLOR,
  TITLE_TEXT_COLOR,
  GLOSS_COLOR,
  SECTION_TITLE_COLOR,
  PLACEHOLDER_COLOR,
  SEPARATOR_COLOR,
  POSTER_BG_COLOR,
} from './typographyConstants.ts';
import { buildPosterWatermarkCss } from '../shufuriPoster/posterWatermark.ts';
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
  /* 中文歌词正文：思源宋体 */
  ${scoped('.cn-line')},
  ${scoped('.cn-line *:not(rt):not(rp):not(' + ZH_CHAR_SLOT + ')')} {
    font-family: ${ZH_SONGTI_FONT_FAMILY} !important;
    font-size: ${fs(zh.cnFs)} !important;
    font-weight: ${LYRIC_PRIMARY_WEIGHT} !important;
    line-height: ${zh.mainLh} !important;
    color: ${BODY_TEXT_COLOR} !important;
    letter-spacing: ${r.cjkLetterSpacing} !important;
    ${cjkWrap}
  }
  /* 重点词 / 语法点标题仍用 PingFang（与正文衬线分流） */
  ${zhVocab('.vocab-word-cn')},
  ${zhVocab('.vocab-word-cn *:not(rt):not(rp):not(' + ZH_CHAR_SLOT + ')')},
  ${zhVocab('.vocab-word')},
  ${zhVocab('.vocab-word *:not(rt):not(rp):not(' + ZH_CHAR_SLOT + ')')},
  ${zhGrammar('.grammar-title-cn')},
  ${zhGrammar('.grammar-title-cn *:not(rt):not(rp):not(' + ZH_CHAR_SLOT + ')')} {
    font-family: ${ZH_FONT_FAMILY} !important;
    font-size: ${fs(zh.cnFs)} !important;
    font-weight: ${LYRIC_PRIMARY_WEIGHT} !important;
    line-height: ${zh.mainLh} !important;
    color: ${BODY_TEXT_COLOR} !important;
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
    color: ${BODY_TEXT_COLOR} !important;
    letter-spacing: ${r.cjkLetterSpacing} !important;
    ${cjkWrap}
  }
  ${scoped('.cn-line')},
  ${zhVocab('.vocab-word-cn')},
  ${zhVocab('.vocab-word')},
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
  ${zhVocab('.vocab-word ' + ZH_CHAR_SLOT)},
  ${zhVocab('.vocab-ex-cn ' + ZH_CHAR_SLOT)},
  ${zhGrammar('.grammar-title-cn ' + ZH_CHAR_SLOT)},
  ${zhGrammar('.grammar-ex-cn ' + ZH_CHAR_SLOT)} {
    display: inline-block;
    margin-right: ${gap(zh.rubyGapEm)};
    vertical-align: bottom;
  }
  ${scoped('.cn-line ruby')} {
    font-family: ${ZH_SONGTI_FONT_FAMILY} !important;
    font-weight: ${LYRIC_PRIMARY_WEIGHT} !important;
    ruby-position: over;
    -webkit-ruby-position: over;
    ruby-align: center;
    letter-spacing: 0 !important;
  }
  ${zhVocab('.vocab-word-cn ruby')},
  ${zhVocab('.vocab-word ruby')},
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
  ${zhVocab('.vocab-word ruby rt')},
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
    color: ${GLOSS_COLOR} !important;
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
    color: ${GLOSS_COLOR} !important;
    letter-spacing: 0 !important;
    ${latinWrap}
  }
  ${zhVocab('.vocab-meaning')} {
    font-family: ${ZH_FONT_FAMILY} !important;
    font-size: ${fs(zh.glossFs)} !important;
    font-weight: ${LYRIC_SECONDARY_WEIGHT} !important;
    line-height: ${zh.glossLh} !important;
    color: ${GLOSS_COLOR} !important;
    letter-spacing: 0 !important;
    ${latinWrap}
  }
  ${zhGrammar('.grammar-detail')} {
    font-family: ${ZH_FONT_FAMILY} !important;
    font-size: ${fs(zh.glossFs)} !important;
    font-weight: ${LYRIC_SECONDARY_WEIGHT} !important;
    line-height: ${zh.glossLh} !important;
    color: ${GLOSS_COLOR} !important;
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
  const zhLineWght = R.lyricSecondary.fontWeight;
  /** 旁注 / 词解辅文：与歌词译文（.zh-line）同字重 */
  const zhAuxWght = zhLineWght;
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
    color: ${TITLE_TEXT_COLOR};
    text-align: center;
    margin: 0 0 ${fs(L.titleMbPx)} 0;
    line-height: ${L.titleLineHeight};
    ${unit === 'mm' ? 'flex: 0 0 auto;' : ''}
  }
  ${root}.fv-title-name {
    max-width: 100%;
    display: inline;
    word-break: keep-all;
    line-break: strict;
    overflow-wrap: break-word;
  }
  ${root}.fv-title-artist {
    display: block;
    font-size: 0.58em;
    font-weight: ${artistWght};
    color: ${GLOSS_COLOR};
    letter-spacing: 0.02em;
    text-align: center;
    white-space: normal;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  ${root}.fv-title-name--placeholder,
  ${root}.fv-title-artist--placeholder {
    color: ${PLACEHOLDER_COLOR};
    font-weight: 400;
  }
  /* 歌名/歌手：简体中文形 → 思源宋体；日文汉字形 → KozMin */
  ${root}.fv-title-serif--source-han {
    font-family: ${ZH_SONGTI_FONT_FAMILY};
  }
  ${root}.fv-title-serif--kozmin {
    font-family: ${KOZMIN_PRO_REGULAR_FAMILY};
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
    color: ${BODY_TEXT_COLOR} !important;
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
    font-weight: ${zhLineWght} !important;
    color: ${BODY_TEXT_COLOR} !important;
    line-height: ${L.zhLyricsLh} !important;
    font-family: ${ZH_FONT_FAMILY} !important;
    margin: ${unit === 'px' ? L.lyricsJpZhGap : emSize(L.lyricsJpZhGap, L.mainPx, unit, spec)} 0 0 0 !important;
    letter-spacing: ${r.cjkLetterSpacing};
    text-indent: 0;
    padding-inline-start: 0;
  }
  ${bodySel} .lyrics-group .gloss-line,
  ${bodySel} .lyrics-group .gloss-line * {
    font-family: ${KOZMIN_PRO_REGULAR_FAMILY} !important;
    font-size: ${auxFs} !important;
    font-weight: ${zhAuxWght} !important;
    color: ${F.isZhPipeline ? GLOSS_COLOR : BODY_TEXT_COLOR} !important;
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
    color: ${BODY_TEXT_COLOR} !important;
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
    color: ${BODY_TEXT_COLOR} !important;
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
    color: ${BODY_TEXT_COLOR} !important;
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
    color: ${BODY_TEXT_COLOR} !important;
    line-height: ${L.koLh} !important;
    margin: 0 !important;
  }
  ${bodySel} .vocab-ex-zh,
  ${bodySel} .vocab-ex-zh *,
  ${bodySel} .grammar-ex-zh,
  ${bodySel} .grammar-ex-zh * {
    font-size: ${auxFs} !important;
    font-weight: ${primaryWght} !important;
    color: ${BODY_TEXT_COLOR} !important;
    line-height: ${L.zhLyricsLh} !important;
    font-family: ${ZH_FONT_FAMILY} !important;
  }
  ${bodySel} .grammar-detail,
  ${bodySel} .grammar-detail *:not(rt):not(rp)${F.isZhPipeline ? '' : `,\n  ${bodySel} .vocab-line1`},
  ${bodySel} .vocab-formula {
    font-size: ${auxFs} !important;
    font-weight: ${zhAuxWght} !important;
    color: ${BODY_TEXT_COLOR} !important;
    line-height: ${L.zhLyricsLh} !important;
    font-family: ${ZH_FONT_FAMILY} !important;
  }
  ${F.isZhPipeline ? '' : `
  ${bodySel} .vocab-line1 {
    margin: 0 0 ${unit === 'px' ? L.auxJpZhGap : emSize(L.auxJpZhGap, L.auxPx, unit, spec)} 0 !important;
    max-width: 100%;
    ${cjkWrap}
    ${unit === 'mm' ? `border-bottom: 0.5px solid ${SEPARATOR_COLOR}; padding-bottom: ${emSize(L.auxJpZhGap, L.auxPx, unit, spec)};` : ''}
  }`}
  ${bodySel} .vocab-ex-zh,
  ${bodySel} .grammar-ex-zh {
    margin: ${unit === 'px' ? L.auxJpZhGap : emSize(L.auxJpZhGap, L.auxPx, unit, spec)} 0 0 0 !important;
  }
  ${bodySel} .vocab-ex-gloss,
  ${bodySel} .vocab-ex-gloss *,
  ${bodySel} .grammar-ex-gloss,
  ${bodySel} .grammar-ex-gloss * {
    font-family: ${ZH_FONT_FAMILY} !important;
    font-size: ${auxFs} !important;
    font-weight: ${primaryWght} !important;
    color: ${BODY_TEXT_COLOR} !important;
    line-height: ${L.zhLyricsLh} !important;
    ${latinWrap}
  }
  ${bodySel} .grammar-detail {
    margin: 0.15em 0 ${unit === 'px' ? L.grammarDetailMb : emSize(L.grammarDetailMb, L.auxPx, unit, spec)} 0 !important;
    max-width: 100%;
    ${latinWrap}
  }
  /* 划词笔记等混排：谚文片段保持韩语正文字体（覆盖 .grammar-detail * 的中文栈） */
  ${bodySel} .grammar-detail .ko-run {
    font-family: ${KO_FONT_FAMILY} !important;
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
    font-family: ${F.isZhPipeline ? ZH_FONT_FAMILY : studyTerm.fontFamily} !important;
    font-size: ${mainFs} !important;
    font-weight: ${F.isZhPipeline ? LYRIC_PRIMARY_WEIGHT : studyTerm.fontWeight} !important;
    color: ${studyTerm.color} !important;
    line-height: ${F.isZhPipeline ? L.zhLyricsLh : studyTermLh} !important;
    ${F.isZhPipeline ? latinWrap : cjkWrap}
  }
  ${F.isZhPipeline ? `
  ${bodySel} .vocab-line1 .vocab-word-cn,
  ${bodySel} .vocab-line1 .vocab-word-cn *:not(rt):not(rp):not(.${ZH_CHAR_SLOT_CLASS}),
  ${bodySel} h3.grammar-point-title .grammar-title-cn,
  ${bodySel} h3.grammar-point-title .grammar-title-cn *:not(rt):not(rp):not(.${ZH_CHAR_SLOT_CLASS}) {
    font-family: ${ZH_FONT_FAMILY} !important;
    font-size: ${mainFs} !important;
    font-weight: ${LYRIC_PRIMARY_WEIGHT} !important;
    color: ${BODY_TEXT_COLOR} !important;
    line-height: ${L.zhLyricsLh} !important;
    letter-spacing: 0 !important;
    ${latinWrap}
  }` : ''}
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
  /* 旧划词笔记误用 vocab-word：韩语稿仍走韩语正文字体 */
  ${r.lang === 'ko' ? `
  ${bodySel} .lyrics-explain-notes .vocab-line1 .vocab-word,
  ${bodySel} .lyrics-explain-notes .vocab-line1 .vocab-word *:not(rt):not(rp) {
    font-family: ${KO_FONT_FAMILY} !important;
    font-weight: ${koWght} !important;
    color: ${r.vocabEmphasisColor} !important;
    line-height: ${L.koLh} !important;
  }` : ''}
  ${bodySel} .vocab-line1 .vocab-word ruby rt {
    font-family: ${KOZMIN_PRO_REGULAR_FAMILY} !important;
    font-size: ${rtEm}em !important;
    font-weight: ${JP_RUBY_WEIGHT} !important;
    color: ${GLOSS_COLOR} !important;
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
    font-family: ${KOZMIN_PRO_REGULAR_FAMILY};
    font-size: ${rtEm}em;
    font-weight: ${JP_RUBY_WEIGHT};
    color: ${GLOSS_COLOR};
    line-height: 1.1;
    letter-spacing: normal;
    font-feature-settings: "palt" 0;
    max-width: 100%;
  }
  /* 漏标兜底空 rt：不占注音行高，避免分页/预览被撑高 */
  ${bodySel} ruby[data-ink-empty-rt] rt:empty {
    display: none !important;
  }`}
  ${bodySel} h2.lyrics-section-title {
    font-family: ${sectionTitleFont};
    font-size: ${h2Fs};
    font-weight: ${AUX_WEIGHT};
    color: ${SECTION_TITLE_COLOR};
    margin: ${unit === 'px' ? L.sectionTitleMt : emSize(L.sectionTitleMt, L.h2Px, unit, spec)} 0 0.5em;
    ${unit === 'mm' ? `border-top: 0.5px solid ${SEPARATOR_COLOR}; padding-top: ${emSize(L.sectionTitleFirstMt, L.h2Px, unit, spec)};` : ''}
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
  /* 语法点旁释义 / 详细说明：与重点词 vocab-meaning、歌词译文同级（aux 字号 + 译文字重） */
  ${bodySel} h3.grammar-point-title .grammar-title-zh,
  ${bodySel} h3.grammar-point-title .grammar-title-zh *,
  ${bodySel} h3.grammar-point-title .grammar-title-gloss,
  ${bodySel} h3.grammar-point-title .grammar-title-gloss * {
    font-family: ${ZH_FONT_FAMILY} !important;
    font-size: ${auxFs} !important;
    font-weight: ${zhAuxWght} !important;
    line-height: ${L.zhLyricsLh} !important;
    color: ${BODY_TEXT_COLOR} !important;
    -webkit-text-size-adjust: 100%;
    ${latinWrap}
  }
  ${bodySel} h3.grammar-point-title ruby rt {
    font-family: ${KOZMIN_PRO_REGULAR_FAMILY};
    font-size: ${rtEm}em;
    font-weight: ${JP_RUBY_WEIGHT};
    color: ${GLOSS_COLOR};
    line-height: 1.1;
    max-width: 100%;
  }
  ${bodySel} .vocab-line1 .vocab-meaning,
  ${bodySel} .vocab-line1 .vocab-meaning * {
    font-family: ${ZH_FONT_FAMILY} !important;
    font-size: ${auxFs} !important;
    font-weight: ${zhAuxWght} !important;
    line-height: ${L.zhLyricsLh} !important;
    color: ${BODY_TEXT_COLOR} !important;
  }`;
}

function compilePrintPageShell(spec: PrintPageSpec): string {
  return `
  @page {
    size: ${spec.pageSizeCss};
    margin: 0;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${POSTER_BG_COLOR}; }
  .print-page {
    width: ${mm(spec.widthMm)};
    height: ${mm(spec.heightMm)};
    position: relative;
    box-sizing: border-box;
    padding: ${mm(spec.padTopMm)} ${mm(spec.padRightMm)} ${mm(spec.padBottomMm)} ${mm(spec.padLeftMm)};
    background: ${POSTER_BG_COLOR};
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

function compileWatermarkCss(
  r: ResolvedTypography,
  unit: 'px' | 'mm',
  spec?: PrintPageSpec,
): string {
  return buildPosterWatermarkCss({
    profile: r.profile,
    sizeFn: (px) => size(px, unit, spec),
  });
}

export function compilePosterCss(
  resolved: ResolvedTypography,
  options: CompilePosterCssOptions = {},
): string {
  const unit = options.unit ?? 'px';
  const spec = options.spec;
  const includeFontFaces = options.includeFontFaces ?? unit === 'px';

  const fontFaces = includeFontFaces
    ? `${getPosterJapaneseFontsFaceCss()}${getPosterKoreanFontFaceCss()}${getPosterSourceHanSerifScFontFaceCss()}${getPosterEnglishFontFaceCss()}${getPosterSansationFontFaceCss()}`
    : '';

  const printShell = unit === 'mm' && spec ? compilePrintPageShell(spec) : '';
  const bodyRules = compileBodyRules(resolved, unit, spec);
  const zhRules = resolved.flags.isZhPipeline
    ? compileZhLayoutCss(resolved, unit, spec)
    : '';
  const watermark = compileWatermarkCss(resolved, unit, spec);
  const cjkNoBreak = buildCjkNoBreakClassCss();
  const showRuby = options.showRuby ?? resolved.flags.showRuby;
  const rubyVisibility = compileRubyVisibilityCss(showRuby);

  return `${fontFaces}${printShell}${bodyRules}${zhRules}${watermark}${cjkNoBreak}${rubyVisibility}`;
}

/** 编辑页：主题令牌 / 布局（行距已并入 mobilePoster Kami 基准，勿再 !important 覆盖） */
const EDIT_CANVAS_BG = 'var(--color-edit-canvas-bg)';
/**
 * 编辑页固定 mobilePoster；标题相对海报基准 56px 放大，
 * 与正文 ~32px 拉开明显字号差。
 */
const EDIT_TITLE_FONT_SIZE = '68px';

export function compileEditCssOverrides(): string {
  const root = '.fv-html-poster-root.fv-edit-document-root';
  const body = `${root} .fv-body-h`;
  return `
  ${root} {
    height: auto !important;
    min-height: unset !important;
    overflow: visible !important;
    background: ${EDIT_CANVAS_BG} !important;
  }
  ${body} {
    overflow: visible !important;
    max-height: none !important;
    height: auto !important;
    flex: none !important;
  }
  /*
   * 注意：编辑画布禁用 content-visibility（勿加该属性）。
   * 离屏 lyrics-group 占位高度会随滚动抖动，再与
   * ResizeObserver / scaledH / frame 高度形成死循环（再滑卡死、光标闪烁）。
   * 仅用 style containment 降低样式重算范围。
   */
  ${body} .lyrics-group {
    contain: style;
  }

  /* —— 歌名 / 歌手层级 —— */
  ${root} .fv-title-h {
    font-size: ${EDIT_TITLE_FONT_SIZE} !important;
    color: var(--color-edit-title) !important;
    margin-bottom: 0.55em !important;
  }
  ${root} .fv-title-h .fv-title-name {
    color: var(--color-edit-title) !important;
  }
  ${root} .fv-title-h .fv-title-artist {
    font-size: 0.48em !important;
    color: var(--color-edit-artist) !important;
    letter-spacing: 0.04em !important;
  }
  ${root} .fv-title-h .fv-title-name--placeholder,
  ${root} .fv-title-h .fv-title-artist--placeholder {
    color: var(--color-fg-faint) !important;
  }

  /* —— 歌词正文 / 译文（行距/字距继承 poster Kami；此处只改主题色） —— */
  ${body} .jp-line,
  ${body} .jp-line *:not(rt):not(rp),
  ${body} .ko-line,
  ${body} .ko-line *,
  ${body} .cn-line,
  ${body} .cn-line *:not(rt):not(rp) {
    color: var(--color-edit-lyric) !important;
  }
  ${body} .zh-line,
  ${body} .zh-line *,
  ${body} .gloss-line,
  ${body} .gloss-line * {
    color: var(--color-fg-secondary) !important;
    margin-top: 0.28em !important;
  }
  ${body} ruby rt {
    color: var(--color-fg-muted) !important;
  }

  /* —— 区段标题（重点词汇 / 重点语法） —— */
  ${body} h2.lyrics-section-title {
    color: var(--color-edit-section) !important;
    border-bottom: 1px solid var(--color-edit-section-rule) !important;
    padding-bottom: 0.35em !important;
    margin-bottom: 0.85em !important;
    letter-spacing: 0.08em !important;
  }

  /* —— 核心词 / 语法点标题：主题深色强调 —— */
  ${body} .vocab-line1 .vocab-word,
  ${body} .vocab-line1 .vocab-word *:not(rt):not(rp),
  ${body} .vocab-line1 .vocab-word-ko,
  ${body} .vocab-line1 .vocab-word-ko *,
  ${body} .vocab-line1 .vocab-word-cn,
  ${body} .vocab-line1 .vocab-word-cn *:not(rt):not(rp),
  ${body} h3.grammar-point-title .grammar-title-ja,
  ${body} h3.grammar-point-title .grammar-title-ja *:not(rt):not(rp),
  ${body} h3.grammar-point-title .grammar-title-ko,
  ${body} h3.grammar-point-title .grammar-title-ko *,
  ${body} h3.grammar-point-title .grammar-title-cn,
  ${body} h3.grammar-point-title .grammar-title-cn *:not(rt):not(rp) {
    color: var(--color-edit-study-term) !important;
  }
  /* 语法点旁释义 = 重点词释义：次级字色 */
  ${body} .vocab-line1 .vocab-meaning,
  ${body} .vocab-line1 .vocab-meaning *,
  ${body} h3.grammar-point-title .grammar-title-zh,
  ${body} h3.grammar-point-title .grammar-title-zh *,
  ${body} h3.grammar-point-title .grammar-title-gloss,
  ${body} h3.grammar-point-title .grammar-title-gloss *,
  ${body} .grammar-detail,
  ${body} .grammar-detail *:not(rt):not(rp) {
    color: var(--color-fg-secondary) !important;
  }

  /* —— 文档型条目导轨（弱层级，非卡片） —— */
  ${body} .lyrics-vocab-item,
  ${body} .lyrics-grammar-item {
    border-left: 2px solid var(--color-edit-study-rail) !important;
    padding-left: 0.75em !important;
    margin-bottom: 3em !important;
    box-sizing: border-box !important;
  }
  ${body} .vocab-ex-ja,
  ${body} .vocab-ex-ja *:not(rt):not(rp),
  ${body} .vocab-ex-ko,
  ${body} .vocab-ex-ko *,
  ${body} .grammar-ex-ja,
  ${body} .grammar-ex-ja *:not(rt):not(rp),
  ${body} .grammar-ex-ko,
  ${body} .grammar-ex-ko *,
  ${body} .vocab-ex-zh,
  ${body} .vocab-ex-zh *,
  ${body} .grammar-ex-zh,
  ${body} .grammar-ex-zh *,
  ${body} .vocab-ex-gloss,
  ${body} .vocab-ex-gloss *,
  ${body} .grammar-ex-gloss,
  ${body} .grammar-ex-gloss * {
    color: var(--color-edit-lyric) !important;
  }

  /* —— 划词笔记 / 学习条目：右上角删除按钮（导出默认隐藏） —— */
  ${body} .shufuri-explain-note,
  ${body} .shufuri-study-item {
    position: relative !important;
    padding-right: 2.2em !important;
    cursor: pointer;
  }
  ${body} .shufuri-explain-note__delete,
  ${body} .shufuri-study-item__delete {
    display: inline-flex !important; /* 覆盖内联 style="display:none" */
    position: absolute !important;
    top: 0.2em !important;
    right: 0.2em !important;
    width: 24px !important;
    height: 24px !important;
    border-radius: 999px;
    border: none;
    padding: 0;
    align-items: center;
    justify-content: center;
    background: rgba(148, 163, 184, 0.22) !important;
    color: rgba(15, 23, 42, 0.8) !important;
    cursor: pointer;
    z-index: 5;
    font-size: 16px;
    line-height: 1;
    -webkit-tap-highlight-color: transparent;
  }
  ${body} .shufuri-explain-note__delete:hover,
  ${body} .shufuri-study-item__delete:hover {
    background: rgba(148, 163, 184, 0.35) !important;
  }`;
}
