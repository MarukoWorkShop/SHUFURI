import type { PosterLayoutProfile, FuriganaEngineDim } from './types';
import { B5_DIM, MOBILE_DIM, POSTER_ELASTIC_FONT_BASE_PX } from './dimensions';
import {
  EN_FONT_FAMILY,
  KOZUKA_MINCHO_EL_FAMILY,
  KO_FONT_FAMILY,
  UI_FONT_FAMILY,
  ZH_FONT_FAMILY,
  getPosterJapaneseFontFaceCss,
  getPosterKoreanFontFaceCss,
  getPosterEnglishFontFaceCss,
} from './fonts';
import type { LyricsLanguage, LangCode } from '../../services/appSettings';

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

/** 分页测量与预览共用的正文区安全余量（吸收 WebKit 字体/ruby 子像素误差） */
export function getPosterBodySafetyMarginPx(profile: PosterLayoutProfile): number {
  return profile === 'mobilePoster' ? 12 : 8;
}

/** 计算 fv-body-h 的 max-height（px），测量与预览共用同一公式 */
export function computePosterBodyMaxHeightPx(
  profile: PosterLayoutProfile,
  options: { showTitle: boolean; titleEl: HTMLElement | null },
): number {
  const { width: _w, height: h } = getFuriganaPosterCanvasDimensions(profile);
  const insets = getFuriganaCanvasInsets(profile);
  const shellInnerH = h - insets.top - insets.bottom;

  let titleH = 0;
  let titleMB = 0;
  if (options.showTitle && options.titleEl) {
    void options.titleEl.offsetHeight;
    titleH = options.titleEl.offsetHeight;
    titleMB = parseFloat(getComputedStyle(options.titleEl).marginBottom) || 0;
  }

  const margin = getPosterBodySafetyMarginPx(profile);
  return Math.max(0, shellInnerH - titleH - titleMB - margin);
}

/**
 * 计算并应用 fv-body-h 的 max-height（导出/测量挂载时调用）。
 * 封装 computePosterBodyMaxHeightPx + applyPosterBodyMaxHeightToPx，
 * 供 paginateFuriganaHtml / posterExportMount 统一调用。
 */
export function applyPosterBodyMaxHeight(
  body: HTMLElement,
  profile: PosterLayoutProfile,
  options: { showTitle: boolean; titleEl: HTMLElement | null },
): void {
  const maxPx = computePosterBodyMaxHeightPx(profile, options);
  applyPosterBodyMaxHeightToPx(body, maxPx);
}

/**
 * 测量正文自然高度（临时取消 max-height 约束，避免 iOS WebKit 下 offsetHeight 累加失真）。
 */
export function measurePosterBodyNaturalHeightPx(body: HTMLElement): number {
  const prevMax = body.style.maxHeight;
  const prevOverflow = body.style.overflow;
  const prevHeight = body.style.height;
  body.style.maxHeight = 'none';
  body.style.height = 'auto';
  body.style.overflow = 'visible';
  void body.offsetHeight;
  const natural = body.scrollHeight;
  body.style.maxHeight = prevMax;
  body.style.height = prevHeight;
  body.style.overflow = prevOverflow;
  void body.offsetHeight;
  return natural;
}

/**
 * 判断正文是否超出 max-height 预算（scrollHeight 对比，block 布局下 iOS 更可靠）。
 */
export function posterBodyExceedsMaxHeight(body: HTMLElement, maxPx: number): boolean {
  if (!Number.isFinite(maxPx) || maxPx <= 0) {
    return false;
  }
  applyPosterBodyMaxHeightToPx(body, maxPx);
  void body.offsetHeight;
  return body.scrollHeight > maxPx + 1;
}

function applyPosterBodyMaxHeightToPx(body: HTMLElement, maxPx: number): void {
  body.style.flexShrink = '0';
  body.style.flexGrow = '0';
  body.style.maxHeight = `${maxPx}px`;
  body.style.overflow = 'hidden';
  body.dataset.posterBodyMaxHeight = String(maxPx);
}

/**
 * 与 paginateFuriganaHtml 一致的 body 溢出判定（受约束 clientHeight + scrollHeight）
 */
