import {
  KOZMIN_PRO_REGULAR_FAMILY,
  KO_FONT_FAMILY,
  ZH_FONT_FAMILY,
  SOURCE_HAN_SERIF_SC_FAMILY,
} from '../shufuriPoster/fonts';
import type { PosterFontStyle } from '../shufuriPoster/types';

let cachedJpRegularFontFaceCss: string | null = null;
let cachedKoFontFaceCss: string | null = null;
let cachedEnFontFaceCss: string | null = null;
let cachedZhSerifFontFaceCss: string | null = null;

async function fetchAssetFontBase64(assetName: string): Promise<string> {
  const fontUrl = new URL(`assets/${assetName}`, window.location.href).href;
  const resp = await fetch(fontUrl);
  if (!resp.ok) {
    throw new Error(`无法加载字体文件：${assetName}`);
  }
  const buf = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

async function loadFontBase64FromGenerated(
  key:
    | 'PRINT_JP_REGULAR_FONT_BASE64_GENERATED'
    | 'PRINT_KO_FONT_BASE64_GENERATED'
    | 'PRINT_EN_FONT_BASE64_GENERATED',
  assetName: string,
): Promise<string> {
  try {
    const mod = await import('./printFontBase64.generated');
    const value = mod[key];
    if (value) {
      return value;
    }
  } catch {
    // generated module may be absent in dev
  }
  return fetchAssetFontBase64(assetName);
}

export async function getPrintJapaneseRegularFontFaceCss(): Promise<string> {
  if (cachedJpRegularFontFaceCss) {
    return cachedJpRegularFontFaceCss;
  }
  const base64 = await loadFontBase64FromGenerated(
    'PRINT_JP_REGULAR_FONT_BASE64_GENERATED',
    'KozMinPro-Regular.otf',
  );
  cachedJpRegularFontFaceCss = `
@font-face {
  font-family: "Kozuka Mincho Pro R";
  src: url(data:font/otf;base64,${base64}) format("opentype");
  font-weight: 400;
  font-style: normal;
}`;
  return cachedJpRegularFontFaceCss;
}

/** @deprecated 已统一为 R；等同 getPrintJapaneseRegularFontFaceCss */
export async function getPrintJapaneseFontFaceCss(): Promise<string> {
  return getPrintJapaneseRegularFontFaceCss();
}

export async function getPrintKoreanFontFaceCss(): Promise<string> {
  if (cachedKoFontFaceCss) {
    return cachedKoFontFaceCss;
  }
  const base64 = await loadFontBase64FromGenerated(
    'PRINT_KO_FONT_BASE64_GENERATED',
    'HCRBatang.ttf',
  );
  cachedKoFontFaceCss = `
@font-face {
  font-family: "HCR Batang";
  src: url(data:font/truetype;base64,${base64}) format("truetype");
  font-weight: 400;
  font-style: normal;
}`;
  return cachedKoFontFaceCss;
}

export async function getPrintEnglishFontFaceCss(): Promise<string> {
  if (cachedEnFontFaceCss) {
    return cachedEnFontFaceCss;
  }
  const base64 = await loadFontBase64FromGenerated(
    'PRINT_EN_FONT_BASE64_GENERATED',
    'Sansation-Light.ttf',
  );
  cachedEnFontFaceCss = `
@font-face {
  font-family: "Sansation Light";
  src: url(data:font/truetype;base64,${base64}) format("truetype");
  font-weight: 300;
  font-style: normal;
}`;
  return cachedEnFontFaceCss;
}

let cachedSansationRegularFontFaceCss: string | null = null;

/** 海报水印页码 / 品牌名 — Sansation Regular */
export async function getPrintSansationRegularFontFaceCss(): Promise<string> {
  if (cachedSansationRegularFontFaceCss) {
    return cachedSansationRegularFontFaceCss;
  }
  const base64 = await fetchAssetFontBase64('Sansation-Regular.ttf');
  cachedSansationRegularFontFaceCss = `
@font-face {
  font-family: "Sansation";
  src: url(data:font/truetype;base64,${base64}) format("truetype");
  font-weight: 400;
  font-style: normal;
}`;
  return cachedSansationRegularFontFaceCss;
}

/** 思源宋体约 23MB，不打进 printFontBase64.generated，导出时按需 fetch */
export async function getPrintSourceHanSerifScFontFaceCss(): Promise<string> {
  if (cachedZhSerifFontFaceCss) {
    return cachedZhSerifFontFaceCss;
  }
  const base64 = await fetchAssetFontBase64('SourceHanSerifSC-Regular.otf');
  cachedZhSerifFontFaceCss = `
@font-face {
  font-family: "Source Han Serif SC";
  src: url(data:font/otf;base64,${base64}) format("opentype");
  font-weight: 400;
  font-style: normal;
}`;
  return cachedZhSerifFontFaceCss;
}

/** 日文+韩文+英文+思源宋体+Sansation Regular @font-face，PDF 打印时内嵌 */
export async function getPrintFontFaceCss(
  posterFontStyle: PosterFontStyle = 'system',
): Promise<string> {
  // system 模式：韩文走系统衬线，跳过 27MB 的 HCR Batang @font-face（零下载）。
  // batang 模式：注入 HCR Batang @font-face 供矢量打印使用。
  const koPromise =
    posterFontStyle === 'batang'
      ? getPrintKoreanFontFaceCss()
      : Promise.resolve('');
  const [jpRegular, koCss, enCss, zhSerifCss, sansationCss] = await Promise.all([
    getPrintJapaneseRegularFontFaceCss(),
    koPromise,
    getPrintEnglishFontFaceCss(),
    getPrintSourceHanSerifScFontFaceCss(),
    getPrintSansationRegularFontFaceCss(),
  ]);
  return `${jpRegular}\n${koCss}\n${enCss}\n${zhSerifCss}\n${sansationCss}`;
}

export {
  KOZMIN_PRO_REGULAR_FAMILY,
  KO_FONT_FAMILY,
  ZH_FONT_FAMILY,
  SOURCE_HAN_SERIF_SC_FAMILY,
};
