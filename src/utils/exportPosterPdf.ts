import type { PosterLayoutProfile, PosterPageSlice } from './furiganaLayout/types';
import { isNativeWebView, postExportVectorPdf } from './nativeBridge';
import { exportPosterPdfFromPageHtmls, posterPdfExportFilename } from './pdfExport';
import { buildPrintDocumentHtml } from './vectorPrint/buildPrintDocumentHtml';
import { printPageSpec } from './vectorPrint/printPageSpec';

/**
 * 统一 PDF 导出：iOS WebView 内走 expo-print 矢量 HTML；浏览器回退 html2canvas 栅格化。
 */
export async function exportPosterPdf(
  pageSlices: PosterPageSlice[],
  title: string,
  layoutProfile: PosterLayoutProfile,
  artist?: string,
): Promise<void> {
  const baseName = title.trim() || '歌词笔记';
  const filename = posterPdfExportFilename(baseName, layoutProfile);

  if (isNativeWebView()) {
    const html = await buildPrintDocumentHtml(pageSlices, title, layoutProfile, artist);
    const spec = printPageSpec(layoutProfile);
    await postExportVectorPdf({
      html,
      filename,
      pageWidthMm: spec.widthMm,
      pageHeightMm: spec.heightMm,
    });
    return;
  }

  await exportPosterPdfFromPageHtmls(pageSlices, title, layoutProfile, filename, artist);
}
