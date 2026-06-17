/** 小塚明朝 Pro EL（public/assets/KozMinPro-ExtraLight.otf） */
export const KOZUKA_MINCHO_EL_FAMILY =
  '"Kozuka Mincho Pro EL", "Hiragino Mincho ProN", serif';

/** 中文 UI / 海报辅助文案 */
export const ZH_FONT_FAMILY =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';

/** 英文 / 拉丁正文（系统 Sansation Light，@font-face 兜底） */
export const EN_FONT_FAMILY = '"Sansation Light", system-ui, sans-serif';

/** 全局 UI：拉丁优先 Sansation Light，中文回退 PingFang */
export const UI_FONT_FAMILY = `"Sansation Light", ${ZH_FONT_FAMILY}`;

/** 韩文排版字体（HCR Batang 为主，Apple SD Gothic Neo 等系统字体兜底） */
export const KO_FONT_FAMILY =
  '"HCR Batang", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", serif';

const FONT_LOAD_TIMEOUT_MS = 8000;

/** 与 Vite base:'./' 及 Expo 离线 bundle 一致，避免 file:// 下 /assets 失效 */
export function getPosterJapaneseFontUrl(): string {
  if (typeof window !== 'undefined' && window.location?.href) {
    return new URL('assets/KozMinPro-ExtraLight.otf', window.location.href).href;
  }
  return './assets/KozMinPro-ExtraLight.otf';
}

/** 韩文字体 URL */
export function getPosterKoreanFontUrl(): string {
  if (typeof window !== 'undefined' && window.location?.href) {
    return new URL('assets/HCRBatang.ttf', window.location.href).href;
  }
  return './assets/HCRBatang.ttf';
}

/** 英文字体 URL（Sansation Light，系统已安装时 @font-face 作离线兜底） */
export function getPosterEnglishFontUrl(): string {
  if (typeof window !== 'undefined' && window.location?.href) {
    return new URL('assets/Sansation-Light.ttf', window.location.href).href;
  }
  return './assets/Sansation-Light.ttf';
}

export function getPosterJapaneseFontFaceCss(): string {
  const fontUrl = getPosterJapaneseFontUrl();
  return `
@font-face {
  font-family: "Kozuka Mincho Pro EL";
  src: url("${fontUrl}") format("opentype");
  font-weight: 200;
  font-style: normal;
  font-display: block;
}`;
}

export function getPosterKoreanFontFaceCss(): string {
  const fontUrl = getPosterKoreanFontUrl();
  return `
@font-face {
  font-family: "HCR Batang";
  src: url("${fontUrl}") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: block;
}`;
}

export function getPosterEnglishFontFaceCss(): string {
  const fontUrl = getPosterEnglishFontUrl();
  return `
@font-face {
  font-family: "Sansation Light";
  src: url("${fontUrl}") format("truetype");
  font-weight: 300;
  font-style: normal;
  font-display: block;
}`;
}

/** @deprecated 使用 getPosterJapaneseFontFaceCss() */
export const POSTER_JP_FONT_FACE_CSS = getPosterJapaneseFontFaceCss();

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

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | void> {
  return new Promise<T | void>((resolve) => {
    const timer = setTimeout(() => {
      resolve();
    }, ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve();
      });
  });
}

/** 预加载日文字体，供分页测量与导出栅格化前调用 */
export async function ensurePosterJapaneseFontLoaded(): Promise<void> {
  if (!document.fonts?.load) return;
  await Promise.all([
    loadFontWithTimeout('200 16px "Kozuka Mincho Pro EL"', 'あ', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('200 26px "Kozuka Mincho Pro EL"', 'あ', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('200 46px "Kozuka Mincho Pro EL"', 'あ', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('700 46px "Kozuka Mincho Pro EL"', 'あ', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('200 56px "Kozuka Mincho Pro EL"', 'あ', FONT_LOAD_TIMEOUT_MS),
  ]);
}

/** 预加载韩文字体，供分页测量与导出栅格化前调用 */
export async function ensurePosterKoreanFontLoaded(): Promise<void> {
  if (!document.fonts?.load) return;
  await Promise.all([
    loadFontWithTimeout('400 16px "HCR Batang"', '한', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('400 26px "HCR Batang"', '한', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('400 46px "HCR Batang"', '한', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('400 56px "HCR Batang"', '한', FONT_LOAD_TIMEOUT_MS),
  ]);
}

/** 预加载英文字体（Sansation Light） */
export async function ensurePosterEnglishFontLoaded(): Promise<void> {
  if (!document.fonts?.load) return;
  await Promise.all([
    loadFontWithTimeout('300 16px "Sansation Light"', 'A', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('300 26px "Sansation Light"', 'A', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('300 46px "Sansation Light"', 'A', FONT_LOAD_TIMEOUT_MS),
  ]);
}

/** 字体加载后等待两帧布局，避免 iOS WebKit 用错误 metrics 分页 */
export function waitForPosterLayoutReady(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/** 预加载海报所需的日文+韩文+英文字体（中文使用系统 PingFang SC） */
export async function ensurePosterFontsLoaded(): Promise<void> {
  await Promise.all([
    ensurePosterJapaneseFontLoaded(),
    ensurePosterKoreanFontLoaded(),
    ensurePosterEnglishFontLoaded(),
  ]);
  if (document.fonts?.ready) {
    await withTimeout(document.fonts.ready, FONT_LOAD_TIMEOUT_MS);
  }
  await waitForPosterLayoutReady();
}
