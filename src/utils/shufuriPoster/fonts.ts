/** 小塚明朝 Pro Regular（public/assets/KozMinPro-Regular.otf）— 日文主文 + ruby 注音 */
export const KOZMIN_PRO_REGULAR_FAMILY =
  '"Kozuka Mincho Pro R", "Kozuka Mincho Pro", "Hiragino Mincho ProN", "Source Han Serif SC", "Songti SC", serif';

/** @deprecated 已统一为 KozMin Pro R；保留别名避免旧引用断裂 */
export const KOZUKA_MINCHO_EL_FAMILY = KOZMIN_PRO_REGULAR_FAMILY;

/** 中文 UI / 海报辅助文案 */
export const ZH_FONT_FAMILY =
  '"PingFang SC", "PingFang SC Light", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

/**
 * 中文衬线 / 歌名区汉字
 * 优先随包思源宋体 SC Regular（public/assets/SourceHanSerifSC-Regular.otf），
 * 再回退系统 Songti / SimSun。
 */
export const SOURCE_HAN_SERIF_SC_FAMILY = '"Source Han Serif SC"';

export const ZH_SONGTI_FONT_FAMILY =
  `${SOURCE_HAN_SERIF_SC_FAMILY}, "Songti SC", "STSong", "Songti TC", "SimSun", serif`;

/** 英文海报正文（歌词主文、英译、gloss 词解）— 与日文主文同用 KozMin Pro Regular */
export const EN_FONT_FAMILY = KOZMIN_PRO_REGULAR_FAMILY;

/** 全局 UI：PingFang Light，中英文统一 */
export const UI_FONT_FAMILY = ZH_FONT_FAMILY;

/**
 * 韩文系统无衬线字体栈（供非歌词 UI 场景使用）：
 * macOS: Apple SD Gothic Neo / Windows: Malgun Gothic / Linux: Nanum Gothic
 */
export const KO_FONT_FAMILY_SYSTEM =
  '"Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "Nanum Gothic", sans-serif';

/**
 * 韩文系统衬线字体栈（海报标题 + 主体歌词统一使用）：
 * - 随包 Noto Serif KR 优先（iOS 无系统韩文衬线，必须随包才能保证手机端衬线效果）
 * - 其它系统衬线回退：AppleMyungjo / Batang / Gungsuh / Nanum Myeongjo
 * - 最后才回落 Apple SD Gothic Neo（无衬线，避免再掉进 PingFang）
 */
export const KO_FONT_FAMILY_SYSTEM_SERIF =
  '"Noto Serif KR", "AppleMyungjo", "Apple Myungjo", "Nanum Myeongjo", "Batang", "Gungsuh", "Apple SD Gothic Neo", serif';

/** 向后兼容别名：默认走系统字体栈（零下载） */
export const KO_FONT_FAMILY = KO_FONT_FAMILY_SYSTEM;

/** 韩文海报歌名：汉字优先思源宋体，韩文走系统衬线（与主体歌词统一） */
export const KO_POSTER_TITLE_FONT_FAMILY_SYSTEM =
  `${SOURCE_HAN_SERIF_SC_FAMILY}, "Songti SC", "STSong", "Songti TC", "SimSun", ${KO_FONT_FAMILY_SYSTEM_SERIF}`;
/** 中文海报歌名 */
export const ZH_POSTER_TITLE_FONT_FAMILY = ZH_SONGTI_FONT_FAMILY;

const FONT_LOAD_TIMEOUT_MS = 8000;

/** 与 Vite base:'./' 及 Expo 离线 bundle 一致，避免 file:// 下 /assets 失效 */
export function getPosterJapaneseRegularFontUrl(): string {
  if (typeof window !== 'undefined' && window.location?.href) {
    return new URL('assets/KozMinPro-Regular.otf', window.location.href).href;
  }
  return './assets/KozMinPro-Regular.otf';
}

/** @deprecated 使用 getPosterJapaneseRegularFontUrl */
export function getPosterJapaneseFontUrl(): string {
  return getPosterJapaneseRegularFontUrl();
}

/** 思源宋体 SC Regular URL */
export function getPosterSourceHanSerifScFontUrl(): string {
  if (typeof window !== 'undefined' && window.location?.href) {
    return new URL('assets/SourceHanSerifSC-Regular.otf', window.location.href).href;
  }
  return './assets/SourceHanSerifSC-Regular.otf';
}

/** 海报水印品牌字 — Sansation Regular */
export const SANSATION_FAMILY = '"Sansation", sans-serif';

export function getPosterSansationRegularFontUrl(): string {
  if (typeof window !== 'undefined' && window.location?.href) {
    return new URL('assets/Sansation-Regular.ttf', window.location.href).href;
  }
  return './assets/Sansation-Regular.ttf';
}

export function getPosterSansationFontFaceCss(): string {
  const fontUrl = getPosterSansationRegularFontUrl();
  return `
@font-face {
  font-family: "Sansation";
  src: url("${fontUrl}") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}`;
}

/** 英文字体为系统 PingFang，无需 @font-face 注入 */
export function getPosterEnglishFontFaceCss(): string {
  return '';
}

export function getPosterJapaneseRegularFontFaceCss(): string {
  const fontUrl = getPosterJapaneseRegularFontUrl();
  return `
@font-face {
  font-family: "Kozuka Mincho Pro R";
  src: url("${fontUrl}") format("opentype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}`;
}

