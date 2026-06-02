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
};

export function dimForProfile(profile?: PosterLayoutProfile): FuriganaEngineDim {
  return profile === 'mobilePoster' ? MOBILE_DIM : B5_DIM;
}
