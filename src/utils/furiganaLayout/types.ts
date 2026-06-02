/** 排版模式：打印 B5 或手机竖屏 9:16 */
export type PosterLayoutProfile = 'clipPosterPrint' | 'mobilePoster';

/** 假名排版引擎维度参数（精简版，仅含假名管线需要的字段） */
export interface FuriganaEngineDim {
  profile: PosterLayoutProfile;
  canvasWidth: number;
  canvasHeight: number;
  padH: number;
  pagePadTopCont: number;
  pageBottomDefault: number;
  textBottomClearance: number;
  elasticFontBase: number;
  elasticFontMin: number;
  elasticLhBase: number;
  titleFontSize: number;
  titleLineHeightRatio: number;
  titleToBodyGap: number;
}