/** @deprecated 已无 ExtraLight / Light 分档；等同 getPosterJapaneseRegularFontFaceCss */
export function getPosterJapaneseFontFaceCss(): string {
  return getPosterJapaneseRegularFontFaceCss();
}

/** 屏幕预览：日文字体（仅 KozMin Pro R） */
export function getPosterJapaneseFontsFaceCss(): string {
  return getPosterJapaneseRegularFontFaceCss();
}

/** 思源宋体 SC Regular — 歌名 / 中文衬线 */
export function getPosterSourceHanSerifScFontFaceCss(): string {
  const fontUrl = getPosterSourceHanSerifScFontUrl();
  return `
@font-face {
  font-family: "Source Han Serif SC";
  src: url("${fontUrl}") format("opentype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}`;
}

/** 韩文衬线 Noto Serif KR — 海报韩文歌词 / 标题 / 词汇统一使用 */
export function getPosterKoreanSerifFontFaceCss(): string {
  return `
@font-face {
  font-family: "Noto Serif KR";
  src: url("/assets/fonts/NotoSerifKR-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}`;
}

/** @deprecated 使用 getPosterJapaneseFontsFaceCss() */
export const POSTER_JP_FONT_FACE_CSS = getPosterJapaneseFontsFaceCss();

const POSTER_FONT_FACES_STYLE_ID = 'shufuri-poster-font-faces';

/** 确保文档级注册海报 @font-face（否则 fonts.load 不会真正下载思源宋体） */
export function ensurePosterFontFacesRegistered(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(POSTER_FONT_FACES_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = POSTER_FONT_FACES_STYLE_ID;
  style.textContent =
    getPosterJapaneseFontsFaceCss() +
    getPosterSourceHanSerifScFontFaceCss() +
    getPosterKoreanSerifFontFaceCss() +
    getPosterSansationFontFaceCss();
  document.head.appendChild(style);
}

function loadFontWithTimeout(font: string, text: string, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    document.fonts
      .load(font, text)
      .then(() => {
        clearTimeout(timer);
        resolve();
      })
      .catch(() => {
        clearTimeout(timer);
        resolve();
      });
  });
}

/** 字体加载后等待两帧布局，避免 iOS WebKit 用错误 metrics 分页 */
export function waitForPosterLayoutReady(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/** 预加载日文字体，供分页测量与导出栅格化前调用 */
export async function ensurePosterJapaneseFontLoaded(): Promise<void> {
  if (!document.fonts?.load) return;
  await Promise.all([
    loadFontWithTimeout('400 16px "Kozuka Mincho Pro R"', 'あ', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('400 26px "Kozuka Mincho Pro R"', 'あ', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('400 46px "Kozuka Mincho Pro R"', 'あ', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('400 56px "Kozuka Mincho Pro R"', 'あ', FONT_LOAD_TIMEOUT_MS),
  ]);
}

/** 预加载英文字体（PingFang Light） */
export async function ensurePosterEnglishFontLoaded(): Promise<void> {
  if (!document.fonts?.load) return;
  await Promise.all([
    loadFontWithTimeout('300 16px "PingFang SC"', 'A', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('300 26px "PingFang SC"', 'A', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('300 46px "PingFang SC"', 'A', FONT_LOAD_TIMEOUT_MS),
  ]);
}

/** 预加载思源宋体 SC（歌名汉字） */
export async function ensurePosterSourceHanSerifScFontLoaded(): Promise<void> {
  if (!document.fonts?.load) return;
  await Promise.all([
    loadFontWithTimeout('400 16px "Source Han Serif SC"', '字', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('400 26px "Source Han Serif SC"', '字', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('400 46px "Source Han Serif SC"', '秋樱', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('400 56px "Source Han Serif SC"', '秋樱', FONT_LOAD_TIMEOUT_MS),
  ]);
}

/** 预加载韩文衬线 Noto Serif KR（编辑页 / 学习卡 / 海报韩文统一使用） */
export async function ensurePosterKoreanSerifFontLoaded(): Promise<void> {
  if (!document.fonts?.load) return;
  await Promise.all([
    loadFontWithTimeout('400 16px "Noto Serif KR"', '안녕하세요', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('400 26px "Noto Serif KR"', '사랑', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('400 46px "Noto Serif KR"', '한국어', FONT_LOAD_TIMEOUT_MS),
  ]);
}

let posterFontsLoadPromise: Promise<void> | null = null;

/**
 * 预加载海报所需字体（含思源宋体）。
 * 结果 memoize：导出切比例不应每次再等 8s+。
 * 不 await document.fonts.ready（会等页面上所有字体，测量注入 @font-face 时易反复卡住）。
 */
export async function ensurePosterFontsLoaded(): Promise<void> {
  if (posterFontsLoadPromise) return posterFontsLoadPromise;
  posterFontsLoadPromise = (async () => {
    ensurePosterFontFacesRegistered();
    await Promise.all([
      ensurePosterJapaneseFontLoaded(),
      ensurePosterEnglishFontLoaded(),
      ensurePosterSourceHanSerifScFontLoaded(),
      ensurePosterKoreanSerifFontLoaded(),
    ]);
    await waitForPosterLayoutReady();
  })().catch((err) => {
    posterFontsLoadPromise = null;
    throw err;
  });
  return posterFontsLoadPromise;
}
