import { KOZUKA_MINCHO_EL_FAMILY, KO_FONT_FAMILY, ZH_FONT_FAMILY } from '../furiganaLayout/fonts';

let cachedJpFontFaceCss: string | null = null;
let cachedKoFontFaceCss: string | null = null;
let cachedEnFontFaceCss: string | null = null;

async function loadFontBase64FromGenerated(
  key: 'PRINT_JP_FONT_BASE64_GENERATED' | 'PRINT_KO_FONT_BASE64_GENERATED' | 'PRINT_EN_FONT_BASE64_GENERATED',
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

export async function getPrintJapaneseFontFaceCss(): Promise<string> {
  if (cachedJpFontFaceCss) {
    return cachedJpFontFaceCss;
  }
  const base64 = await loadFontBase64FromGenerated(
    'PRINT_JP_FONT_BASE64_GENERATED',
    'KozMinPro-ExtraLight.otf',
  );
  cachedJpFontFaceCss = `
@font-face {
  font-family: "Kozuka Mincho Pro EL";
  src: url(data:font/otf;base64,${base64}) format("opentype");
  font-weight: 200;
  font-style: normal;
}`;
  return cachedJpFontFaceCss;
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

/** 日文+韩文+英文字体 @font-face，PDF 打印时内嵌 */
export async function getPrintFontFaceCss(): Promise<string> {
  const [jpCss, koCss, enCss] = await Promise.all([
    getPrintJapaneseFontFaceCss(),
    getPrintKoreanFontFaceCss(),
    getPrintEnglishFontFaceCss(),
  ]);
  return `${jpCss}\n${koCss}\n${enCss}`;
}

export { KOZUKA_MINCHO_EL_FAMILY, KO_FONT_FAMILY, ZH_FONT_FAMILY };
