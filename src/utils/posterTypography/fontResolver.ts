import type { ColorTheme, LangCode, LyricsLanguage } from '../../services/appSettings';
import type { PosterLayoutProfile } from '../shufuriPoster/types.ts';
import { dimForFuriganaPoster, POSTER_ELASTIC_FONT_BASE_PX } from '../shufuriPoster/dimensions.ts';
import {
  EN_FONT_FAMILY,
  KO_FONT_FAMILY,
  KO_POSTER_TITLE_FONT_FAMILY,
  KOZMIN_PRO_REGULAR_FAMILY,
  KOZUKA_MINCHO_EL_FAMILY,
  UI_FONT_FAMILY,
  ZH_FONT_FAMILY,
  ZH_POSTER_TITLE_FONT_FAMILY,
  ZH_SONGTI_FONT_FAMILY,
} from '../shufuriPoster/fonts.ts';
import { cjkFontScale, cjkLetterSpacingEm } from '../shufuriPoster/cjkTypography.ts';
import {
  AUX_WEIGHT,
  BASE_AUX_PX,
  BASE_MAIN_PX,
  BASE_SECTION_TITLE_PX,
  GLOSS_COLOR,
  JP_RUBY_COLOR,
  JP_RUBY_RT_EM_MOBILE,
  JP_RUBY_RT_EM_PRINT,
  JP_RUBY_WEIGHT,
  KO_PRIMARY_WEIGHT,
  LANG_WHEEL_INDICATOR_BASE_PX,
  LANG_WHEEL_INDICATOR_LEG_PX,
  LYRIC_PRIMARY_WEIGHT,
  LYRIC_SECONDARY_WEIGHT,
  VOCAB_EMPHASIS_COLOR,
  ZH_OPTICAL_SCALE,
  ZH_VOCAB_ITEM_MB_EM,
  CN_RUBY_GAP_EM,
} from './typographyConstants.ts';
import type {
  LayoutSpacingTokens,
  PosterTextRole,
  ResolvedTypography,
  TypographyToken,
  ZhLayoutTokens,
} from './tokenRegistry.ts';

