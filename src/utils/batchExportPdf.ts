/**
 * 歌词本批量导出 PDF
 *
 * 将「我的歌词本」中所有已保存歌词项目合并为一份 PDF，
 * 每首歌独立起页。每首歌使用目标排版尺寸重新走完整分页管线，
 * 确保 PDF 所有页面尺寸一致、样式统一。
 */
import { jsPDF } from 'jspdf';
import type { PosterLayoutProfile, PosterPageSlice } from './shufuriPoster/types';
import { paginateShufuriPosterBodyHtml } from './shufuriPoster/paginateShufuriPosterHtml';
import { ensurePosterFontsLoaded } from './shufuriPoster/fonts';
import { listSavedLyricsProjects } from '../services/savedLyricsStore';
import {
  mountPosterExportPage,
  getPosterExportCanvasSize,
} from './posterExportMount';
import {
  addCanvasToPdfPage,
  rasterizePosterLayoutPageRoot,
  deliverPosterPdfBlob,
} from './pdfExport';

const CSS_PX_TO_MM = 25.4 / 96;
const MIN_PDF_BYTES = 512;
const YIELD_GAP_MS = 80;

/** 批量导出进度回调 */
export type BatchExportProgress = {
  current: number;
  total: number;
  projectTitle: string;
  phase: 'rasterizing' | 'done';
};

function assertValidPdfBlob(blob: Blob): void {
  if (blob.size < MIN_PDF_BYTES) {
    throw new Error('PDF 文件无效：生成内容为空');
  }
}

async function yieldTick(ms = YIELD_GAP_MS): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** 一个项目重新分页后的结果 */
interface ProjectPagination {
  title: string;
  artist?: string;
  slices: PosterPageSlice[];
  lang?: import('../services/appSettings').LangCode;
}

/**
 * 执行全量批量导出。
 *
 * 每首歌通过 paginateShufuriPosterBodyHtml 重新走完整排版管线，
 * 使用统一的 targetProfile，确保所有页尺寸一致。
 *
 * @param targetProfile  用户选择的导出尺寸
 * @param onProgress     页面粒度进度回调
 */
export async function executeBatchExport(
  targetProfile: PosterLayoutProfile,
  onProgress?: (p: BatchExportProgress) => void,
): Promise<void> {
  // 1. 加载所有项目
  const projects = await listSavedLyricsProjects();

  if (projects.length === 0) {
    throw new Error('歌词本为空，无可导出内容');
  }

  // 2. 确保海报字体已加载（分页测量和栅格化都需要）
  await ensurePosterFontsLoaded();

  // 3. 逐项目重新走排版管线
  const projectPages: ProjectPagination[] = [];

  for (const proj of projects) {
    const rawBody = proj.bodyHtml;
    if (!rawBody || rawBody.trim() === '') continue;

    // 使用目标 profile 重新分页 —— 而不是复用保存时的 pageHtmls
    const slices = paginateShufuriPosterBodyHtml(
      rawBody,
      proj.title || '歌词笔记',
      targetProfile,
      document,
      proj.artist,
      'jp',
      proj.lang,
      proj.titleMarkupHtml,
    );

    if (slices.length > 0) {
      projectPages.push({
        title: proj.title || '歌词笔记',
        artist: proj.artist,
        slices,
        lang: proj.lang,
      });
    }
  }

  if (projectPages.length === 0) {
    throw new Error('所有项目均无有效内容');
  }

  // 4. 计算总页数（用于进度条）
  const totalPages = projectPages.reduce((sum, pp) => sum + pp.slices.length, 0);

  // 5. 创建 PDF —— 统一使用 targetProfile 尺寸
  const { width: canvasW, height: canvasH } =
    getPosterExportCanvasSize(targetProfile);
  const wMm = canvasW * CSS_PX_TO_MM;
  const hMm = canvasH * CSS_PX_TO_MM;

  const pdf = new jsPDF({
    orientation: hMm >= wMm ? 'portrait' : 'landscape',
    unit: 'mm',
    format: [wMm, hMm],
    hotfixes: ['px_scaling'],
  });

  // 6. 逐页栅格化 → PDF（统一用 targetProfile）
  let globalPageIndex = 0;
  let doneCount = 0;

  for (const pp of projectPages) {
    for (let i = 0; i < pp.slices.length; i++) {
      const slice = pp.slices[i]!;

      onProgress?.({
        current: doneCount + 1,
        total: totalPages,
        projectTitle: pp.title,
        phase: 'rasterizing',
      });

      const mount = mountPosterExportPage(document, {
        title: pp.title,
        artist: pp.artist,
        showTitle: i === 0,
        bodyFragmentHtml: slice.html,
        pageIndex: i,
        pageCount: pp.slices.length,
        layoutProfile: targetProfile,
        spacingScale: slice.spacingScale ?? 1,
        language: 'jp',
        lang: pp.lang,
      });

      mount.prepare();

      try {
        const canvas = await rasterizePosterLayoutPageRoot(mount.root);
        addCanvasToPdfPage(pdf, canvas, wMm, hMm, globalPageIndex === 0);
        globalPageIndex++;
        doneCount++;
      } finally {
        mount.dispose();
      }

      // 页面间 yield，让 GC 喘气
      if (doneCount < totalPages) {
        await yieldTick();
      }
    }
  }

  // 7. 输出
  const blob = pdf.output('blob') as Blob;
  assertValidPdfBlob(blob);

  const filename = `shufuri-lyrics-batch-${projects.length}-songs.pdf`;
  await deliverPosterPdfBlob(blob, filename);

  onProgress?.({
    current: totalPages,
    total: totalPages,
    projectTitle: '',
    phase: 'done',
  });
}
