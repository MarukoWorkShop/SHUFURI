import {
  KAMI_GROUP_MB_EM,
  KAMI_LETTER_SPACING_EM,
  KAMI_LINE_HEIGHT,
  KAMI_ZH_LYRICS_LINE_HEIGHT,
} from '../posterTypography/typographyConstants.ts';
import type { FuriganaEngineDim, PosterLayoutProfile } from './types';

/** 通用排版常量 */
export const POSTER_ELASTIC_FONT_BASE_PX = 18;

export {
  KAMI_GROUP_MB_EM,
  KAMI_LETTER_SPACING_EM,
  KAMI_LINE_HEIGHT,
  KAMI_ZH_LYRICS_LINE_HEIGHT,
};

/** 打印排版 B5/A5 纸型：600×852；行距对齐 Kami（与手机版面一致） */
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
  elasticLhBase: KAMI_LINE_HEIGHT,
  titleFontSize: 17,
  titleLineHeightRatio: 1.22,
  titleToBodyGap: 14,
  jpLineHeightBase: KAMI_LINE_HEIGHT,
  zhLineHeightBase: KAMI_ZH_LYRICS_LINE_HEIGHT,
  compactLineHeightBase: KAMI_LINE_HEIGHT,
  compactZhLineHeightBase: KAMI_ZH_LYRICS_LINE_HEIGHT,
};

/** 手机竖屏 1080×1920 — 行距对齐编辑页 Kami 阅读档 */
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
  elasticLhBase: KAMI_LINE_HEIGHT,
  titleFontSize: 56,
  titleLineHeightRatio: 1.2,
  titleToBodyGap: 40,
  // 日语默认行距（含注音需求）— Kami
  jpLineHeightBase: KAMI_LINE_HEIGHT,
  zhLineHeightBase: KAMI_ZH_LYRICS_LINE_HEIGHT,
  // 无注音语言：编辑页同样用 Kami 主行高
  compactLineHeightBase: KAMI_LINE_HEIGHT,
  compactZhLineHeightBase: KAMI_ZH_LYRICS_LINE_HEIGHT,
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

/** 3:4 竖屏 1080×1440（社媒首图）— 参数折中于 square 与 mobile */
export const SOCIAL_DIM: FuriganaEngineDim = {
  profile: 'socialPoster',
  canvasWidth: 1080,
  canvasHeight: 1440,
  padH: 140,
  pagePadTopCont: 84,
  pageBottomDefault: 120,
  textBottomClearance: 48,
  elasticFontBase: 30,
  elasticFontMin: 26,
  elasticLhBase: 1.5,
  titleFontSize: 52,
  titleLineHeightRatio: 1.2,
  titleToBodyGap: 34,
  jpLineHeightBase: 1.5,
  zhLineHeightBase: 1.34,
  compactLineHeightBase: 1.26,
  compactZhLineHeightBase: 1.16,
};

/** 根据 profile 返回排版参数 */
export function dimForProfile(profile?: PosterLayoutProfile): FuriganaEngineDim {
  if (profile === 'mobilePoster') return MOBILE_DIM;
  if (profile === 'squarePoster') return SQUARE_DIM;
  if (profile === 'socialPoster') return SOCIAL_DIM;
  return B5_DIM;
}

/** @alias dimForProfile — 海报引擎维度 */
export const dimForFuriganaPoster = dimForProfile;
