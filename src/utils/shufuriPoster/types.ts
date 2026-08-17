/** 排版模式：打印 B5、手机竖屏 9:16、1:1 方形、社媒竖版 3:4 */
export type PosterLayoutProfile = 'clipPosterPrint' | 'mobilePoster' | 'squarePoster' | 'socialPoster';

/** 海报渲染/分页选项（注音可见性 + 用户密度倍率） */
export type PosterRenderOptions = {
  showRuby?: boolean;
  userFontScale?: number;
  userLineHeightScale?: number;
};

export type PreviewTypography = {
  fontScale: number;
  lineHeightScale: number;
};

/** 导出/分页默认密度；mobilePoster 行距基准已对齐编辑 Kami，页级仍可弹性收紧 */
export const DEFAULT_PREVIEW_TYPOGRAPHY: PreviewTypography = {
  fontScale: 1,
  lineHeightScale: 1,
};

export function buildPosterRenderOptions(
  showRuby: boolean,
  typography: PreviewTypography,
): PosterRenderOptions {
  return {
    showRuby,
    userFontScale: typography.fontScale,
    userLineHeightScale: typography.lineHeightScale,
  };
}

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
