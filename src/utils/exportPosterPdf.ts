import type { PosterLayoutProfile, PosterPageSlice } from './shufuriPoster/types';
import { exportPosterPdfFromPageHtmls, posterPdfExportFilename } from './pdfExport';
import type { LyricsLanguage, LangCode } from '../services/appSettings';

/**
 * 统一 PDF 导出：浏览器与 Capacitor 均走逐页离屏挂载 + html2canvas 栅格化 + 多页 jsPDF。
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
