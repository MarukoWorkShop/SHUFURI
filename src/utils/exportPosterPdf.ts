import type { PosterLayoutProfile, PosterPageSlice } from './shufuriPoster/types';
import { isNativeWebView, postExportVectorPdf } from './nativeBridge';
import { exportPosterPdfFromPageHtmls, posterPdfExportFilename } from './pdfExport';
import { buildPrintDocumentHtml } from './vectorPrint/buildPrintDocumentHtml';
import { printPageSpec } from './vectorPrint/printPageSpec';
import type { LyricsLanguage, LangCode } from '../services/appSettings';

/**
 * 统一 PDF 导出：iOS WebView 内走 expo-print 矢量 HTML；浏览器回退 html2canvas 栅格化。
 */
export async function exportPosterPdf(
  pages: PosterPageSlice[],
  title: string,
  layoutProfile: PosterLayoutProfile,
  artist?: string,
  language: LyricsLanguage = 'jp',
  lang?: LangCode,
  renderOptions?: import('./shufuriPoster/types').PosterRenderOptions,
): Promise<void> {
  const baseName = title.trim() || '歌词笔记';
  const filename = posterPdfExportFilename(baseName, layoutProfile);

  if (isNativeWebView()) {
    const html = await buildPrintDocumentHtml(
      pages,
      title,
      layoutProfile,
      artist,
      language,
      lang,
      renderOptions,
    );
    const spec = printPageSpec(layoutProfile);
    await postExportVectorPdf({
      html,
      filename,
      pageWidthMm: spec.widthMm,
      pageHeightMm: spec.heightMm,
    });
    return;
  }

  await exportPosterPdfFromPageHtmls(
    pages,
    title,
    layoutProfile,
    filename,
    artist,
    language,
    lang,
    renderOptions,
  );
}
