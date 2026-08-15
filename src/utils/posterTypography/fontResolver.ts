import type { ColorTheme, LangCode, LyricsLanguage } from '../../services/appSettings';
import type { PosterFontStyle, PosterLayoutProfile } from '../shufuriPoster/types.ts';
import { dimForProfile, POSTER_ELASTIC_FONT_BASE_PX } from '../shufuriPoster/dimensions.ts';
import {
  EN_FONT_FAMILY,
  KO_FONT_FAMILY_BATANG,
  KO_FONT_FAMILY_SYSTEM_SERIF,
  KO_POSTER_TITLE_FONT_FAMILY_BATANG,
  KO_POSTER_TITLE_FONT_FAMILY_SYSTEM,
  KOZMIN_PRO_REGULAR_FAMILY,
  UI_FONT_FAMILY,
  ZH_FONT_FAMILY,
  ZH_POSTER_TITLE_FONT_FAMILY,
  ZH_SONGTI_FONT_FAMILY,
} from '../shufuriPoster/fonts.ts';
import { cjkFontScale, cjkLetterSpacingEm, kamiLetterSpacingEm } from '../shufuriPoster/cjkTypography.ts';
import {
  AUX_WEIGHT,
  BASE_AUX_PX,
  BASE_MAIN_PX,
  BASE_SECTION_TITLE_PX,
  BODY_TEXT_COLOR,
  GLOSS_COLOR,
  JP_LYRIC_AUX_BASE_PX,
  JP_LYRIC_GROUP_GAP_BASE_PX,
  JP_LYRIC_LINE_HEIGHT,
  JP_LYRIC_MAIN_BASE_PX,
  JP_RUBY_COLOR,
  JP_RUBY_RT_EM_MOBILE,
  JP_RUBY_RT_EM_PRINT,
  ZH_RUBY_RT_EM_MOBILE,
  ZH_RUBY_RT_EM_PRINT,
  ZH_RUBY_COLOR,
  JP_RUBY_WEIGHT,
  KAMI_GROUP_MB_EM,
  KAMI_LETTER_SPACING_EM,
  KO_PRIMARY_WEIGHT,
  LANG_WHEEL_INDICATOR_BASE_PX,
  LANG_WHEEL_INDICATOR_LEG_PX,
  LYRIC_PRIMARY_WEIGHT,
  LYRIC_SECONDARY_WEIGHT,
  JP_ZH_LINE_WEIGHT,
  VOCAB_EMPHASIS_COLOR,
  ZH_OPTICAL_SCALE,
  ZH_VOCAB_ITEM_MB_EM,
  CN_RUBY_GAP_EM,
  TITLE_TEXT_COLOR,
  ARTIST_TEXT_COLOR,
  SECTION_TITLE_COLOR,
} from './typographyConstants.ts';
import type {
  LayoutSpacingTokens,
  PosterTextRole,
  ResolvedTypography,
  TypographyToken,
  ZhLayoutTokens,
} from './tokenRegistry.ts';

export function resolvePinyinAccentColor(_theme: ColorTheme = 'mono'): string {
  return ZH_RUBY_COLOR;
}

export interface ResolverContext {
  profile: PosterLayoutProfile;
  lang: LangCode;
  spacingScale?: number;
  colorTheme?: ColorTheme;
  showRuby?: boolean;
  userFontScale?: number;
  userLineHeightScale?: number;
  /** @deprecated 仅 resolveLang 过渡用 */
  language?: LyricsLanguage;
  /** 韩文字体样式：system（默认零下载）/ batang（HCR Batang 衬线，按需加载） */
  posterFontStyle?: PosterFontStyle;
}

export function supportsPosterRubyToggle(lang: LangCode): boolean {
  return lang === 'jp' || lang === 'zh';
}

export function resolveLangFromOptions(options: {
  lang?: LangCode;
  language?: LyricsLanguage;
}): LangCode {
  if (options.lang) return options.lang;
  const language = options.language ?? 'jp';
  if (language === 'zh') return 'zh';
  if (language === 'ko') return 'ko';
  if (language === 'en') return 'en';
  return 'jp';
}

/**
 * 歌名区默认字体（整段 h1 继承）。
 * jp 默认 KozMin；简体中译歌名/歌手由 `.fv-title-serif--source-han` 覆盖为思源宋体。
 * zh 一律思源；ko 思源+Batang；en KozMin。
 */