export function detectFuriganaPosterBodyOverflow(
  body: HTMLElement,
  profile: PosterLayoutProfile = 'clipPosterPrint',
): boolean {
  void body.offsetHeight;
  const clientH = body.clientHeight;
  if (clientH < 1) {
    return false;
  }
  const slack = profile === 'mobilePoster' ? 10 : 1;
  return body.scrollHeight > clientH + slack;
}

/** 词汇/语法条目间距 = 日文正文行高（line-height × font-size）× 1.5 */
function itemEntryGapPx(jpLineHeight: number, jpFontSizePx: number): number {
  return Math.round(1.5 * jpLineHeight * jpFontSizePx);
}

export type FuriganaPosterCssOptions = {
  /** 防孤行页级行距缩放，1 为默认；测量与渲染一致 */
  spacingScale?: number;
  /** 歌词语言（波轮选择，旧参数；lang 存在时被覆盖） */
  language?: LyricsLanguage;
  /** 排版管线语言（大模型声明或自动检测；优先级高于 language） */
  lang?: LangCode;
};

/**
 * 打印版：标题约为正文 1.25×、日文行 26px（经 elasticFontBase 缩放）、中文行 14px
 * 手机版：标题约为正文 1.22×；词汇/语法条目间距为日文行高的 1.5 倍
 */
