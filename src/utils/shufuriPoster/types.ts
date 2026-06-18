/** 排版模式：打印 B5、手机竖屏 9:16、或 1:1 方形 */
export type PosterLayoutProfile = 'clipPosterPrint' | 'mobilePoster' | 'squarePoster';

/** 分页结果：正文 HTML 片段 + 可选防孤行行距缩放 */
export type PosterPageSlice = {
  html: string;
  spacingScale: number;
};

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
  // 日语默认行距（含注音需求）
  jpLineHeightBase?: number;
  zhLineHeightBase?: number;
  // 无注音语言紧凑行距（ENG/KOR）
  compactLineHeightBase?: number;
  compactZhLineHeightBase?: number;
}

/** shufuriPoster 规范命名 */
export type ShufuriPosterEngineDim = FuriganaEngineDim;
