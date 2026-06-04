import { KOZUKA_MINCHO_EL_FAMILY, ZH_FONT_FAMILY } from '../furiganaLayout/fonts';

let cachedJpFontFaceCss: string | null = null;

async function loadFontBase64FromGenerated(
  key: 'PRINT_JP_FONT_BASE64_GENERATED',
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

/** 中文使用系统 PingFang SC，PDF 无需内嵌 @font-face */
export async function getPrintFontFaceCss(): Promise<string> {
  return getPrintJapaneseFontFaceCss();
}

export { KOZUKA_MINCHO_EL_FAMILY, ZH_FONT_FAMILY };
