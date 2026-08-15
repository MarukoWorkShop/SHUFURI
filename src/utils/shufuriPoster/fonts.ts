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
 * 韩文系统字体栈（默认/首屏零下载路径）：纯系统韩文字体，不引用 HCR Batang。
 * 用于 posterFontStyle === 'system'（默认）与未指定字体样式时。
 */
export const KO_FONT_FAMILY_SYSTEM =
  '"Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "Nanum Gothic", sans-serif';

/**
 * 韩文排版字体栈（batang 样式）：HCR Batang 衬线为主，系统字体兜底。
 * 仅当用户选择 posterFontStyle === 'batang' 时才使用，且 HCR Batang 二进制字体按需加载。
 */
export const KO_FONT_FAMILY_BATANG =
  '"HCR Batang", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", serif';

/** 向后兼容别名：默认走系统字体栈（零下载） */
export const KO_FONT_FAMILY = KO_FONT_FAMILY_SYSTEM;

/** 韩文海报歌名：汉字优先思源宋体，韩文回退系统字体（默认）/ Batang（batang 样式） */
export const KO_POSTER_TITLE_FONT_FAMILY_SYSTEM = `${ZH_SONGTI_FONT_FAMILY}, ${KO_FONT_FAMILY_SYSTEM}`;
export const KO_POSTER_TITLE_FONT_FAMILY_BATANG = `${ZH_SONGTI_FONT_FAMILY}, ${KO_FONT_FAMILY_BATANG}`;

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

/** 韩文字体 URL */
export function getPosterKoreanFontUrl(): string {
  if (typeof window !== 'undefined' && window.location?.href) {
    return new URL('assets/HCRBatang.ttf', window.location.href).href;
  }
  return './assets/HCRBatang.ttf';
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
  font-display: block;
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
  font-display: block;
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

import type { PosterFontStyle } from './types';

/**
 * 韩文 @font-face 注入。
 * - posterFontStyle === 'batang'：注入 HCR Batang 的 @font-face（二进制字体异步按需加载）。
 * - 'system' / 未指定：返回空（纯系统字体，首屏零下载）。
 */
export function getPosterKoreanFontFaceCss(fontStyle?: PosterFontStyle): string {
  if (fontStyle === 'batang') {
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
  return '';
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
  font-display: block;
}`;
}

/** @deprecated 使用 getPosterJapaneseFontsFaceCss() */
export const POSTER_JP_FONT_FACE_CSS = getPosterJapaneseFontsFaceCss();

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
    loadFontWithTimeout('400 16px "Kozuka Mincho Pro R"', 'あ', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('400 26px "Kozuka Mincho Pro R"', 'あ', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('400 46px "Kozuka Mincho Pro R"', 'あ', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('400 56px "Kozuka Mincho Pro R"', 'あ', FONT_LOAD_TIMEOUT_MS),
  ]);
}

/**
 * 预加载韩文字体，供分页测量与导出栅格化前调用。
 * 仅当 posterFontStyle === 'batang' 时才拉取 HCR Batang（27MB），其余样式零下载。
 */
export async function ensurePosterKoreanFontLoaded(fontStyle?: PosterFontStyle): Promise<void> {
  if (fontStyle !== 'batang') return;
  if (!document.fonts?.load) return;
  await Promise.all([
    loadFontWithTimeout('400 16px "HCR Batang"', '한', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('400 26px "HCR Batang"', '한', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('400 46px "HCR Batang"', '한', FONT_LOAD_TIMEOUT_MS),
    loadFontWithTimeout('400 56px "HCR Batang"', '한', FONT_LOAD_TIMEOUT_MS),
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

/** 字体加载后等待两帧布局，避免 iOS WebKit 用错误 metrics 分页 */
export function waitForPosterLayoutReady(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/** 预加载海报所需字体（含思源宋体，避免歌名回退 PingFang） */
export async function ensurePosterFontsLoaded(fontStyle?: PosterFontStyle): Promise<void> {
  await Promise.all([
    ensurePosterJapaneseFontLoaded(),
    ensurePosterKoreanFontLoaded(fontStyle),
    ensurePosterEnglishFontLoaded(),
    ensurePosterSourceHanSerifScFontLoaded(),
  ]);
  if (document.fonts?.ready) {
    await withTimeout(document.fonts.ready, FONT_LOAD_TIMEOUT_MS);
  }
  await waitForPosterLayoutReady();
}
