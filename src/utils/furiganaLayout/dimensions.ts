import type { FuriganaEngineDim, PosterLayoutProfile } from './types';
import type { LyricsLanguage, LangCode } from '../../services/appSettings';

/** 通用排版常量 */
export const POSTER_ELASTIC_FONT_BASE_PX = 18;

/** 打印排版 B5：600×852，左右内边距 45 */
export const B5_DIM: FuriganaEngineDim = {
  profile: 'clipPosterPrint',
  canvasWidth: 600,
  canvasHeight: 852,
  padH: 45,
  pagePadTopCont: 40,
  pageBottomDefault: 80,
  textBottomClearance: 0,
  elasticFontBase: 12,
  elasticFontMin: 12,
  elasticLhBase: 1.7,
  titleFontSize: 17,
  titleLineHeightRatio: 1.22,
  titleToBodyGap: 14,
  // 日语默认行距（含注音需求）
  jpLineHeightBase: 1.75,
  zhLineHeightBase: 1.35,
  // 无注音语言紧凑行距（ENG/KOR）
  compactLineHeightBase: 1.45,
  compactZhLineHeightBase: 1.2,
};

/** 手机竖屏 1080×1920 */
export const MOBILE_DIM: FuriganaEngineDim = {
  profile: 'mobilePoster',
  canvasWidth: 1080,
  canvasHeight: 1920,
  padH: 160,
  pagePadTopCont: 96,
  pageBottomDefault: 156,
  textBottomClearance: 56,
  elasticFontBase: 32,
  elasticFontMin: 28,
  elasticLhBase: 1.48,
  titleFontSize: 56,
  titleLineHeightRatio: 1.2,
  titleToBodyGap: 40,
  // 日语默认行距（含注音需求）
  jpLineHeightBase: 1.48,
  zhLineHeightBase: 1.3,
  // 无注音语言紧凑行距（ENG/KOR）
  compactLineHeightBase: 1.25,
  compactZhLineHeightBase: 1.15,
};

/** 根据 profile 返回排版参数 */
export function dimForProfile(profile?: PosterLayoutProfile): FuriganaEngineDim {
  return profile === 'mobilePoster' ? MOBILE_DIM : B5_DIM;
}

/** 根据语言返回行距系数 */
export function getLineHeightScale(language?: LyricsLanguage): number {
  if (language === 'en' || language === 'ko') {
    return 0.85; // 无注音语言使用 85% 的行距
  }
  return 1.0; // 日语默认 100% 行距
}

/** 根据排版管线语言返回行距系数（LangCode 版本，与波轮解耦） */
export function getLineHeightScaleForLang(lang?: LangCode): number {
  if (lang === 'ko' || lang === 'en' || lang === 'zh') {
    return 0.8; // KOR/LATIN 管线：紧凑行距
  }
  return 1.0; // JP 管线：默认行距（含注音需求）
}

/** 判断是否为需要紧凑排版的语音（无注音） */
export function isCompactLayoutLanguage(language?: LyricsLanguage): boolean {
  return language === 'en' || language === 'ko';
}

/** 判断排版管线语言是否需要紧凑排版（无 ruby 注音） */
export function isCompactLayoutLang(lang?: LangCode): boolean {
  return lang !== undefined && lang !== 'jp';
}
