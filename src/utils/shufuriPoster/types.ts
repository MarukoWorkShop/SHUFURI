/** 排版模式：打印 B5、手机竖屏 9:16、1:1 方形、社媒竖版 3:4 */
export type PosterLayoutProfile = 'clipPosterPrint' | 'mobilePoster' | 'squarePoster' | 'socialPoster';

/** 版式变体：
 * - standard = 经典排版（单栏）
 * - notebook = 笔记本/行间注（单栏，仅 CSS 皮肤）
 * - split    = 分栏（左 65% 歌词 / 右 35% 词解+语法，双独立栏各自分页）
 */
export type PosterLayoutVariant = 'standard' | 'notebook' | 'split';
export const POSTER_LAYOUT_VARIANTS: PosterLayoutVariant[] = ['standard', 'notebook', 'split'];
export const DEFAULT_POSTER_LAYOUT_VARIANT: PosterLayoutVariant = 'standard';

/** 分栏版式左右栏宽度占比（左 65% 歌词 / 右 35% 词解+语法） */
export const SPLIT_LEFT_RATIO = 0.65;
export const SPLIT_RIGHT_RATIO = 0.35;
/** 左右栏间留白（px，按 profile 缩放后的基础值），在 CSS 皮肤中以百分比/固定值体现 */
export const SPLIT_COL_GAP_RATIO = 0.03;

/** 海报渲染/分页选项（注音可见性 + 用户密度倍率 + 背景图 + 版式变体） */
export type PosterRenderOptions = {
  showRuby?: boolean;
  userFontScale?: number;
  userLineHeightScale?: number;
  /** 背景图 ID，对应 src/config/posterBackgrounds.ts；空/undefined 表示纯白背景 */
  backgroundId?: string;
  /** 版式变体（编辑页"版式"），决定排版皮肤 */
  layoutVariant?: PosterLayoutVariant;
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
  backgroundId?: string,
  layoutVariant: PosterLayoutVariant = DEFAULT_POSTER_LAYOUT_VARIANT,
): PosterRenderOptions {
  return {
    showRuby,
    userFontScale: typography.fontScale,
    userLineHeightScale: typography.lineHeightScale,
    backgroundId,
    layoutVariant,
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