export function resolvePinyinAccentColor(theme: ColorTheme = 'mono'): string {
  switch (theme) {
    case 'red':
      return '#8b3535';
    case 'blue':
      return '#2b3a4a';
    case 'mono':
    default:
      return '#000000';
  }
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

/** 歌名区字体：jp 汉字标题优先宋体+KozMin 回退 · ko 宋体+Batang · zh 宋体 · en KozMin */
export function resolvePosterTitleFont(lang: LangCode): string {
  switch (lang) {
    case 'ko':
      return KO_POSTER_TITLE_FONT_FAMILY;
    case 'zh':
      return ZH_POSTER_TITLE_FONT_FAMILY;
    case 'en':
      return KOZMIN_PRO_REGULAR_FAMILY;
    case 'jp':
    default:
      return `${ZH_SONGTI_FONT_FAMILY}, ${KOZMIN_PRO_REGULAR_FAMILY}`;
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
    color: '#0a0a0a',
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
  const cjkFsMul = cjkFontScale(fontScale);
  const cjkLs = cjkLetterSpacingEm(fontScale);
  const d = dimForFuriganaPoster(ctx.profile);
  const isMobile = ctx.profile === 'mobilePoster';
  const scaleBody = d.elasticFontBase / POSTER_ELASTIC_FONT_BASE_PX;
  const showRuby = ctx.showRuby ?? true;
  const rubyAffectsLayout = supportsPosterRubyToggle(lang) && showRuby;
  const isCompact = lang === 'ko' || lang === 'en' || !rubyAffectsLayout;
  const isZhPipeline = lang === 'zh';
  const isEnglish = lang === 'en';

  const mainPx = Math.round(BASE_MAIN_PX * scaleBody * cjkFsMul);
  const auxPx = Math.round(BASE_AUX_PX * scaleBody * cjkFsMul);
  const zhMainPx = Math.round(mainPx * ZH_OPTICAL_SCALE);
  const h2Px = Math.round(BASE_SECTION_TITLE_PX * scaleBody);
  const titleFsPx = mainPx;
  const mainRtEm = isMobile ? JP_RUBY_RT_EM_MOBILE : JP_RUBY_RT_EM_PRINT;

  const jpLhBase = isCompact
    ? (d.compactLineHeightBase ?? (isMobile ? 1.25 : 1.45))
    : (isMobile ? d.elasticLhBase : (d.jpLineHeightBase ?? 1.75));
  const zhLyricsLhBase = isCompact
    ? (d.compactZhLineHeightBase ?? (isMobile ? 1.15 : 1.2))
    : (isMobile ? 1.3 : (d.zhLineHeightBase ?? 1.35));
  const jpLh = scaleLine(jpLhBase);
  const zhLyricsLh = scaleLine(zhLyricsLhBase);
  const koLh = jpLh;

  const titleFont = resolvePosterTitleFont(lang);
  const sectionTitleFont = isEnglish ? UI_FONT_FAMILY : ZH_FONT_FAMILY;
  const jpLyricFont = isEnglish ? EN_FONT_FAMILY : KOZMIN_PRO_REGULAR_FAMILY;
  const jpStudyFont = isEnglish ? EN_FONT_FAMILY : KOZMIN_PRO_REGULAR_FAMILY;

  const layout: LayoutSpacingTokens = {
    groupMb: scaleEmLine(isMobile ? 1.5 : 1.35),
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
      rtEm: mainRtEm,
      glossFs,
      glossLh: zhLyricsLh,
      lyricsAuxGapEm,
      rubyGapEm,
      vocabItemMbEm: ZH_VOCAB_ITEM_MB_EM * lineScale,
      bulletLegPx,
      bulletBasePx,
      grammarItemMbPx: Math.round(cnFs * jpLh * 1.2),
      bulletTopPx: Math.round(cnFs * (mainRtEm * 1.05 + 0.06)),
    };
  }

  const lyricPrimarySize = isZhPipeline ? zhMainPx : mainPx;
  const lyricPrimaryFont =
    lang === 'ko'
      ? KO_FONT_FAMILY
      : lang === 'en'
        ? EN_FONT_FAMILY
        : lang === 'zh'
          ? ZH_FONT_FAMILY
          : jpLyricFont;
  const lyricPrimaryWeight =
    lang === 'ko' ? KO_PRIMARY_WEIGHT : LYRIC_PRIMARY_WEIGHT;

  const roles = {} as Record<PosterTextRole, TypographyToken>;

  roles.posterTitle = baseToken({
    fontFamily: titleFont,
    fontSize: titleFsPx,
    fontWeight: LYRIC_PRIMARY_WEIGHT,
    lineHeight: layout.titleLineHeight,
    color: '#111827',
    letterSpacing: '0.02em',
    wrap: 'inherit',
  });

  roles.posterArtist = baseToken({
    fontFamily: titleFont,
    fontSize: Math.round(titleFsPx * 0.58),
    fontWeight: LYRIC_PRIMARY_WEIGHT,
    lineHeight: layout.titleLineHeight,
    color: '#64748b',
    letterSpacing: '0.02em',
    wrap: 'inherit',
  });

  roles.lyricPrimary = baseToken({
    fontFamily: lyricPrimaryFont,
    fontSize: lyricPrimarySize,
    fontWeight: lyricPrimaryWeight,
    lineHeight: isZhPipeline ? jpLh : lang === 'ko' ? koLh : jpLh,
    color: '#0a0a0a',
    letterSpacing: cjkLs,
    wrap: 'cjk',
  });

  const lyricSecondaryFont =
    isZhPipeline || lang === 'en' ? EN_FONT_FAMILY : ZH_FONT_FAMILY;

  roles.lyricSecondary = baseToken({
    fontFamily: lyricSecondaryFont,
    fontSize: auxPx,
    fontWeight: LYRIC_SECONDARY_WEIGHT,
    lineHeight: zhLyricsLh,
    color: isZhPipeline ? GLOSS_COLOR : '#0a0a0a',
    letterSpacing: isZhPipeline ? '0' : cjkLs,
    wrap: isZhPipeline ? 'latin' : 'cjk',
  });

  roles.rubyAnnotation = baseToken({
    fontFamily: isZhPipeline ? ZH_FONT_FAMILY : KOZUKA_MINCHO_EL_FAMILY,
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
    color: '#1e293b',
    wrap: 'cjk',
  });

  roles.studyTerm = baseToken({
    fontFamily: jpStudyFont,
    fontSize: mainPx,
    fontWeight: isEnglish ? LYRIC_PRIMARY_WEIGHT : lyricPrimaryWeight,
    lineHeight: lang === 'ko' || lang === 'en' ? koLh : jpLh,
    color: VOCAB_EMPHASIS_COLOR,
    letterSpacing: cjkLs,
    wrap: 'cjk',
  });

  roles.studyAux = baseToken({
    fontFamily: ZH_FONT_FAMILY,
    fontSize: auxPx,
    fontWeight: isZhPipeline ? LYRIC_SECONDARY_WEIGHT : AUX_WEIGHT,
    lineHeight: zhLyricsLh,
    color: isZhPipeline ? GLOSS_COLOR : '#0a0a0a',
    letterSpacing: isZhPipeline ? '0' : cjkLs,
    wrap: isZhPipeline ? 'latin' : 'cjk',
  });

  roles.studyExample = baseToken({
    fontFamily: jpStudyFont,
    fontSize: auxPx,
    fontWeight: lyricPrimaryWeight,
    lineHeight: lang === 'ko' || lang === 'en' ? koLh : jpLh,
    color: '#0a0a0a',
    letterSpacing: cjkLs,
    wrap: 'cjk',
  });

  roles.grammarPointShell = baseToken({
    fontFamily: sectionTitleFont,
    fontSize: auxPx,
    fontWeight: AUX_WEIGHT,
    lineHeight: zhLyricsLh,
    color: '#0a0a0a',
    letterSpacing: cjkLs,
    wrap: 'cjk',
  });

  roles.pageNumber = baseToken({
    fontFamily: ZH_FONT_FAMILY,
    fontSize: 13,
    fontWeight: AUX_WEIGHT,
    lineHeight: 1.2,
    color: '#94a3b8',
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