export function buildFuriganaPosterInnerCss(
  profile: PosterLayoutProfile,
  options: FuriganaPosterCssOptions = {},
): string {
  const spacingScale = options.spacingScale ?? 1;
  const effectiveLang = options.lang;
  const language = options.language ?? 'jp';
  const scale = (n: number) => n * spacingScale;
  const scaleEm = (n: number) => `${scale(n)}em`;
  const d = dimForFuriganaPoster(profile);
  const isM = profile === 'mobilePoster';
  const base = POSTER_ELASTIC_FONT_BASE_PX;
  const scaleBody = d.elasticFontBase / base;
  // lang 优先（大模型声明 / 自动检测），否则回退旧逻辑（向后兼容）
  // lang='jp' → isCompact=false → JP 管线完全保持不变
  // lang='ko'|'en'|'zh' → isCompact=true → KOR/LATIN 管线
  const isCompact = effectiveLang ? (effectiveLang !== 'jp') : (language === 'en' || language === 'ko');

  const jpFs = Math.round(26 * scaleBody);
  const titleFs = isM
    ? Math.round(jpFs * 1.22)
    : Math.round(jpFs * 1.25);
  const titleMb = d.titleToBodyGap;

  const zhLyricsPx = Math.round(18 * scaleBody);

  const h2Fs = Math.round(18 * scaleBody);

  // 根据语言选择行距：英语/韩语使用紧凑行距，日语使用默认行距（含注音需求）
  const jpLhBase = isCompact
    ? (d.compactLineHeightBase ?? (isM ? 1.25 : 1.45))
    : (isM ? d.elasticLhBase : (d.jpLineHeightBase ?? 1.75));
  const zhLyricsLhBase = isCompact
    ? (d.compactZhLineHeightBase ?? (isM ? 1.15 : 1.2))
    : (isM ? 1.3 : (d.zhLineHeightBase ?? 1.35));
  const jpLh = scale(jpLhBase);
  const zhLyricsLh = scale(zhLyricsLhBase);
  const jpWght = 200;
  const zhAuxWght = 300;
  const koWght = 400;  // 必须与 @font-face 的 font-weight 一致，否则浏览器不匹配 HCR Batang
  const koLh = jpLh;               // 韩文行高复用日文行高
  const isEnglish = effectiveLang === 'en' || (!effectiveLang && language === 'en');
  const primaryFont = isEnglish ? EN_FONT_FAMILY : KOZUKA_MINCHO_EL_FAMILY;
  const primaryWght = isEnglish ? 300 : jpWght;
  const titleFont = isEnglish ? UI_FONT_FAMILY : ZH_FONT_FAMILY;
  const sectionTitleFont = isEnglish ? UI_FONT_FAMILY : ZH_FONT_FAMILY;
  const vocabEmphasisColor = '#1e3a5f';  // 深绀色，替代粗体用于词汇/语法重点标识
  const groupMbNum = isM ? 1.5 : 1.35;
  const groupMb = scaleEm(groupMbNum);
  const lyricsJpZhGap = scaleEm(isM ? 0.06 : 0.04);
  const auxJpZhGap = scaleEm(isM ? 0.05 : 0.03);
  const itemEntryMb = `${Math.round(itemEntryGapPx(jpLhBase, jpFs))}px`;
  const grammarDetailMb = scaleEm(isM ? 0.7 : 0.55);
  const grammarExMt = scaleEm(isM ? 0.65 : 0.5);
  const grammarTitleMt = scaleEm(isM ? 1.15 : 1.35);
  const grammarTitleFirstMt = scaleEm(isM ? 0.45 : 0.55);
  const sectionTitleMt = scaleEm(isM ? 1 : 1.25);
  const sectionTitleFirstMt = scaleEm(isM ? 0.35 : 0.5);
  const bodyBottomPad = getFuriganaBodyBottomPaddingPx(profile);

  return `
  ${getPosterJapaneseFontFaceCss()}
  ${getPosterKoreanFontFaceCss()}
  ${getPosterEnglishFontFaceCss()}
  .fv-html-poster-root .fv-title-h {
    font-family: ${titleFont};
    font-size: ${titleFs}px;
    font-weight: ${zhAuxWght};
    color: #111827;
    text-align: center;
    margin: 0 0 ${titleMb}px 0;
    line-height: ${isM ? d.titleLineHeightRatio : 1.45};
    display: flex;
    align-items: baseline;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.35em;
  }
  .fv-html-poster-root .fv-title-artist {
    font-size: 0.58em;
    font-weight: ${zhAuxWght};
    color: #64748b;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .fv-html-poster-root .fv-title-name--placeholder,
  .fv-html-poster-root .fv-title-artist--placeholder {
    color: #cbd5e1;
    font-weight: 400;
  }
  .fv-html-poster-root .fv-body-h {
    font-family: ${ZH_FONT_FAMILY};
    display: block;
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
    padding-bottom: ${bodyBottomPad}px;
  }
  .fv-html-poster-root .fv-body-h .lyrics-group {
    margin-bottom: ${groupMb};
    break-inside: avoid;
    page-break-inside: avoid;
    overflow: hidden;
    max-width: 100%;
    box-sizing: border-box;
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
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  /* 防止 ruby 注音和中文翻译从右侧溢出：overflow:hidden + 换行约束 */
  .fv-html-poster-root .fv-body-h .lyrics-group .jp-line,
  .fv-html-poster-root .fv-body-h .lyrics-group .ko-line,
  .fv-html-poster-root .fv-body-h .lyrics-group .zh-line {
    overflow: hidden;
    overflow-wrap: break-word;
    word-break: break-word;
    white-space: normal;
  }
  .fv-html-poster-root .fv-body-h .lyrics-pagination-unit .vocab-line1,
  .fv-html-poster-root .fv-body-h .lyrics-pagination-unit .vocab-ex-ja,
  .fv-html-poster-root .fv-body-h .lyrics-pagination-unit .vocab-ex-ko,
  .fv-html-poster-root .fv-body-h .lyrics-pagination-unit .vocab-ex-zh,
  .fv-html-poster-root .fv-body-h .lyrics-pagination-unit h3.grammar-point-title,
  .fv-html-poster-root .fv-body-h .lyrics-pagination-unit .grammar-detail,
  .fv-html-poster-root .fv-body-h .lyrics-pagination-unit .grammar-ex-ja,
  .fv-html-poster-root .fv-body-h .lyrics-pagination-unit .grammar-ex-ko,
  .fv-html-poster-root .fv-body-h .lyrics-pagination-unit .grammar-ex-zh {
    overflow: hidden;
    overflow-wrap: break-word;
    word-break: break-word;
    white-space: normal;
  }
  .fv-html-poster-root .fv-body-h .lyrics-group .jp-line,
  .fv-html-poster-root .fv-body-h .lyrics-group .jp-line *:not(rt):not(rp) {
    font-family: ${primaryFont} !important;
    font-size: ${jpFs}px !important;
    font-weight: ${primaryWght} !important;
    color: #0a0a0a !important;
    line-height: ${jpLh} !important;
    margin: 0 !important;
    letter-spacing: normal;
    font-kerning: normal;
    font-feature-settings: "palt" 0;
  }
  .fv-html-poster-root .fv-body-h .lyrics-group .ko-line,
  .fv-html-poster-root .fv-body-h .lyrics-group .ko-line * {
    margin: 0 !important;
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
    font-family: ${primaryFont} !important;
    font-size: ${jpFs}px !important;
    font-weight: ${primaryWght} !important;
    color: #0a0a0a !important;
    line-height: ${jpLh} !important;
    letter-spacing: normal;
    font-kerning: normal;
    font-feature-settings: "palt" 0;
  }
  .fv-html-poster-root .fv-body-h .ko-line,
  .fv-html-poster-root .fv-body-h .ko-line * {
    font-family: ${KO_FONT_FAMILY} !important;
    font-size: ${jpFs}px !important;
    font-weight: ${koWght} !important;
    color: #0a0a0a !important;
    line-height: ${koLh} !important;
    letter-spacing: normal;
  }
  .fv-html-poster-root .fv-body-h .vocab-ex-ja,
  .fv-html-poster-root .fv-body-h .vocab-ex-ja *:not(rt):not(rp),
  .fv-html-poster-root .fv-body-h .grammar-ex-ja,
  .fv-html-poster-root .fv-body-h .grammar-ex-ja *:not(rt):not(rp) {
    font-family: ${primaryFont} !important;
    font-size: ${jpFs}px !important;
    font-weight: ${primaryWght} !important;
    color: #0a0a0a !important;
    line-height: ${jpLh} !important;
    margin: 0 !important;
  }
  .fv-html-poster-root .fv-body-h .vocab-ex-ko,
  .fv-html-poster-root .fv-body-h .vocab-ex-ko *,
  .fv-html-poster-root .fv-body-h .grammar-ex-ko,
  .fv-html-poster-root .fv-body-h .grammar-ex-ko * {
    font-family: ${KO_FONT_FAMILY} !important;
    font-size: ${jpFs}px !important;
    font-weight: ${koWght} !important;
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
    max-width: 100%;
    overflow-wrap: break-word;
    word-break: break-word;
    white-space: normal;
  }
  .fv-html-poster-root .fv-body-h .vocab-ex-zh,
  .fv-html-poster-root .fv-body-h .grammar-ex-zh {
    margin: ${auxJpZhGap} 0 0 0 !important;
  }
  .fv-html-poster-root .fv-body-h .grammar-detail {
    margin: 0.15em 0 ${grammarDetailMb} 0 !important;
    max-width: 100%;
    overflow-wrap: break-word;
    word-break: break-word;
    white-space: normal;
  }
  .fv-html-poster-root .fv-body-h .vocab-ex-ja,
  .fv-html-poster-root .fv-body-h .vocab-ex-ko,
  .fv-html-poster-root .fv-body-h .vocab-ex-zh,
  .fv-html-poster-root .fv-body-h .grammar-ex-ja,
  .fv-html-poster-root .fv-body-h .grammar-ex-ko,
  .fv-html-poster-root .fv-body-h .grammar-ex-zh {
    max-width: 100%;
    overflow-wrap: break-word;
    word-break: break-word;
    white-space: normal;
  }
  .fv-html-poster-root .fv-body-h .grammar-ex-ja {
    margin-top: ${grammarExMt} !important;
  }
  /* 日文词汇单词（去粗体，改用强调色标识） */
  .fv-html-poster-root .fv-body-h .vocab-line1 .vocab-word,
  .fv-html-poster-root .fv-body-h .vocab-line1 .vocab-word *:not(rt):not(rp) {
    font-family: ${primaryFont} !important;
    font-size: ${jpFs}px !important;
    font-weight: ${primaryWght} !important;
    color: ${vocabEmphasisColor} !important;
    line-height: ${jpLh} !important;
  }
  /* 韩文词汇单词（去粗体，专用韩文字体 + 强调色） */
  .fv-html-poster-root .fv-body-h .vocab-line1 .vocab-word-ko,
  .fv-html-poster-root .fv-body-h .vocab-line1 .vocab-word-ko * {
    font-family: ${KO_FONT_FAMILY} !important;
    font-size: ${jpFs}px !important;
    font-weight: ${koWght} !important;
    color: ${vocabEmphasisColor} !important;
    line-height: ${koLh} !important;
  }
  .fv-html-poster-root .fv-body-h .vocab-line1 .vocab-word ruby rt {
    font-family: ${primaryFont} !important;
    font-size: ${isM ? '0.54em' : '0.58em'} !important;
    font-weight: ${jpWght} !important;
    color: #64748b !important;
    line-height: 1.1 !important;
  }
  .fv-html-poster-root .fv-body-h ruby {
    font-family: ${primaryFont};
    ruby-position: over;
    -webkit-ruby-position: before;
    ruby-align: start;
  }
  .fv-html-poster-root .fv-body-h ruby rt {
    font-family: ${primaryFont};
    font-size: ${isM ? '0.54em' : '0.58em'};
    font-weight: ${jpWght};
    color: #64748b;
    line-height: 1.1;
    letter-spacing: normal;
    font-feature-settings: "palt" 0;
    max-width: 100%;
  }
  .fv-html-poster-root .fv-body-h h2.lyrics-section-title {
    font-family: ${sectionTitleFont};
    font-size: ${h2Fs}px;
    font-weight: ${zhAuxWght};
    color: #1e293b;
    margin: ${sectionTitleMt} 0 0.5em;
  }
  .fv-html-poster-root .fv-body-h .lyrics-grammar > h2.lyrics-section-title:first-child,
  .fv-html-poster-root .fv-body-h .lyrics-vocabulary > h2.lyrics-section-title:first-child {
    margin-top: ${sectionTitleFirstMt};
  }
  .fv-html-poster-root .fv-body-h .lyrics-grammar-item:first-child h3.grammar-point-title {
    margin-top: ${grammarTitleFirstMt};
  }
  .fv-html-poster-root .fv-body-h h3.grammar-point-title {
    font-family: ${sectionTitleFont} !important;
    font-size: ${zhLyricsPx}px !important;
    font-weight: ${zhAuxWght} !important;
    color: #0a0a0a !important;
    line-height: ${zhLyricsLh} !important;
    margin: ${grammarTitleMt} 0 0.4em 0;
    width: 100%;
    max-width: 100%;
    overflow-wrap: break-word;
    word-break: break-word;
    white-space: normal;
  }
  .fv-html-poster-root .fv-body-h h3.grammar-point-title .grammar-title-ja,
  .fv-html-poster-root .fv-body-h h3.grammar-point-title .grammar-title-ja *:not(rt):not(rp) {
    font-family: ${primaryFont} !important;
    font-size: ${jpFs}px !important;
    font-weight: ${primaryWght} !important;
    line-height: ${jpLh} !important;
    color: ${vocabEmphasisColor} !important;
  }
  .fv-html-poster-root .fv-body-h h3.grammar-point-title .grammar-title-ko,
  .fv-html-poster-root .fv-body-h h3.grammar-point-title .grammar-title-ko * {
    font-family: ${KO_FONT_FAMILY} !important;
    font-size: ${jpFs}px !important;
    font-weight: ${koWght} !important;
    line-height: ${koLh} !important;
    color: ${vocabEmphasisColor} !important;
  }
  .fv-html-poster-root .fv-body-h h3.grammar-point-title .grammar-title-zh,
  .fv-html-poster-root .fv-body-h h3.grammar-point-title .grammar-title-zh * {
    font-family: ${ZH_FONT_FAMILY} !important;
    font-size: ${zhLyricsPx}px !important;
    font-weight: ${zhAuxWght} !important;
    line-height: ${zhLyricsLh} !important;
    color: #0a0a0a !important;
    -webkit-text-size-adjust: 100%;
  }
  .fv-html-poster-root .fv-body-h h3.grammar-point-title ruby rt {
    font-family: ${KOZUKA_MINCHO_EL_FAMILY};
    font-size: ${isM ? '0.54em' : '0.58em'};
    font-weight: ${jpWght};
    color: #64748b;
    line-height: 1.1;
    max-width: 100%;
  }
  .fv-html-poster-root .fv-body-h .vocab-line1 .vocab-meaning,
  .fv-html-poster-root .fv-body-h h3.grammar-point-title .grammar-title-zh,
  .fv-html-poster-root .fv-body-h h3.grammar-point-title .grammar-title-zh * {
    font-family: ${ZH_FONT_FAMILY} !important;
    font-weight: ${zhAuxWght} !important;
  }

  /* ===== 杂志文章排版 (.magazine-*) ===== */
  .fv-html-poster-root .fv-body-h .magazine-body {
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
  }
  .fv-html-poster-root .fv-body-h .magazine-section {
    margin-bottom: ${scaleEm(isM ? 1.6 : 1.4)};
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    text-align: left;
    overflow: hidden;
  }
  .fv-html-poster-root .fv-body-h > .magazine-body > .magazine-section:last-child {
    margin-bottom: 0;
  }
  .fv-html-poster-root .fv-body-h .magazine-jp,
  .fv-html-poster-root .fv-body-h .magazine-jp *:not(rt):not(rp) {
    font-family: ${primaryFont} !important;
    font-size: ${jpFs}px !important;
    font-weight: ${primaryWght} !important;
    color: #0a0a0a !important;
    line-height: ${jpLh} !important;
    margin: 0 !important;
    letter-spacing: normal;
    font-kerning: normal;
    font-feature-settings: "palt" 0;
    text-align: left;
    overflow-wrap: break-word;
    word-break: break-word;
    white-space: normal;
    max-width: 100%;
  }
  .fv-html-poster-root .fv-body-h .magazine-zh,
  .fv-html-poster-root .fv-body-h .magazine-zh * {
    font-family: ${ZH_FONT_FAMILY} !important;
    font-size: ${zhLyricsPx}px !important;
    font-weight: ${zhAuxWght} !important;
    color: #0a0a0a !important;
    line-height: ${zhLyricsLh} !important;
    margin: ${scaleEm(isM ? 0.45 : 0.35)} 0 0 0 !important;
    text-align: left;
    overflow-wrap: break-word;
    word-break: break-word;
    white-space: normal;
    max-width: 100%;
  }
  /* 杂志列标签：淡灰色弱化，仅作溯源 */
  .fv-html-poster-root .fv-body-h .magazine-column-label {
    display: inline-block;
    font-family: ${ZH_FONT_FAMILY} !important;
    font-size: ${Math.round(zhLyricsPx * 0.72)}px !important;
    font-weight: 300 !important;
    color: #cbd5e1 !important;
    margin-right: 0.5em;
    user-select: none;
    letter-spacing: 0.05em;
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
    width: `${w}px`,
    height: `${h}px`,
    boxSizing: 'border-box',
    padding: `${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px`,
    background: '#fff',
    overflow: 'hidden',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    position: 'relative',
  };
}

/** 编辑层 modifier：取消正文 max-height 与裁切 */
export function buildFuriganaEditDocumentCssOverrides(): string {
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

/**
 * 编辑文档根节点样式（不裁切溢出，允许查看完整内容）
 * 供 FuriganaEditCanvas 在编辑模式下使用。
 */
export function buildFuriganaEditDocumentRootStyle(
  profile: PosterLayoutProfile,
): Record<string, string | number> {
  const { width: w, height: h } = getFuriganaPosterCanvasDimensions(profile);
  const pad = getFuriganaCanvasInsets(profile);
  return {
    width: `${w}px`,
    height: 'auto',
    minHeight: `${h}px`,
    boxSizing: 'border-box',
    padding: `${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px`,
    background: '#fff',
    overflow: 'visible',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    position: 'relative',
  };
}
