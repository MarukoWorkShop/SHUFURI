import type { PosterLayoutProfile } from '../furiganaLayout/types';
import { B5_DIM, MOBILE_DIM } from '../furiganaLayout/dimensions';

export type PrintPageSpec = {
  widthMm: number;
  heightMm: number;
  pageSizeCss: string;
  canvasWidth: number;
  canvasHeight: number;
  padTopMm: number;
  padRightMm: number;
  padBottomMm: number;
  padLeftMm: number;
};

function dimToSpec(
  widthMm: number,
  heightMm: number,
  dim: typeof B5_DIM,
): PrintPageSpec {
  const scaleW = widthMm / dim.canvasWidth;
  const scaleH = heightMm / dim.canvasHeight;
  return {
    widthMm,
    heightMm,
    pageSizeCss: `${widthMm}mm ${heightMm}mm`,
    canvasWidth: dim.canvasWidth,
    canvasHeight: dim.canvasHeight,
    padTopMm: dim.pagePadTopCont * scaleH,
    padRightMm: dim.padH * scaleW,
    padBottomMm: dim.pageBottomDefault * scaleH,
    padLeftMm: dim.padH * scaleW,
  };
}

export function printPageSpec(profile: PosterLayoutProfile): PrintPageSpec {
  if (profile === 'mobilePoster') {
    return dimToSpec(95, 171, MOBILE_DIM);
  }
  return dimToSpec(176, 250, B5_DIM);
}

/** 将预览画布 px 换算为打印 mm（按页宽比例） */
export function pxToMm(px: number, spec: PrintPageSpec): number {
  return (px / spec.canvasWidth) * spec.widthMm;
}

export function mm(n: number): string {
  return `${n.toFixed(3)}mm`;
}
