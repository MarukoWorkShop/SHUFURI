/** 海报正文基准字号（elasticFontBase 缩放前） */
export const BASE_MAIN_PX = 26;
export const BASE_AUX_PX = 18;
export const BASE_SECTION_TITLE_PX = 18;

/**
 * 日语导出页字号层级（相对 POSTER_ELASTIC_FONT_BASE_PX=18 的设计基准，随 elasticFontBase 缩放）
 * 主文 24 / 译文 14.4 / 组间距 18（略收束，避免组间过空）
 */
export const JP_LYRIC_MAIN_BASE_PX = 24;
export const JP_LYRIC_AUX_BASE_PX = 14.4;
export const JP_LYRIC_GROUP_GAP_BASE_PX = 18;
/** 组间距相对主文：18 / 24 = 0.75em（打印 mm 路径按 mainPx 换算） */
export const JP_LYRIC_GROUP_GAP_EM = JP_LYRIC_GROUP_GAP_BASE_PX / JP_LYRIC_MAIN_BASE_PX;
/**
 * 假名相对汉字的垂直间距（rt 的 padding-bottom，em 相对 rt 字号）。
 * WebKit/Chromium 下可把注音顶离汉字；配合 JP_LYRIC_LINE_HEIGHT 避免行间碰撞。
 */
export const JP_RUBY_BASE_GAP_EM = 0.28;
/** 日语歌词行高（略宽于 Kami 1.52，给假名留空） */
export const JP_LYRIC_LINE_HEIGHT = 1.72;

/**
 * Kami 阅读档（编辑页宽行距）。
 * mobilePoster / clipPosterPrint（拨轮「A5」纸型）共用；页级仍可通过 spacingScale（≥0.85）弹性收紧。
 */
export const KAMI_LINE_HEIGHT = 1.52;
/** 译文 / gloss 行高（编辑页原 1.5） */
export const KAMI_ZH_LYRICS_LINE_HEIGHT = 1.5;
/** 歌词组间距 em（mobilePoster；日语导出见 JP_LYRIC_GROUP_GAP_EM） */
export const KAMI_GROUP_MB_EM = 1.7;
/** 正文字距（mobilePoster，spacingScale=1 时） */
export const KAMI_LETTER_SPACING_EM = 0.06;

/** 中文主文相对 mainPx 的比例（1 = 与日文主文同字号） */
export const ZH_OPTICAL_SCALE = 1;

/** 歌词行字重 — 全语言统一 */
export const LYRIC_PRIMARY_WEIGHT = 400;
/** 译文 / gloss 默认轻字重 */
export const LYRIC_SECONDARY_WEIGHT = 300;
/** 日语歌中文译文字重（与主文同重；字号仍用 JP_LYRIC_AUX） */
export const JP_ZH_LINE_WEIGHT = 400;

/** 辅助文案 / 标题轻字重 */
export const AUX_WEIGHT = 300;

/** 日文 ruby 注音层（工具层；略深于 #aaa，保证可读） */
export const JP_RUBY_WEIGHT = 400;
export const JP_RUBY_COLOR = '#888';
/** 假名相对主文比例（修改前原值；手机竖屏约主文×0.54） */
export const JP_RUBY_RT_EM_MOBILE = 0.54;
export const JP_RUBY_RT_EM_PRINT = 0.58;
/** @deprecated 等同 JP_RUBY_RT_EM_MOBILE；保留以免旧引用断裂 */
export const JP_RUBY_RT_EM = JP_RUBY_RT_EM_MOBILE;

/** 中文拼音注音字号：比日文振假名大一档，提升可读性 */
export const ZH_RUBY_RT_EM_MOBILE = 0.62;
export const ZH_RUBY_RT_EM_PRINT = 0.66;
/** 中文拼音颜色（深石板灰） */
export const ZH_RUBY_COLOR = '#454f5f';

/** 韩文 @font-face 匹配字重 */
export const KO_PRIMARY_WEIGHT = 400;

/** 词汇/语法强调色（替代粗体） */
export const VOCAB_EMPHASIS_COLOR = '#1e3a5f';

/** 中文 gloss 辅文色 */
export const GLOSS_COLOR = '#64748b';
/** 艺术家 / 歌手颜色（与 gloss 同色阶） */
export const ARTIST_TEXT_COLOR = '#64748b';

/** —— 海报全局颜色常量 —— */

/** 正文色（日/中/韩歌词行、例句） */
export const BODY_TEXT_COLOR = '#0a0a0a';
/** 海报标题色 */
export const TITLE_TEXT_COLOR = '#111827';
/** 章节标题色（"重点词汇""重点语法"） */
export const SECTION_TITLE_COLOR = '#1e293b';
/** 占位符（空歌名/歌手） */
export const PLACEHOLDER_COLOR = '#cbd5e1';
/** 分隔线色 */
export const SEPARATOR_COLOR = '#e0e0e0';
/** 海报 / 打印页白色背景 */
export const POSTER_BG_COLOR = '#ffffff';
/** 页码 / 水印颜色（旧右下角页码用；水印见 posterWatermark） */
export const PAGE_NUMBER_TEXT_COLOR = '#94a3b8';

/** 中文词汇条目间距 em */
export const ZH_VOCAB_ITEM_MB_EM = 0.55;
export const CN_RUBY_GAP_EM = 0.06;

/** 语法三角指示器尺寸 px（LanguageWheel 同比例） */
export const LANG_WHEEL_INDICATOR_LEG_PX = 4.8;
export const LANG_WHEEL_INDICATOR_BASE_PX = 5.6;
