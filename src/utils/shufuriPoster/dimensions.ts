import type { FuriganaEngineDim, PosterLayoutProfile } from './types';

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

/** 1:1 方形 1080×1080（社媒 / 高清存图 + 方形 PDF） */
export const SQUARE_DIM: FuriganaEngineDim = {
  profile: 'squarePoster',
  canvasWidth: 1080,
  canvasHeight: 1080,
  padH: 120,
  pagePadTopCont: 72,
  pageBottomDefault: 96,
  textBottomClearance: 36,
  elasticFontBase: 28,
  elasticFontMin: 24,
  elasticLhBase: 1.45,
  titleFontSize: 48,
  titleLineHeightRatio: 1.2,
  titleToBodyGap: 28,
  jpLineHeightBase: 1.45,
  zhLineHeightBase: 1.28,
  compactLineHeightBase: 1.22,
  compactZhLineHeightBase: 1.12,
};

/** 根据 profile 返回排版参数 */
export function dimForProfile(profile?: PosterLayoutProfile): FuriganaEngineDim {
  if (profile === 'mobilePoster') return MOBILE_DIM;
  if (profile === 'squarePoster') return SQUARE_DIM;
  return B5_DIM;
}

/** @alias dimForProfile — 海报引擎维度 */
export const dimForFuriganaPoster = dimForProfile;
