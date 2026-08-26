import {
  EN_FONT_FAMILY,
  KOZMIN_PRO_REGULAR_FAMILY,
  ZH_FONT_FAMILY,
  ZH_SONGTI_FONT_FAMILY,
  getPosterEnglishFontFaceCss,
  getPosterJapaneseFontsFaceCss,
  getPosterSourceHanSerifScFontFaceCss,
  getPosterSansationFontFaceCss,
} from '../shufuriPoster/fonts.ts';
import {
  buildCjkNoBreakClassCss,
  buildCjkWrapCss,
  buildLatinWrapCss,
} from '../shufuriPoster/cjkTypography.ts';
import { ZH_CHAR_SLOT_CLASS } from '../zhLayout/zhRubyMarkup.ts';
import type { PosterLayoutVariant } from '../shufuriPoster/types.ts';
import { SPLIT_LEFT_RATIO, SPLIT_RIGHT_RATIO } from '../shufuriPoster/types.ts';
import {
  AUX_WEIGHT,
  JP_RUBY_BASE_GAP_EM,
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
  NOTEBOOK_BRAND_BLUE,
  NOTEBOOK_MARKER_KINARI,
  NOTEBOOK_CARD_BG,
  NOTEBOOK_CARD_BORDER,
  NOTEBOOK_RULE_COLOR,
  NOTEBOOK_PAPER_BG,
  NOTEBOOK_STAIN_1,
  NOTEBOOK_STAIN_2,
  NOTEBOOK_STAIN_3,
  NOTEBOOK_VIGNETTE,
  SPLIT_PAPER_BG,
  SPLIT_PAPER_BG_CENTER,
  SPLIT_PAPER_BG_EDGE,
  SPLIT_RULE_BLUE,
  MINIMAL_PAPER_BG,
  MINIMAL_PAPER_TEXTURE,
  MINIMAL_HAIRLINE,
  MINIMAL_CARD_BG,
  MINIMAL_CARD_BORDER,
  MINIMAL_LABEL_COLOR,
  MINIMAL_LYRICS_COLOR,
  MINIMAL_IMAGE_PLACEHOLDER_BG,
  MINIMAL_IMAGE_FILTER,
} from './typographyConstants.ts';
import { buildPosterWatermarkCss } from '../shufuriPoster/posterWatermark.ts';
import type { ResolvedTypography } from './tokenRegistry.ts';
import { mm, pxToMm, type PrintPageSpec } from '../vectorPrint/printPageSpec.ts';