export function resolvePosterTitleFont(lang: LangCode, posterFontStyle?: PosterFontStyle): string {
  switch (lang) {
    case 'ko':
      return posterFontStyle === 'batang'
        ? KO_POSTER_TITLE_FONT_FAMILY_BATANG
        : KO_POSTER_TITLE_FONT_FAMILY_SYSTEM;
    case 'zh':
      return ZH_POSTER_TITLE_FONT_FAMILY;
    case 'en':
      return KOZMIN_PRO_REGULAR_FAMILY;
    case 'jp':
    default:
      return KOZMIN_PRO_REGULAR_FAMILY;
  }
}

function itemEntryGapPx(jpLineHeight: number, jpFontSizePx: number): number {
  return Math.round(1.5 * jpLineHeight * jpFontSizePx);
}

function baseToken(
  partial: Partial<TypographyToken> & Pick<TypographyToken, 'fontFamily' | 'fontSize' | 'fontWeight' | 'lineHeight'>,
): TypographyToken {
  return {
    letterSpacing: '0',
    color: BODY_TEXT_COLOR,
    wrap: 'inherit',
    ...partial,
  };
}

export function resolvePosterTypography(ctx: ResolverContext): ResolvedTypography {
  const pageSpacing = ctx.spacingScale ?? 1;
  const fontScale = pageSpacing * (ctx.userFontScale ?? 1);
  const lineScale = pageSpacing * (ctx.userLineHeightScale ?? 1);
  const lang = ctx.lang;
  const scaleLine = (n: number) => n * lineScale;
  const scaleEmLine = (n: number) => `${scaleLine(n)}em`;
  const d = dimForProfile(ctx.profile);
  const isMobile = ctx.profile === 'mobilePoster';
  const cjkFsMul = cjkFontScale(fontScale);
  const cjkLs = isMobile
    ? kamiLetterSpacingEm(fontScale, KAMI_LETTER_SPACING_EM)
    : cjkLetterSpacingEm(fontScale);
  const scaleBody = d.elasticFontBase / POSTER_ELASTIC_FONT_BASE_PX;
  const showRuby = ctx.showRuby ?? true;
  const rubyAffectsLayout = supportsPosterRubyToggle(lang) && showRuby;
  const isCompact = lang === 'ko' || lang === 'en' || !rubyAffectsLayout;
  const isZhPipeline = lang === 'zh';
  const isEnglish = lang === 'en';
  const isJpPipeline = lang === 'jp';

  // 日语导出：主文 / 译文基准见 JP_LYRIC_*；其它语言沿用 BASE_MAIN / BASE_AUX
  const mainBasePx = isJpPipeline ? JP_LYRIC_MAIN_BASE_PX : BASE_MAIN_PX;
  const auxBasePx = isJpPipeline ? JP_LYRIC_AUX_BASE_PX : BASE_AUX_PX;
  const mainPx = Math.round(mainBasePx * scaleBody * cjkFsMul);
  const auxPx = Math.round(auxBasePx * scaleBody * cjkFsMul);
  const zhMainPx = Math.round(mainPx * ZH_OPTICAL_SCALE);
  const h2Px = Math.round(BASE_SECTION_TITLE_PX * scaleBody);
  const titleFsPx = mainPx;
  // 假名相对主文：恢复修改前 mobile 0.54 / print 0.58
  const mainRtEm = isMobile ? JP_RUBY_RT_EM_MOBILE : JP_RUBY_RT_EM_PRINT;

  const jpLhBase = isCompact
    ? (d.compactLineHeightBase ?? (isMobile ? 1.25 : 1.45))
    : isJpPipeline
      ? JP_LYRIC_LINE_HEIGHT
      : (isMobile ? d.elasticLhBase : (d.jpLineHeightBase ?? 1.75));
  const zhLyricsLhBase = isCompact
    ? (d.compactZhLineHeightBase ?? (isMobile ? 1.15 : 1.2))
    : (d.zhLineHeightBase ?? (isMobile ? 1.3 : 1.35));
  const jpLh = scaleLine(jpLhBase);
  const zhLyricsLh = scaleLine(zhLyricsLhBase);
  const koLh = jpLh;

  const titleFont = resolvePosterTitleFont(lang, ctx.posterFontStyle);
  const sectionTitleFont = isEnglish ? UI_FONT_FAMILY : ZH_FONT_FAMILY;
  const jpLyricFont = isEnglish ? EN_FONT_FAMILY : KOZMIN_PRO_REGULAR_FAMILY;
  const jpStudyFont = isEnglish ? EN_FONT_FAMILY : KOZMIN_PRO_REGULAR_FAMILY;

  const layout: LayoutSpacingTokens = {
    groupMb: isJpPipeline
      ? `${Math.round(JP_LYRIC_GROUP_GAP_BASE_PX * scaleBody * lineScale)}px`
      : scaleEmLine(isMobile ? KAMI_GROUP_MB_EM : 1.35),
    lyricsJpZhGap: scaleEmLine(isMobile ? 0.06 : 0.04),
    auxJpZhGap: scaleEmLine(isMobile ? 0.05 : 0.03),
    itemEntryMb: `${itemEntryGapPx(jpLh, mainPx)}px`,
    grammarDetailMb: scaleEmLine(isMobile ? 0.7 : 0.55),
    grammarExMt: scaleEmLine(isMobile ? 0.65 : 0.5),
    grammarTitleMt: scaleEmLine(isMobile ? 1.15 : 1.35),
    grammarTitleFirstMt: scaleEmLine(isMobile ? 0.45 : 0.55),
    sectionTitleMt: scaleEmLine(isMobile ? 1 : 1.25),
    sectionTitleFirstMt: scaleEmLine(isMobile ? 0.35 : 0.5),
    bodyBottomPadPx:
      ctx.profile === 'mobilePoster' ? 64 : ctx.profile === 'squarePoster' ? 48 : 32,
    titleMbPx: d.titleToBodyGap,
    titleFsPx,
    titleLineHeight: isMobile ? d.titleLineHeightRatio : 1.45,
    mainPx,
    auxPx,
    zhMainPx,
    h2Px,
    jpLh,
    zhLyricsLh,
    koLh,
    mainRtEm,
  };

  let zhLayout: ZhLayoutTokens | undefined;
  if (isZhPipeline) {
    const pinyinColor = resolvePinyinAccentColor(ctx.colorTheme);
    // 中文拼音比日文振假名大一档，提升可读性
    const zhRtEm = isMobile ? ZH_RUBY_RT_EM_MOBILE : ZH_RUBY_RT_EM_PRINT;
    const cnFs = zhMainPx;
    const glossFs = auxPx;
    const lyricsAuxGapEm = (isMobile ? 0.06 : 0.04) * lineScale;
    const rubyGapEm = CN_RUBY_GAP_EM * fontScale;
    const bulletLegPx = Math.round(LANG_WHEEL_INDICATOR_LEG_PX * scaleBody);
    const bulletBasePx = Math.round(LANG_WHEEL_INDICATOR_BASE_PX * scaleBody);
    zhLayout = {
      pinyinColor,
      cnFs,
      mainLh: jpLh,
      rtEm: zhRtEm,
      glossFs,
      glossLh: zhLyricsLh,
      lyricsAuxGapEm,
      rubyGapEm,
      vocabItemMbEm: ZH_VOCAB_ITEM_MB_EM * lineScale,
      bulletLegPx,
      bulletBasePx,
      grammarItemMbPx: Math.round(cnFs * jpLh * 1.2),
      bulletTopPx: Math.round(cnFs * (zhRtEm * 1.05 + 0.06)),
    };
  }

  const lyricPrimarySize = isZhPipeline ? zhMainPx : mainPx;
  /** 中文歌词正文用思源宋体；PingFang 仅留给 UI / 辅文 / 词解
   *  韩文：system 模式走系统衬线栈（与标题统一），batang 模式走 HCR Batang */
  const lyricPrimaryFont =
    lang === 'ko'
      ? (ctx.posterFontStyle === 'batang' ? KO_FONT_FAMILY_BATANG : KO_FONT_FAMILY_SYSTEM_SERIF)
      : lang === 'en'
        ? EN_FONT_FAMILY
        : lang === 'zh'
          ? ZH_SONGTI_FONT_FAMILY
          : jpLyricFont;
  const lyricPrimaryWeight =
    lang === 'ko' ? KO_PRIMARY_WEIGHT : LYRIC_PRIMARY_WEIGHT;

  const roles = {} as Record<PosterTextRole, TypographyToken>;

  roles.posterTitle = baseToken({
    fontFamily: titleFont,
    fontSize: titleFsPx,
    fontWeight: LYRIC_PRIMARY_WEIGHT,
    lineHeight: layout.titleLineHeight,
    color: TITLE_TEXT_COLOR,
    letterSpacing: '0.02em',
    wrap: 'inherit',
  });

  roles.posterArtist = baseToken({
    fontFamily: titleFont,
    fontSize: Math.round(titleFsPx * 0.58),
    fontWeight: LYRIC_PRIMARY_WEIGHT,
    lineHeight: layout.titleLineHeight,
    color: ARTIST_TEXT_COLOR,
    letterSpacing: '0.02em',
    wrap: 'inherit',
  });

  roles.lyricPrimary = baseToken({
    fontFamily: lyricPrimaryFont,
    fontSize: lyricPrimarySize,
    fontWeight: lyricPrimaryWeight,
    lineHeight: isZhPipeline ? jpLh : lang === 'ko' ? koLh : jpLh,
    color: BODY_TEXT_COLOR,
    letterSpacing: cjkLs,
    wrap: 'cjk',
  });

  const lyricSecondaryFont =
    isZhPipeline || lang === 'en' ? EN_FONT_FAMILY : ZH_FONT_FAMILY;

  roles.lyricSecondary = baseToken({
    fontFamily: lyricSecondaryFont,
    fontSize: auxPx,
    fontWeight: lang === 'jp' ? JP_ZH_LINE_WEIGHT : LYRIC_SECONDARY_WEIGHT,
    lineHeight: zhLyricsLh,
    color: isZhPipeline ? GLOSS_COLOR : BODY_TEXT_COLOR,
    letterSpacing: isZhPipeline ? '0' : cjkLs,
    wrap: isZhPipeline ? 'latin' : 'cjk',
  });

  roles.rubyAnnotation = baseToken({
    fontFamily: isZhPipeline ? ZH_FONT_FAMILY : KOZMIN_PRO_REGULAR_FAMILY,
    fontSize: lyricPrimarySize,
    fontWeight: isZhPipeline ? LYRIC_PRIMARY_WEIGHT : JP_RUBY_WEIGHT,
    lineHeight: 1.1,
    color: isZhPipeline ? (zhLayout?.pinyinColor ?? '#000') : JP_RUBY_COLOR,
    letterSpacing: 'normal',
    wrap: 'inherit',
    ruby: {
      position: 'over',
      rtEm: mainRtEm,
      rtColor: isZhPipeline ? (zhLayout?.pinyinColor ?? '#000') : JP_RUBY_COLOR,
      rtWeight: isZhPipeline ? LYRIC_PRIMARY_WEIGHT : JP_RUBY_WEIGHT,
    },
  });

  roles.sectionTitle = baseToken({
    fontFamily: sectionTitleFont,
    fontSize: h2Px,
    fontWeight: AUX_WEIGHT,
    lineHeight: 1.4,
    color: SECTION_TITLE_COLOR,
    wrap: 'cjk',
  });

  roles.studyTerm = baseToken({
    fontFamily: isZhPipeline ? ZH_FONT_FAMILY : jpStudyFont,
    fontSize: mainPx,
    fontWeight: isEnglish ? LYRIC_PRIMARY_WEIGHT : lyricPrimaryWeight,
    lineHeight: lang === 'ko' || lang === 'en' ? koLh : jpLh,
    color: VOCAB_EMPHASIS_COLOR,
    letterSpacing: isZhPipeline ? '0' : cjkLs,
    wrap: isZhPipeline ? 'latin' : 'cjk',
  });

  roles.studyAux = baseToken({
    fontFamily: ZH_FONT_FAMILY,
    fontSize: auxPx,
    /** 与歌词译文 lyricSecondary 同字重（日语稿 JP_ZH_LINE_WEIGHT） */
    fontWeight: lang === 'jp' ? JP_ZH_LINE_WEIGHT : LYRIC_SECONDARY_WEIGHT,
    lineHeight: zhLyricsLh,
    color: isZhPipeline ? GLOSS_COLOR : BODY_TEXT_COLOR,
    letterSpacing: isZhPipeline ? '0' : cjkLs,
    wrap: isZhPipeline ? 'latin' : 'cjk',
  });

  roles.studyExample = baseToken({
    fontFamily: isZhPipeline ? ZH_FONT_FAMILY : jpStudyFont,
    fontSize: auxPx,
    fontWeight: lyricPrimaryWeight,
    lineHeight: lang === 'ko' || lang === 'en' ? koLh : jpLh,
    color: BODY_TEXT_COLOR,
    letterSpacing: cjkLs,
    wrap: 'cjk',
  });

  roles.grammarPointShell = baseToken({
    fontFamily: sectionTitleFont,
    fontSize: auxPx,
    fontWeight: AUX_WEIGHT,
    lineHeight: zhLyricsLh,
    color: BODY_TEXT_COLOR,
    letterSpacing: cjkLs,
    wrap: 'cjk',
  });

  roles.pageNumber = baseToken({
    fontFamily: '"Sansation", sans-serif',
    fontSize: 14,
    fontWeight: AUX_WEIGHT,
    lineHeight: 1,
    color: 'rgba(0, 0, 0, 0.3)',
    wrap: 'inherit',
  });

  return {
    lang,
    profile: ctx.profile,
    spacingScale: pageSpacing,
    roles,
    layout,
    zhLayout,
    flags: { isMobile, isZhPipeline, isCompact, isEnglish, showRuby },
    cjkLetterSpacing: cjkLs,
    vocabEmphasisColor: VOCAB_EMPHASIS_COLOR,
  };
}
