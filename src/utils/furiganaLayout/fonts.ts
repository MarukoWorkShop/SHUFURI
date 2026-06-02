/** 小塚明朝 Pro EL（public/assets/KozMinPro-ExtraLight.otf） */
export const KOZUKA_MINCHO_EL_FAMILY =
  '"Kozuka Mincho Pro EL", "小塚明朝 Pro EL", "Hiragino Mincho ProN", serif';

export const ZH_FONT_FAMILY =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';

export const POSTER_JP_FONT_FACE_CSS = `
@font-face {
  font-family: "Kozuka Mincho Pro EL";
  src: url("/assets/KozMinPro-ExtraLight.otf") format("opentype");
  font-weight: 200;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: "小塚明朝 Pro EL";
  src: url("/assets/KozMinPro-ExtraLight.otf") format("opentype");
  font-weight: 200;
  font-style: normal;
  font-display: block;
}`;

/** 预加载日文字体，供分页测量与导出栅格化前调用 */
export async function ensurePosterJapaneseFontLoaded(): Promise<void> {
  if (!document.fonts?.load) return;
  await Promise.all([
    document.fonts.load('200 16px "Kozuka Mincho Pro EL"'),
    document.fonts.load('200 16px "小塚明朝 Pro EL"'),
    document.fonts.load('200 26px "Kozuka Mincho Pro EL"'),
    document.fonts.load('200 26px "小塚明朝 Pro EL"'),
    document.fonts.load('200 46px "Kozuka Mincho Pro EL"'),
    document.fonts.load('200 46px "小塚明朝 Pro EL"'),
    document.fonts.load('700 46px "Kozuka Mincho Pro EL"'),
    document.fonts.load('700 46px "小塚明朝 Pro EL"'),
    document.fonts.load('200 56px "Kozuka Mincho Pro EL"'),
    document.fonts.load('200 56px "小塚明朝 Pro EL"'),
  ]).catch(() => undefined);
  if (document.fonts.ready) {
    await document.fonts.ready;
  }
}
