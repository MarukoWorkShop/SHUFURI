import type { LangCode } from '../../services/appSettings';

export const POSTER_TEXT_ROLES = [
  'posterTitle',
  'posterArtist',
  'lyricPrimary',
  'lyricSecondary',
  'rubyAnnotation',
  'sectionTitle',
  'studyTerm',
  'studyAux',
  'studyExample',
  'grammarPointShell',
  'pageNumber',
] as const;

export type PosterTextRole = (typeof POSTER_TEXT_ROLES)[number];

export type TextWrapMode = 'cjk' | 'latin' | 'inherit';

export interface TypographyToken {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: string;
  color: string;
  wrap: TextWrapMode;
  ruby?: {
    position: 'over' | 'before';
    rtEm: number;
    rtColor: string;
    rtWeight: number;
  };
}

export interface LayoutSpacingTokens {
  groupMb: string;
  lyricsJpZhGap: string;
  auxJpZhGap: string;
  itemEntryMb: string;
  grammarDetailMb: string;
  grammarExMt: string;
  grammarTitleMt: string;
  grammarTitleFirstMt: string;
  sectionTitleMt: string;
  sectionTitleFirstMt: string;
  bodyBottomPadPx: number;
  titleMbPx: number;
  titleFsPx: number;
  titleLineHeight: number;
  mainPx: number;
  auxPx: number;
  zhMainPx: number;
  h2Px: number;
  jpLh: number;
  zhLyricsLh: number;
  koLh: number;
  mainRtEm: number;
}

export interface ZhLayoutTokens {
  pinyinColor: string;
  cnFs: number;
  mainLh: number;
  rtEm: number;
  glossFs: number;
  glossLh: number;
  lyricsAuxGapEm: number;
  rubyGapEm: number;
  vocabItemMbEm: number;
  bulletLegPx: number;
  bulletBasePx: number;
  grammarItemMbPx: number;
  bulletTopPx: number;
}

export interface ResolvedTypography {
  lang: LangCode;
  profile: import('../shufuriPoster/types.ts').PosterLayoutProfile;
  spacingScale: number;
  roles: Record<PosterTextRole, TypographyToken>;
  layout: LayoutSpacingTokens;
  zhLayout?: ZhLayoutTokens;
  flags: {
    isMobile: boolean;
    isZhPipeline: boolean;
    isCompact: boolean;
    isEnglish: boolean;
  };
  cjkLetterSpacing: string;
  vocabEmphasisColor: string;
}

/** 角色 → 管线选择器（DOM class 保持不变） */
export const ROLE_SELECTOR_MAP: Record<PosterTextRole, Partial<Record<LangCode | 'default', string>>> = {
  posterTitle: { default: '.fv-title-h' },
  posterArtist: { default: '.fv-title-artist' },
  lyricPrimary: {
    jp: '.jp-line',
    ko: '.ko-line',
    en: '.jp-line',
    zh: '.cn-line',
  },
  lyricSecondary: {
    jp: '.zh-line',
    ko: '.zh-line',
    en: '.gloss-line',
    zh: '.gloss-line',
  },
  rubyAnnotation: { default: 'ruby rt' },
  sectionTitle: { default: 'h2.lyrics-section-title' },
  studyTerm: { default: '.vocab-word, .vocab-word-ko, .grammar-title-ja, .grammar-title-ko, .grammar-title-cn, .grammar-title-zh' },
  studyAux: { default: '.vocab-meaning, .grammar-detail, .grammar-title-gloss, .grammar-ex-gloss' },
  studyExample: { default: '.vocab-ex-ja, .vocab-ex-ko, .vocab-ex-zh, .vocab-ex-cn, .grammar-ex-ja, .grammar-ex-ko, .grammar-ex-zh, .grammar-ex-cn' },
  grammarPointShell: { default: 'h3.grammar-point-title' },
  pageNumber: { default: '.fv-poster-page-no' },
};

export function roleSelector(role: PosterTextRole, lang: LangCode): string {
  const map = ROLE_SELECTOR_MAP[role];
  return map[lang] ?? map.default ?? '';
}
