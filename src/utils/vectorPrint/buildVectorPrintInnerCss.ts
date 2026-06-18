import type { PosterLayoutProfile } from '../shufuriPoster/types';
import type { LyricsLanguage, LangCode, ColorTheme } from '../../services/appSettings';
import {
  resolvePosterTypography,
  resolveLangFromOptions,
  compilePosterCss,
} from '../posterTypography';
import type { PrintPageSpec } from './printPageSpec';

export type VectorPrintCssOptions = {
  spacingScale?: number;
  language?: LyricsLanguage;
  lang?: LangCode;
  colorTheme?: ColorTheme;
};

/**
 * 打印专用 CSS（mm 单位），与屏幕预览 class 命名一致，供 expo-print / WKWebView 矢量渲染。
 */
export function buildVectorPrintInnerCss(
  profile: PosterLayoutProfile,
  spec: PrintPageSpec,
  options: VectorPrintCssOptions = {},
): string {
  const lang = resolveLangFromOptions(options);
  const resolved = resolvePosterTypography({
    profile,
    lang,
    spacingScale: options.spacingScale,
    colorTheme: options.colorTheme,
    language: options.language,
  });
  return compilePosterCss(resolved, {
    unit: 'mm',
    spec,
    viewMode: 'screen',
    includeFontFaces: false,
  });
}