export type CompilePosterCssOptions = {
  unit?: 'px' | 'mm';
  spec?: PrintPageSpec;
  viewMode?: 'screen' | 'edit';
  includeFontFaces?: boolean;
  /** 背景图 URL；为空时保持 POSTER_BG_COLOR 纯色背景 */
  backgroundImage?: string;
  showRuby?: boolean;
  /** 版式变体（standard / notebook），决定排版皮肤 */
  layoutVariant?: PosterLayoutVariant;
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
  /** 英文/外文翻译(gloss)字号：比辅文(aux)再小一档，避免喧宾夺主 */
  const glossFs = fs(Math.round(L.auxPx * 0.85));
  const h2Fs = fs(L.h2Px);

  const jpLyricFont = F.isEnglish ? EN_FONT_FAMILY : KOZMIN_PRO_REGULAR_FAMILY;
  const jpStudyFont = F.isEnglish ? EN_FONT_FAMILY : KOZMIN_PRO_REGULAR_FAMILY;
  const primaryWght = LYRIC_PRIMARY_WEIGHT;
  const zhLineWght = R.lyricSecondary.fontWeight;
  /** 旁注 / 词解辅文：与歌词译文（.zh-line）同字重 */
  const zhAuxWght = zhLineWght;
  const koWght = KO_PRIMARY_WEIGHT;
  const rtEm = L.mainRtEm;
  /** 日语假名工具层色（#aaa）；其它语言沿用 gloss */
  const rubyRtColor = R.rubyAnnotation.ruby?.rtColor ?? R.rubyAnnotation.color ?? GLOSS_COLOR;
  /** 假名与汉字间距：仅日语管线 */
  const rubyBaseGapEm = r.lang === 'jp' ? JP_RUBY_BASE_GAP_EM : 0;
  const rubyBaseGapCss = rubyBaseGapEm > 0 ? `padding-bottom: ${rubyBaseGapEm}em;` : '';

  const titleFont = R.posterTitle.fontFamily;
  /** 韩文主体/词汇/语法强制字体：跟随 resolver 的 lyricPrimary（系统衬线） */
  const koFontFamily = R.lyricPrimary.fontFamily;
  const artistWght = R.posterArtist.fontWeight;
  const sectionTitleFont = R.sectionTitle.fontFamily;
  const studyTermLh = r.lang === 'ko' || r.lang === 'en' ? L.koLh : L.jpLh;
  const studyTerm = R.studyTerm;

  return `
  ${titleSel} {
    font-family: ${titleFont};
    font-size: ${titleFs};
    font-weight: 600;
    color: ${TITLE_TEXT_COLOR};
    text-align: center;
    margin: 0 0 ${fs(L.titleMbPx)} 0;
    padding-bottom: ${(r.spacingScale ?? 1).toFixed(3)}em;
    border-bottom: 1px solid ${MINIMAL_HAIRLINE};
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
    margin-top: ${Math.round(6 * (r.spacingScale ?? 1))}px;
    margin-bottom: ${
      unit === 'px'
        ? L.groupMb
        : L.groupMb.endsWith('px')
          ? size(parseFloat(L.groupMb), unit, spec)
          : emSize(L.groupMb, L.mainPx, unit, spec)
    };
    break-inside: avoid;
    page-break-inside: avoid;
    overflow: hidden;
    max-width: 100%;
    box-sizing: border-box;
  }
  ${bodySel} .lyrics-group + .lyrics-group {
    margin-top: ${Math.round(12 * (r.spacingScale ?? 1))}px;
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
    /* 英文/韩文等非中文管线条目间距（日语有 .vocab-ex-zh 的由 :has 规则覆盖更大间距） */
    margin-bottom: ${unit === 'px' ? Math.round(0.8 * L.auxPx * L.jpLh) : size(Math.round(0.8 * (L.jpLh / r.spacingScale) * L.auxPx), unit, spec)};
  }
  /* —— 知识区段卡片（standard 与 minimal 拉齐：极淡底 + 极淡边 + 圆角；随 spacingScale 收缩） —— */
  ${bodySel} .lyrics-vocabulary,
  ${bodySel} .lyrics-grammar {
    background-color: ${MINIMAL_CARD_BG};
    border: 1px solid ${MINIMAL_CARD_BORDER};
    border-radius: 4px;
    padding: ${Math.round(10 * (r.spacingScale ?? 1))}px;
    box-sizing: border-box;
    margin-top: ${Math.round(8 * (r.spacingScale ?? 1))}px;
    margin-bottom: ${Math.round(8 * (r.spacingScale ?? 1))}px;
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
    font-family: ${koFontFamily} !important;
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
    font-family: ${koFontFamily} !important;
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
    font-size: ${glossFs} !important;
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
    font-family: ${koFontFamily} !important;
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
    font-family: ${koFontFamily} !important;
    font-size: ${mainFs} !important;
    font-weight: ${koWght} !important;
    color: ${r.vocabEmphasisColor} !important;
    line-height: ${L.koLh} !important;
  }
  /* 旧划词笔记误用 vocab-word：韩语稿仍走韩语正文字体 */
  ${r.lang === 'ko' ? `
  ${bodySel} .lyrics-explain-notes .vocab-line1 .vocab-word,
  ${bodySel} .lyrics-explain-notes .vocab-line1 .vocab-word *:not(rt):not(rp) {
    font-family: ${koFontFamily} !important;
    font-weight: ${koWght} !important;
    color: ${r.vocabEmphasisColor} !important;
    line-height: ${L.koLh} !important;
  }` : ''}
  ${bodySel} .vocab-line1 .vocab-word ruby rt {
    font-family: ${KOZMIN_PRO_REGULAR_FAMILY} !important;
    font-size: ${rtEm}em !important;
    font-weight: ${JP_RUBY_WEIGHT} !important;
    color: ${rubyRtColor} !important;
    line-height: 1.1 !important;
    ${rubyBaseGapCss}
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
    color: ${rubyRtColor};
    line-height: 1.1;
    letter-spacing: normal;
    font-feature-settings: "palt" 0;
    max-width: 100%;
    ${rubyBaseGapCss}
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
    color: ${rubyRtColor};
    line-height: 1.1;
    max-width: 100%;
    ${rubyBaseGapCss}
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

function compilePrintPageShell(spec: PrintPageSpec, backgroundImage?: string): string {
  const pageBg = backgroundImage
    ? `${POSTER_BG_COLOR} url('${backgroundImage}') center/cover no-repeat`
    : POSTER_BG_COLOR;
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
    background: ${pageBg};
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

/**
 * 版式变体 CSS 皮肤（data-layout-variant 挂在 .fv-html-poster-root 上）。
 * Notebook（行间注）：单栏不变，仅叠加品牌深蓝手绘线条 + KINARI 荧光马克笔
 * 标注生词 + 知识卡片感 + 更大段落留白。纯 CSS，不影响分页算法。
 */
function compileLayoutVariantCss(
  variant: PosterLayoutVariant | undefined,
  resolved: ResolvedTypography,
): string {
  if (variant === 'notebook') return compileNotebookCss(resolved);
  if (variant === 'split') return compileSplitCss(resolved);
  if (variant === 'minimal') return compileMinimalCss(resolved);
  return '';
}

function compileNotebookCss(resolved: ResolvedTypography): string {
  const root = '.fv-html-poster-root[data-layout-variant="notebook"]';
  const bodySel = `${root} .fv-body-h`;
  const L = resolved.layout;
  // 方向A1：Notebook 的装饰性增量跟随 spacingScale 收缩，使满页时与标准版式同频收紧，
  // 避免刚性增量累积触发 verifyAndRepairPages 对不可拆分原子的"静默放行"截断。
  // scale 下限与 CJK_TYPOGRAPHY_SCALE_STEPS 一致（0.85），避免缩到过紧。
  const scale = resolved.spacingScale ?? 1;
  const groupExtraPx = Math.round(5 * scale);
  const zhGapEm = (0.28 * scale).toFixed(3);

  return `
  /* —— 暖米白做旧纸底 + 斑驳痕迹（替代纯白） —— */
  ${root} {
    background-color: ${NOTEBOOK_PAPER_BG} !important;
    background-image:
      radial-gradient(120% 80% at 18% 8%, ${NOTEBOOK_STAIN_1} 0%, transparent 55%),
      radial-gradient(90% 70% at 88% 22%, ${NOTEBOOK_STAIN_2} 0%, transparent 50%),
      radial-gradient(140% 120% at 70% 100%, ${NOTEBOOK_STAIN_3} 0%, transparent 60%),
      radial-gradient(100% 100% at 50% 50%, transparent 62%, ${NOTEBOOK_VIGNETTE} 100%) !important;
    background-blend-mode: multiply !important;
    background-repeat: no-repeat !important;
  }
  /* —— 页眉手绘线：标题下方一条品牌深蓝粗线 + 细线 —— */
  ${root} .fv-title-h {
    padding-bottom: 0.55em !important;
    border-bottom: 2.5px solid ${NOTEBOOK_BRAND_BLUE} !important;
    box-shadow: 0 3px 0 -1px ${NOTEBOOK_RULE_COLOR} !important;
  }
  /* —— 歌词组：适度留白 + 组间手绘分隔虚线（留白随 spacingScale 收缩） —— */
  ${bodySel} .lyrics-group {
    margin-bottom: ${parseFloat(L.groupMb) + groupExtraPx}px !important;
    padding: 0.1em 0 0 0 !important;
    border-bottom: 1.5px dashed ${NOTEBOOK_RULE_COLOR} !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  ${bodySel} > .lyrics-group:last-child {
    border-bottom: none !important;
    margin-bottom: 0 !important;
  }
  /* 歌词中日文间距微调，营造行间注呼吸感（随 spacingScale 收缩） */
  ${bodySel} .lyrics-group .zh-line,
  ${bodySel} .lyrics-group .zh-line *,
  ${bodySel} .lyrics-group .gloss-line,
  ${bodySel} .lyrics-group .gloss-line * {
    margin-top: ${zhGapEm}em !important;
  }
  /* —— 区段标题（重点词汇/语法）：品牌深蓝下划线 —— */
  ${bodySel} h2.lyrics-section-title {
    color: ${NOTEBOOK_BRAND_BLUE} !important;
    border-bottom: 1.5px solid ${NOTEBOOK_BRAND_BLUE} !important;
    padding-bottom: 0.3em !important;
    letter-spacing: 0.08em !important;
  }
  /* —— 知识区段：整个 vocabulary/grammar 用一个左侧色条包裹（非逐条卡片） —— */
  ${bodySel} .lyrics-vocabulary,
  ${bodySel} .lyrics-grammar {
    background: ${NOTEBOOK_CARD_BG} !important;
    border: 1px solid ${NOTEBOOK_CARD_BORDER} !important;
    border-left: 3.5px solid ${NOTEBOOK_BRAND_BLUE} !important;
    border-radius: 10px !important;
    padding: 0.6em 0.8em !important;
    box-sizing: border-box !important;
    margin-top: 0.35em !important;
  }
  /* 区段内词条去掉独立卡片样式，保持紧凑 */
  ${bodySel} .lyrics-vocab-item,
  ${bodySel} .lyrics-grammar-item {
    background: transparent !important;
    border: none !important;
    border-radius: 0 !important;
    padding: 0.25em 0 !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  /* —— KINARI 荧光马克笔：高亮生词 / 语法点标题（不改动字宽，避免溢出） —— */
  ${bodySel} .vocab-line1 .vocab-word,
  ${bodySel} .vocab-line1 .vocab-word *:not(rt):not(rp),
  ${bodySel} .vocab-line1 .vocab-word-cn,
  ${bodySel} .vocab-line1 .vocab-word-cn *:not(rt):not(rp):not(.${ZH_CHAR_SLOT_CLASS}),
  ${bodySel} h3.grammar-point-title .grammar-title-ja,
  ${bodySel} h3.grammar-point-title .grammar-title-ja *:not(rt):not(rp),
  ${bodySel} h3.grammar-point-title .grammar-title-cn,
  ${bodySel} h3.grammar-point-title .grammar-title-cn *:not(rt):not(rp):not(.${ZH_CHAR_SLOT_CLASS}) {
    background: ${NOTEBOOK_MARKER_KINARI} !important;
    color: ${NOTEBOOK_BRAND_BLUE} !important;
    padding: 0.18em 0.08em !important;
    box-decoration-break: clone !important;
    -webkit-box-decoration-break: clone !important;
    border-radius: 2px !important;
  }
  /* 韩文稿生词同样标记（覆盖旧划词笔记误用路径） */
  ${bodySel} .lyrics-explain-notes .vocab-line1 .vocab-word,
  ${bodySel} .lyrics-explain-notes .vocab-line1 .vocab-word *:not(rt):not(rp) {
    background: ${NOTEBOOK_MARKER_KINARI} !important;
    color: ${NOTEBOOK_BRAND_BLUE} !important;
    box-decoration-break: clone !important;
    -webkit-box-decoration-break: clone !important;
    border-radius: 2px !important;
  }`;
}

function compileSplitCss(resolved: ResolvedTypography): string {
  const root = '.fv-html-poster-root[data-layout-variant="split"]';
  const scale = resolved.spacingScale ?? 1;
  const gapPx = Math.round(18 * scale);
  // 极浅蓝渐变底色：中心更浅、四周略浓
  return `
  /* —— 极浅蓝渐变纸底（中心浅、四周略浓） —— */
  ${root} {
    background-color: ${SPLIT_PAPER_BG} !important;
    background-image: radial-gradient(
      130% 120% at 50% 50%,
      ${SPLIT_PAPER_BG_CENTER} 0%,
      ${SPLIT_PAPER_BG} 55%,
      ${SPLIT_PAPER_BG_EDGE} 100%
    ) !important;
    background-repeat: no-repeat !important;
    background-size: 100% 100% !important;
  }

  /* 外壳真实 body：仅作为分栏根容器，不再直接排布原子 */
  ${root} > .fv-body-h {
    display: block !important;
    padding-bottom: 0 !important;
  }

  /* 左右双栏根：横向 flex，占满 body 剩余高度 */
  ${root} .fv-split-root {
    display: flex !important;
    flex-direction: row !important;
    align-items: stretch !important;
    gap: ${gapPx}px !important;
    width: 100% !important;
    height: 100% !important;
    box-sizing: border-box !important;
  }

  /* 单栏：复用 .fv-body-h 的全部原子样式规则（栏本身带 fv-body-h class），
     仅覆写 flex-basis 与栏内底部留白，保证标准版式原子样式自动生效。 */
  ${root} .fv-split-col {
    display: flex !important;
    flex-direction: column !important;
    flex: 1 1 0 !important;
    min-height: 0 !important;
    min-width: 0 !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    padding-bottom: 0 !important;
  }

  ${root} .fv-split-col--left {
    flex: 0 0 ${Math.round(SPLIT_LEFT_RATIO * 1000) / 10}% !important;
  }

  ${root} .fv-split-col--right {
    flex: 0 0 ${Math.round(SPLIT_RIGHT_RATIO * 1000) / 10}% !important;
    border-left: 1.5px dashed ${SPLIT_RULE_BLUE} !important;
    padding-left: ${gapPx}px !important;
  }
  `;
}

/**
 * Minimal（极简留白 / MUJI 书籍记录卡）版式皮肤。
 *
 * 设计参考：MUJI 无印良品书籍记录卡 —— A5 比例卡片，纸张纹理底色，
 * 四周均等留白，内容从上到下依次排列：
 *   1. 正方形图片区（居中，用户可插入，带降低明度对比度滤镜）
 *   2. 细横线分隔符
 *   3. 歌曲信息区（字段标签 = 极小全大写灰色衬线体；字段内容 = 中等宋体）
 *   4. 歌词原文（宋体细体、小字号、宽字距、深灰、行距宽松）
 *   5. 词汇/语法区（同风格卡片）
 *
 * 配色：极简黑白灰，无任何彩色元素。
 *
 * 约束遵守：
 * - A/A+：装饰性增量极小（仅 1px 分隔线 + 留白），且随 spacingScale 收缩；
 * - B：全部 !important + [data-layout-variant="minimal"] 作用域；
 * - C：底色用 MINIMAL_PAPER_BG 实色（#F5F5F5），导出兜底用同一实色；
 * - D：不改 font-size/width/display/overflow/position（仅 margin/padding/border-color/bg/font-family/font-weight/color/letter-spacing/line-height/filter）。
 */
function compileMinimalCss(resolved: ResolvedTypography): string {
  const root = '.fv-html-poster-root[data-layout-variant="minimal"]';
  const bodySel = `${root} .fv-body-h`;
  const scale = resolved.spacingScale ?? 1;
  const L = resolved.layout;
  const ZH_CHAR_SLOT = `.${ZH_CHAR_SLOT_CLASS}`;

  // ===== 弹性间距（随 spacingScale 收缩，约束 A/A+ 方向 A1）=====
  const imgGapPx = Math.round(24 * scale);           // 图片下方到正文的间距
  const sectionGapPx = Math.round(20 * scale);       // 各大区间距
  const labelLsEm = (0.22 * scale).toFixed(3);      // 字段标签字距
  /** TITLE / ARTIST / 重点词汇·语法：同一标签字号（绝对 px，避免 em 继承倒挂） */
  const minimalLabelPx = Math.max(10, Math.ceil(L.titleFsPx * 0.28 * scale));
  const minimalLabelFont =
    '"EB Garamond", "Source Han Serif SC", "Georgia", serif';
  const lyricsLsEm = (0.08 * scale).toFixed(3);     // 歌词正文宽字距
  const lyricsLhNum = (1.85 / scale).toFixed(2);    // 歌词行距宽松（scale 越小行距越大）
  /** MUJI 笔记风：主/辅歌词用 token 绝对 px，避免 em 相对 16px 导致韩文倒挂 */
  const minimalMainPx = Math.round(L.mainPx * 0.82 * scale);
  const minimalAuxPx = Math.min(
    Math.round(L.auxPx * 0.74 * scale),
    minimalMainPx - 2,
  );
  /** 歌词译文：辅文档 ×1.2 向上取整（各预览比例共用同一公式） */
  const minimalLyricsZhPx = Math.ceil(minimalAuxPx * 1.2);
  const lyricsZhGapPx = Math.round(6 * scale);
  const minimalSans = ZH_FONT_FAMILY;
  const minimalSerif = ZH_SONGTI_FONT_FAMILY;
  /** 词解/语法：组内行距 1.35 + 统一 sibling 间距；组间 ≈ 2×辅文档行高 */
  const studyInnerLh = '1.35';
  const studyIntraGapPx = Math.max(2, Math.round(minimalAuxPx * 0.12));
  const studyGroupGapPx = Math.round(minimalAuxPx * 2);

  return `
  /* ========== 底色：F5F5F5 + 极淡纸张纹理 ========== */
  ${root} {
    background-color: ${MINIMAL_PAPER_BG} !important;
    background-image: ${MINIMAL_PAPER_TEXTURE} !important;
    background-blend-mode: normal !important;
  }

  /* ========== 标题区 → 重构为「歌曲信息区」样式 ==========
   * 原标题 h1.fv-title-h 包含歌名(fv-title-name)和歌手(fv-title-artist)。
   * MUJI 风格下：
   * - 歌名变为中等大小宋体（非超大标题），左对齐或居中
   * - 歌手作为 ARTIST 字段，标签在上、内容在下
   * - 去掉标题的 border-bottom（改由信息区整体结构承载）
   */
  ${root} .fv-title-h {
    text-align: left !important;
    padding-bottom: 0 !important;
    margin-bottom: ${sectionGapPx}px !important;
    border-bottom: none !important;
    box-shadow: none !important;
    font-weight: 400 !important;
  }

  /* 歌名：宋体，中等大小，深灰 */
  ${root} .fv-title-name {
    display: block !important;
    font-family: "Source Han Serif SC", "Songti SC", "STSong", serif !important;
    font-size: 1em !important;          /* 继承 titleFs 但不放大 */
    font-weight: 600 !important;
    color: #111111 !important;
    letter-spacing: 0.04em !important;
    line-height: 1.4 !important;
  }

  /* TITLE / ARTIST / 重点词汇·语法：同一标签字号（绝对 px） */
  ${root} .fv-title-name::before {
    content: 'TITLE' !important;
    display: block !important;
    font-family: ${minimalLabelFont} !important;
    font-size: ${minimalLabelPx}px !important;
    font-weight: 400 !important;
    color: ${MINIMAL_LABEL_COLOR} !important;
    letter-spacing: ${labelLsEm}em !important;
    text-transform: uppercase !important;
    line-height: 1.2 !important;
    margin-bottom: 4px !important;
  }

  /* 歌手：ARTIST 标签行内对齐，字号/字体与 TITLE 标签统一 */
  ${root} .fv-title-artist {
    display: inline-block !important;
    font-family: "Source Han Serif SC", "Songti SC", "STSong", serif !important;
    font-size: 0.75em !important;        /* 比歌名小一号 */
    font-weight: 400 !important;
    color: #444 !important;
    letter-spacing: 0.03em !important;
    margin-top: 6px !important;
  }
  ${root} .fv-title-artist::before {
    content: 'ARTIST' !important;
    display: inline !important;
    font-family: ${minimalLabelFont} !important;
    font-size: ${minimalLabelPx}px !important;
    font-weight: 400 !important;
    color: ${MINIMAL_LABEL_COLOR} !important;
    letter-spacing: ${labelLsEm}em !important;
    text-transform: uppercase !important;
    line-height: 1.2 !important;
    margin-bottom: 0 !important;
    margin-right: 8px !important;
  }

  /* 隐藏歌手占位符文本（"佚名"）—— 由 ::before 的 ARTIST 标签替代 */
  ${root} .fv-title-artist--placeholder,
  ${root} .fv-title-name--placeholder {
    display: none !important;
  }

  /* ========== 图片区域（正方形，水平居中，带滤镜）==========
   * 通过 .fv-minimal-image 容器实现（预览组件中按需注入 DOM）。
   * 宽度取内容区约 2/3，避免满宽 1:1 过高压住页脚水印；保持 1:1。
   * 若无图片则显示占位框。
   */
  ${root} .fv-minimal-image {
    width: 68% !important;
    max-width: 68% !important;
    aspect-ratio: 1 / 1 !important;
    flex-shrink: 0 !important;
    margin: 0 auto ${imgGapPx}px auto !important;
    background-color: ${MINIMAL_IMAGE_PLACEHOLDER_BG} !important;
    border: 1px solid rgba(0, 0, 0, 0.06) !important;
    overflow: hidden !important;
    position: relative !important;
    cursor: pointer !important;
    box-sizing: border-box !important;
  }
  ${root} .fv-minimal-image img {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    object-position: center !important;
    filter: ${MINIMAL_IMAGE_FILTER} !important;
  }
  /* 占位「➕」（无图片时显示，点击上传） */
  ${root} .fv-minimal-image__placeholder {
    position: absolute !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 56px !important;
    height: 56px !important;
    font-size: 40px !important;
    line-height: 1 !important;
    color: ${MINIMAL_LABEL_COLOR} !important;
    opacity: 0.5 !important;
    pointer-events: none !important;
  }

  /* ========== 分隔线（可选装饰，当前首页 DOM 未插入）========== */
  ${root} .fv-minimal-divider {
    height: 1px !important;
    background: transparent !important;
    border-top: 1px solid ${MINIMAL_HAIRLINE} !important;
    margin: ${sectionGapPx}px 0 !important;
  }

  /* ========== 歌词组：MUJI 笔记风；组内统一选择器深度，主 > 辅 ========== */
  ${bodySel} .lyrics-group {
    margin-top: ${Math.round(10 * scale)}px !important;
    margin-bottom: ${Math.round(14 * scale)}px !important;
  }
  ${bodySel} .lyrics-group + .lyrics-group {
    margin-top: ${Math.round(16 * scale)}px !important;
  }
  /* 原文：日/韩/中统一思源宋体细体（MUJI 笔记正文） */
  ${bodySel} .lyrics-group .jp-line,
  ${bodySel} .lyrics-group .jp-line *:not(rt):not(rp),
  ${bodySel} .lyrics-group .ko-line,
  ${bodySel} .lyrics-group .ko-line *:not(rt):not(rp),
  ${bodySel} .lyrics-group .cn-line,
  ${bodySel} .lyrics-group .cn-line *:not(rt):not(rp):not(${ZH_CHAR_SLOT}) {
    font-family: ${minimalSerif} !important;
    font-weight: 300 !important;
    color: ${MINIMAL_LYRICS_COLOR} !important;
    letter-spacing: ${lyricsLsEm}em !important;
    line-height: ${lyricsLhNum} !important;
    font-size: ${minimalMainPx}px !important;
    margin: 0 !important;
  }
  /* 释义 / 译文：PingFang 无衬线，字号 = 辅文档 ×1.2 向上取整，MUJI 宽行距 */
  ${bodySel} .lyrics-group .zh-line,
  ${bodySel} .lyrics-group .zh-line *,
  ${bodySel} .lyrics-group .gloss-line,
  ${bodySel} .lyrics-group .gloss-line * {
    font-family: ${minimalSans} !important;
    font-weight: 300 !important;
    color: rgba(0, 0, 0, 0.45) !important;
    letter-spacing: 0.04em !important;
    line-height: ${lyricsLhNum} !important;
    font-size: ${minimalLyricsZhPx}px !important;
    margin: ${lyricsZhGapPx}px 0 0 0 !important;
  }

  /* ========== 区段标题（重点词汇 / 重点语法）→ 与 TITLE/ARTIST 标签同款 ========== */
  ${root} .lyrics-section-title,
  ${bodySel} h2.lyrics-section-title {
    font-family: ${minimalLabelFont} !important;
    font-size: ${minimalLabelPx}px !important;
    font-weight: 400 !important;
    color: ${MINIMAL_LABEL_COLOR} !important;
    letter-spacing: ${labelLsEm}em !important;
    text-transform: uppercase !important;
    line-height: 1.2 !important;
    text-align: left !important;
    padding: 0 !important;
    margin: 0 0 8px 0 !important;
    border: none !important;
  }

  /* ========== 词汇/语法卡片：极淡底 + 极淡边，MUJI 简约风 ========== */
  ${root} .lyrics-vocabulary,
  ${root} .lyrics-grammar {
    background-color: transparent !important;
    border: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    margin-top: ${sectionGapPx}px !important;
    margin-bottom: ${sectionGapPx}px !important;
  }
  /* 词汇/语法条目：未拆条整组用 sibling 间距；拆条后靠 data-study-part 区分组内/组间 */
  ${bodySel} .lyrics-vocab-item,
  ${bodySel} .lyrics-grammar-item {
    padding: 0 !important;
    margin: 0 0 ${studyGroupGapPx}px 0 !important;
    background-color: transparent !important;
    border: none !important;
    border-radius: 0 !important;
  }
  ${bodySel} .lyrics-vocab-item[data-study-part="continue"],
  ${bodySel} .lyrics-grammar-item[data-study-part="continue"] {
    margin-bottom: ${studyIntraGapPx}px !important;
  }
  ${bodySel} .lyrics-vocab-item[data-study-part="end"],
  ${bodySel} .lyrics-grammar-item[data-study-part="end"] {
    margin-bottom: ${studyGroupGapPx}px !important;
  }
  ${bodySel} > .lyrics-pagination-unit:last-child .lyrics-vocab-item[data-study-part="end"],
  ${bodySel} > .lyrics-pagination-unit:last-child .lyrics-grammar-item[data-study-part="end"],
  ${bodySel} > .lyrics-pagination-unit:last-child .lyrics-vocab-item:not([data-study-part]),
  ${bodySel} > .lyrics-pagination-unit:last-child .lyrics-grammar-item:not([data-study-part]),
  ${bodySel} .lyrics-vocabulary > .lyrics-vocab-item:last-child,
  ${bodySel} .lyrics-grammar > .lyrics-grammar-item:last-child {
    margin-bottom: 0 !important;
  }
  ${bodySel} .lyrics-vocab-item > *,
  ${bodySel} .lyrics-grammar-item > * {
    margin: 0 !important;
    padding: 0 !important;
    line-height: ${studyInnerLh} !important;
    max-width: 100% !important;
  }
  ${bodySel} .lyrics-vocab-item > * + *,
  ${bodySel} .lyrics-grammar-item > * + * {
    margin-top: ${studyIntraGapPx}px !important;
  }
  ${bodySel} .vocab-line1,
  ${bodySel} h3.grammar-point-title,
  ${bodySel} .grammar-detail {
    margin: 0 !important;
    font-family: inherit !important;
    font-size: unset !important;
    font-weight: unset !important;
    color: inherit !important;
    border: none !important;
  }
  /* 例句块：清掉标准版残留 margin-bottom / grammar-ex margin-top */
  ${bodySel} .lyrics-vocab-item .vocab-ex-ja,
  ${bodySel} .lyrics-vocab-item .vocab-ex-ko,
  ${bodySel} .lyrics-vocab-item .vocab-ex-cn,
  ${bodySel} .lyrics-vocab-item .vocab-ex-zh,
  ${bodySel} .lyrics-vocab-item .vocab-ex-gloss,
  ${bodySel} .lyrics-grammar-item .grammar-ex-ja,
  ${bodySel} .lyrics-grammar-item .grammar-ex-ko,
  ${bodySel} .lyrics-grammar-item .grammar-ex-cn,
  ${bodySel} .lyrics-grammar-item .grammar-ex-zh,
  ${bodySel} .lyrics-grammar-item .grammar-ex-gloss {
    margin-bottom: 0 !important;
    padding: 0 !important;
    line-height: ${studyInnerLh} !important;
  }
  /* 词条 / 语法条（源语词头）：PingFang，字号与歌词正文一致（须 ≥ body 的 .vocab-line1 链） */
  ${bodySel} .vocab-line1 .vocab-word,
  ${bodySel} .vocab-line1 .vocab-word *:not(rt):not(rp),
  ${bodySel} .vocab-line1 .vocab-word-cn,
  ${bodySel} .vocab-line1 .vocab-word-cn *:not(rt):not(rp):not(${ZH_CHAR_SLOT}),
  ${bodySel} .vocab-line1 .vocab-word-ko,
  ${bodySel} .vocab-line1 .vocab-word-ko *,
  ${bodySel} h3.grammar-point-title .grammar-title-ja,
  ${bodySel} h3.grammar-point-title .grammar-title-ja *:not(rt):not(rp),
  ${bodySel} h3.grammar-point-title .grammar-title-ko,
  ${bodySel} h3.grammar-point-title .grammar-title-ko *,
  ${bodySel} h3.grammar-point-title .grammar-title-cn,
  ${bodySel} h3.grammar-point-title .grammar-title-cn *:not(rt):not(rp):not(${ZH_CHAR_SLOT}) {
    font-family: ${minimalSans} !important;
    font-size: ${minimalMainPx}px !important;
    font-weight: 500 !important;
    line-height: ${studyInnerLh} !important;
    letter-spacing: 0.04em !important;
    color: #111111 !important;
  }
  /* 释义 / 说明 / 例句：统一 PingFang 辅文档（须 ≥ body 的 .vocab-line1 / h3 链） */
  ${bodySel} .vocab-line1 .vocab-meaning,
  ${bodySel} .vocab-line1 .vocab-meaning *,
  ${bodySel} .grammar-detail,
  ${bodySel} .grammar-detail *,
  ${bodySel} h3.grammar-point-title .grammar-title-zh,
  ${bodySel} h3.grammar-point-title .grammar-title-zh *,
  ${bodySel} h3.grammar-point-title .grammar-title-gloss,
  ${bodySel} h3.grammar-point-title .grammar-title-gloss *,
  ${bodySel} .vocab-ex-ja,
  ${bodySel} .vocab-ex-ja *:not(rt):not(rp),
  ${bodySel} .vocab-ex-ko,
  ${bodySel} .vocab-ex-ko *,
  ${bodySel} .vocab-ex-cn,
  ${bodySel} .vocab-ex-cn *:not(rt):not(rp):not(${ZH_CHAR_SLOT}),
  ${bodySel} .vocab-ex-zh,
  ${bodySel} .vocab-ex-zh *,
  ${bodySel} .vocab-ex-gloss,
  ${bodySel} .vocab-ex-gloss *,
  ${bodySel} .grammar-ex-ja,
  ${bodySel} .grammar-ex-ja *:not(rt):not(rp),
  ${bodySel} .grammar-ex-ko,
  ${bodySel} .grammar-ex-ko *,
  ${bodySel} .grammar-ex-cn,
  ${bodySel} .grammar-ex-cn *:not(rt):not(rp):not(${ZH_CHAR_SLOT}),
  ${bodySel} .grammar-ex-zh,
  ${bodySel} .grammar-ex-zh *,
  ${bodySel} .grammar-ex-gloss,
  ${bodySel} .grammar-ex-gloss * {
    font-family: ${minimalSans} !important;
    font-size: ${minimalAuxPx}px !important;
    font-weight: 300 !important;
    line-height: ${studyInnerLh} !important;
    letter-spacing: 0.04em !important;
    color: rgba(0, 0, 0, 0.5) !important;
  }

  /* ========== Ruby / 拼音注音：极简版完全隐藏（不占行高）========== */
  ${root} ruby rt,
  ${root} ruby rp,
  ${root} .fv-rb-rt,
  ${root} .ruby-rt,
  ${root} .furigana-rt,
  ${root} .kana-rt,
  ${root} ${ZH_CHAR_SLOT} rt,
  ${root} ${ZH_CHAR_SLOT} rp {
    display: none !important;
    height: 0 !important;
    width: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    font-size: 0 !important;
    line-height: 0 !important;
    overflow: hidden !important;
  }
  ${root} ruby,
  ${root} ${ZH_CHAR_SLOT} ruby {
    display: inline !important;
    ruby-position: unset !important;
  }
  ${bodySel} .jp-line ruby,
  ${bodySel} .cn-line ruby,
  ${bodySel} .vocab-word ruby,
  ${bodySel} .grammar-title-ja ruby,
  ${bodySel} .grammar-title-cn ruby {
    padding-bottom: 0 !important;
  }

  /* ========== 水印：继承经典版式（底部品牌 + 页码 + 域名）==========
   * 不覆写 display，沿用 buildPosterWatermarkCss 的底部定位与淡灰配色；
   * 测量层 computePosterBodyMaxHeightPx 已为所有版式（含 minimal）扣除水印安全距离，
   * 故 minimal 与 standard 一样不会压到末行歌词。
   */
  `;
}

export function compilePosterCss(
  resolved: ResolvedTypography,
  options: CompilePosterCssOptions = {},
): string {
  const unit = options.unit ?? 'px';
  const spec = options.spec;
  const includeFontFaces = options.includeFontFaces ?? unit === 'px';
  const backgroundImage = options.backgroundImage;

  const fontFaces = includeFontFaces
    ? `${getPosterJapaneseFontsFaceCss()}${getPosterSourceHanSerifScFontFaceCss()}${getPosterEnglishFontFaceCss()}${getPosterSansationFontFaceCss()}`
    : '';

  const printShell = unit === 'mm' && spec ? compilePrintPageShell(spec, backgroundImage) : '';
  const bodyRules = compileBodyRules(resolved, unit, spec);
  const zhRules = resolved.flags.isZhPipeline
    ? compileZhLayoutCss(resolved, unit, spec)
    : '';
  const watermark = compileWatermarkCss(resolved, unit, spec);
  const cjkNoBreak = buildCjkNoBreakClassCss();
  const showRuby = options.showRuby ?? resolved.flags.showRuby;
  const rubyVisibility = compileRubyVisibilityCss(showRuby);
  const layoutVariantCss = compileLayoutVariantCss(options.layoutVariant, resolved);

  return `${fontFaces}${printShell}${bodyRules}${zhRules}${watermark}${cjkNoBreak}${rubyVisibility}${layoutVariantCss}`;
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
    color: #555555 !important;
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
