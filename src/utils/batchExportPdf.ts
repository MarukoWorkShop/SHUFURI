/**
 * 歌词本批量导出 PDF
 *
 * 将「我的歌词本」中若干已保存歌词项目合并为一份 PDF，每首歌独立起页。
 * 每首歌使用目标排版尺寸重新走完整分页管线，确保 PDF 所有页面尺寸一致、样式统一。
 *
 * 改造点（对比旧版）：
 *  - 拆分为 renderBatchPdf（只渲染到 jsPDF，单首失败不影响其余）+ deliverBatchPdf（交付）
 *  - renderBatchPdf 支持 existingPdf 续写，用于「重试失败项」
 *  - 通过 onSongStart / onSongDone / onSongError 回调暴露逐首状态，供 UI 打钩/失败提示
 */
import { jsPDF } from 'jspdf';
import type { PosterLayoutProfile, PosterPageSlice } from './shufuriPoster/types';
import { paginateShufuriPosterBodyHtml } from './shufuriPoster/paginateShufuriPosterHtml';
import { ensurePosterFontsLoaded } from './shufuriPoster/fonts';
import type { SavedLyricsProject } from '../services/savedLyricsStore';
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

export type BatchSongStatus = 'pending' | 'rendering' | 'done' | 'failed';

export interface BatchSongResult {
  id: string;
  title: string;
  status: BatchSongStatus;
  error?: string;
  pages: number;
}

export interface RenderBatchPdfOptions {
  targetProfile: PosterLayoutProfile;
  projects: SavedLyricsProject[];
  /** 续写模式：传入上一次 renderBatchPdf 返回的 pdf，失败项会追加到同一文件 */
  existingPdf?: jsPDF;
  onSongStart?: (id: string, title: string) => void;
  onSongDone?: (id: string, pages: number) => void;
  onSongError?: (id: string, title: string, error: string) => void;
}

export interface RenderBatchPdfResult {
  pdf: jsPDF;
  results: BatchSongResult[];
}

function assertValidPdfBlob(blob: Blob): void {
  if (blob.size < MIN_PDF_BYTES) {
    throw new Error('PDF 文件无效：生成内容为空');
  }
}

async function yieldTick(ms = YIELD_GAP_MS): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** 单个项目重新分页后的结果 */
interface ProjectPagination {
  id: string;
  title: string;
  artist?: string;
  slices: PosterPageSlice[];
  lang?: import('../services/appSettings').LangCode;
  titleMarkupHtml?: string;
}

/**
 * 逐首渲染歌词本到 jsPDF，单首失败不影响其余。
 * 不负责交付（下载/分享）—— 调用方在全部完成后用 deliverBatchPdf 交付。
 */
export async function renderBatchPdf(opts: RenderBatchPdfOptions): Promise<RenderBatchPdfResult> {
  const { targetProfile, projects, existingPdf, onSongStart, onSongDone, onSongError } = opts;

  // 确保海报字体已加载（分页测量和栅格化都需要）
  await ensurePosterFontsLoaded();

  const { width: canvasW, height: canvasH } = getPosterExportCanvasSize(targetProfile);
  const wMm = canvasW * CSS_PX_TO_MM;
  const hMm = canvasH * CSS_PX_TO_MM;

  const pdf = existingPdf ?? new jsPDF({
    orientation: hMm >= wMm ? 'portrait' : 'landscape',
    unit: 'mm',
    format: [wMm, hMm],
    hotfixes: ['px_scaling'],
  });

  // 续写时文档已有页，首页也需要 addPage
  let globalPageIndex = existingPdf ? existingPdf.getNumberOfPages() : 0;

  const results: BatchSongResult[] = [];

  for (const proj of projects) {
    const id = proj.id;
    const title = proj.title || '歌词笔记';
    onSongStart?.(id, title);

    let pages: ProjectPagination | null = null;
    try {
      const rawBody = proj.bodyHtml;
      if (!rawBody || rawBody.trim() === '') {
        throw new Error('正文内容为空');
      }
      const slices = paginateShufuriPosterBodyHtml(
        rawBody,
        title,
        targetProfile,
        document,
        proj.artist,
        'jp',
        proj.lang,
        proj.titleMarkupHtml,
      );
      if (!slices.length) {
        throw new Error('分页结果为空');
      }
      pages = { id, title, artist: proj.artist, slices, lang: proj.lang, titleMarkupHtml: proj.titleMarkupHtml };
    } catch (err) {
      const message = err instanceof Error ? err.message : '分页失败';
      onSongError?.(id, title, message);
      results.push({ id, title, status: 'failed', error: message, pages: 0 });
      continue;
    }

    try {
      for (let i = 0; i < pages.slices.length; i++) {
        const slice = pages.slices[i]!;
        const mount = mountPosterExportPage(document, {
          title: pages.title,
          artist: pages.artist,
          showTitle: i === 0,
          bodyFragmentHtml: slice.html,
          pageIndex: i,
          pageCount: pages.slices.length,
          layoutProfile: targetProfile,
          spacingScale: slice.spacingScale ?? 1,
          language: 'jp',
          lang: pages.lang,
        });
        mount.prepare();
        try {
          const canvas = await rasterizePosterLayoutPageRoot(mount.root);
          addCanvasToPdfPage(pdf, canvas, wMm, hMm, globalPageIndex === 0);
          globalPageIndex++;
        } finally {
          mount.dispose();
        }
        if (i < pages.slices.length - 1) {
          await yieldTick();
        }
      }
      onSongDone?.(id, pages.slices.length);
      results.push({ id, title, status: 'done', pages: pages.slices.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : '栅格化失败';
      onSongError?.(id, title, message);
      results.push({ id, title, status: 'failed', error: message, pages: 0 });
    }
  }

  return { pdf, results };
}

/** 把渲染好的 jsPDF 交付给用户（移动端分享 / 桌面端下载）。 */
export async function deliverBatchPdf(pdf: jsPDF, filename: string): Promise<void> {
  const blob = pdf.output('blob') as Blob;
  assertValidPdfBlob(blob);
  await deliverPosterPdfBlob(blob, filename);
}
