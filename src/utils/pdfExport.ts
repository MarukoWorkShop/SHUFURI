/**
 * 海报 PDF / PNG 导出管线（精简版，去 Capacitor / 日记依赖）
 * 基于原 APP posterPdfExport.ts + paperExport.ts 核心逻辑
 */
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ensurePosterJapaneseFontLoaded } from './furiganaLayout/fonts';
import type { PosterLayoutProfile } from './furiganaLayout/types';
import {
  mountPosterExportPages,
  getPosterExportCanvasSize,
} from './posterExportMount';

/** CSS 像素（96dpi）→ jsPDF 毫米 */
const CSS_PX_TO_MM = 25.4 / 96;

/** html2canvas 栅格倍率（大图自动降采样，避免空白或内存溢出） */
const PDF_HTML2CANVAS_SCALE = 3;
const JPEG_ADD_COMPRESSION: 'FAST' | 'NONE' | 'SLOW' = 'NONE';
const MIN_PDF_BYTES = 512;

type Html2CanvasOpts = Parameters<typeof html2canvas>[1];

/** 等待节点内图片加载/解码完成 */
export async function waitForImagesInElement(root: HTMLElement): Promise<void> {
  const imgs = root.querySelectorAll('img');
  await Promise.all(
    Array.from(imgs).map(
      (img) =>
        new Promise<void>((resolve) => {
          const done = () => {
            img.removeEventListener('load', done);
            img.removeEventListener('error', done);
            resolve();
          };
          if (img.complete) {
            void (img.decode?.().catch(() => undefined) ?? Promise.resolve()).finally(() => resolve());
            return;
          }
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }),
    ),
  );
}

/** 将 blob/http 图片 src 转为 data URL，供 html2canvas 稳定栅格化 */
async function srcToDataUrlForPdfRaster(src: string, baseUri: string): Promise<string | null> {
  if (src.startsWith('data:')) return src;
  if (src.startsWith('blob:')) {
    try {
      const r = await fetch(src);
      const blob = await r.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }
  try {
    const abs = new URL(src, baseUri).href;
    const r = await fetch(abs, { mode: 'cors', credentials: 'same-origin' });
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** 导出前预加载图片为 data URL */
export async function preloadImagesInElementForPdf(el: HTMLElement): Promise<void> {
  const imgs = el.querySelectorAll('img');
  const baseUri = el.ownerDocument?.baseURI ?? document.baseURI ?? '';
  await Promise.all(
    Array.from(imgs).map(async (img) => {
      const src = img.getAttribute('src');
      if (!src) return;
      if (!src.startsWith('data:')) {
        const dataUrl = await srcToDataUrlForPdfRaster(src, baseUri);
        if (dataUrl) img.setAttribute('src', dataUrl);
      }
      try {
        await (img.decode?.() ?? Promise.resolve());
      } catch {
        /* ignore */
      }
    }),
  );
}

function pickRasterScale(width: number, height: number): number {
  const maxDim = Math.max(width, height);
  if (maxDim > 1500) return 2;
  if (maxDim > 900) return 2;
  return PDF_HTML2CANVAS_SCALE;
}

function buildHtml2CanvasOpts(
  target: HTMLElement,
  scale: number,
  foreignObjectRendering: boolean,
): Html2CanvasOpts {
  const width = target.offsetWidth || target.getBoundingClientRect().width;
  const height = target.offsetHeight || target.getBoundingClientRect().height;
  return {
    scale,
    width,
    height,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    logging: false,
    foreignObjectRendering,
  };
}

function isCanvasMostlyBlank(canvas: HTMLCanvasElement): boolean {
  if (canvas.width <= 1 || canvas.height <= 1) return true;
  const ctx = canvas.getContext('2d');
  if (!ctx) return true;

  const w = Math.min(48, canvas.width);
  const h = Math.min(48, canvas.height);
  const { data } = ctx.getImageData(0, 0, w, h);
  let nonWhite = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;
    if (a > 8 && (r < 250 || g < 250 || b < 250)) {
      nonWhite += 1;
    }
  }
  return nonWhite < 4;
}

async function waitForLayoutStable(target: HTMLElement): Promise<void> {
  void target.offsetHeight;
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function rasterizeWithHtml2canvas(target: HTMLElement): Promise<HTMLCanvasElement> {
  const width = target.offsetWidth || target.getBoundingClientRect().width;
  const height = target.offsetHeight || target.getBoundingClientRect().height;
  const scale = pickRasterScale(width, height);

  const attempts: Array<{ foreignObjectRendering: boolean }> = [
    { foreignObjectRendering: false },
    { foreignObjectRendering: true },
  ];

  let lastCanvas: HTMLCanvasElement | null = null;

  for (const attempt of attempts) {
    try {
      const canvas = await html2canvas(
        target,
        buildHtml2CanvasOpts(target, scale, attempt.foreignObjectRendering),
      );
      lastCanvas = canvas;
      if (!isCanvasMostlyBlank(canvas)) {
        return canvas;
      }
    } catch {
      /* try next mode */
    }
  }

  if (lastCanvas && !isCanvasMostlyBlank(lastCanvas)) {
    return lastCanvas;
  }

  throw new Error('海报栅格化失败：导出结果为空白，请刷新后重试');
}

/** 将单页根节点栅格化为 Canvas（导出 mount 已在离屏 1:1，直接栅格化） */
export async function rasterizePosterLayoutPageRoot(el: HTMLElement): Promise<HTMLCanvasElement> {
  await ensurePosterJapaneseFontLoaded();
  await waitForLayoutStable(el);
  await waitForImagesInElement(el);
  await preloadImagesInElementForPdf(el);
  await waitForLayoutStable(el);
  return await rasterizeWithHtml2canvas(el);
}

/** Web：触发浏览器下载 PDF Blob */
export async function deliverPosterPdfBlob(blob: Blob, filename: string): Promise<void> {
  const safeName = filename.replace(/[/\\?*:|"]/g, '_').slice(0, 120) || 'poster.pdf';
  const finalName = safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

async function pickPdfSaveHandle(filename: string): Promise<FileSystemFileHandle | null> {
  const picker = (
    window as Window & {
      showSaveFilePicker?: (options: {
        suggestedName?: string;
        types?: Array<{ description?: string; accept: Record<string, string[]> }>;
      }) => Promise<FileSystemFileHandle>;
    }
  ).showSaveFilePicker;
  if (!picker) {
    return null;
  }
  const safeName = filename.replace(/[/\\?*:|"]/g, '_').slice(0, 120) || 'poster';
  try {
    return await picker({
      suggestedName: `${safeName}.pdf`,
      types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return null;
    }
    throw e;
  }
}

async function writeBlobToFileHandle(handle: FileSystemFileHandle, blob: Blob): Promise<void> {
  const buffer = await blob.arrayBuffer();
  if (buffer.byteLength < MIN_PDF_BYTES) {
    throw new Error('PDF 文件无效：生成内容为空');
  }
  const writable = await handle.createWritable();
  await writable.write(buffer);
  await writable.close();
}

function assertValidPdfBlob(blob: Blob): void {
  if (blob.size < MIN_PDF_BYTES) {
    throw new Error('PDF 文件无效：生成内容为空');
  }
}

/** 将栅格 canvas 写入 jsPDF 当前页（避免 toDataURL 大字符串损坏） */
function addCanvasToPdfPage(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  wMm: number,
  hMm: number,
  isFirstPage: boolean,
): void {
  if (!isFirstPage) {
    pdf.addPage([wMm, hMm], hMm >= wMm ? 'portrait' : 'landscape');
  }
  pdf.addImage(canvas, 'JPEG', 0, 0, wMm, hMm, undefined, JPEG_ADD_COMPRESSION);
}

function deliverDownloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

/** 每一页可独立指定栅格尺寸 */
export interface PosterPdfFlatPage {
  pageRoot: HTMLElement;
  canvasWidthPx: number;
  canvasHeightPx: number;
}

/**
 * 将多页离屏根节点按顺序栅格化并写入单一 PDF。
 */
export async function exportPosterLayoutPdfFromFlatPages(
  pages: PosterPdfFlatPage[],
  filename: string,
): Promise<void> {
  if (pages.length === 0) {
    throw new Error('exportPosterLayoutPdfFromFlatPages: no pages');
  }

  const first = pages[0]!;
  const wMm0 = first.canvasWidthPx * CSS_PX_TO_MM;
  const hMm0 = first.canvasHeightPx * CSS_PX_TO_MM;
  const pdf = new jsPDF({
    orientation: hMm0 >= wMm0 ? 'portrait' : 'landscape',
    unit: 'mm',
    format: [wMm0, hMm0],
    hotfixes: ['px_scaling'],
  });

  for (let i = 0; i < pages.length; i++) {
    const { pageRoot, canvasWidthPx, canvasHeightPx } = pages[i]!;
    const wMm = canvasWidthPx * CSS_PX_TO_MM;
    const hMm = canvasHeightPx * CSS_PX_TO_MM;
    const canvas = await rasterizePosterLayoutPageRoot(pageRoot);
    addCanvasToPdfPage(pdf, canvas, wMm, hMm, i === 0);
  }

  const blob = pdf.output('blob') as Blob;
  assertValidPdfBlob(blob);
  await deliverPosterPdfBlob(blob, filename);
}

/**
 * 将已栅格化的画布按顺序写入单一 PDF（不再走 html2canvas）。
 */
export async function exportPosterLayoutPdfFromCanvases(
  pages: Array<{ canvas: HTMLCanvasElement; widthPx: number; heightPx: number }>,
  filename: string,
): Promise<void> {
  if (pages.length === 0) {
    throw new Error('exportPosterLayoutPdfFromCanvases: no pages');
  }
  const first = pages[0]!;
  const wMm0 = first.widthPx * CSS_PX_TO_MM;
  const hMm0 = first.heightPx * CSS_PX_TO_MM;
  const pdf = new jsPDF({
    orientation: hMm0 >= wMm0 ? 'portrait' : 'landscape',
    unit: 'mm',
    format: [wMm0, hMm0],
    hotfixes: ['px_scaling'],
  });

  for (let i = 0; i < pages.length; i++) {
    const { canvas, widthPx, heightPx } = pages[i]!;
    const wMm = widthPx * CSS_PX_TO_MM;
    const hMm = heightPx * CSS_PX_TO_MM;
    addCanvasToPdfPage(pdf, canvas, wMm, hMm, i === 0);
  }

  const blob = pdf.output('blob') as Blob;
  assertValidPdfBlob(blob);
  await deliverPosterPdfBlob(blob, filename);
}

/** 单页 → PNG 下载 */
export async function exportPosterSinglePngFromRoot(
  pageRoot: HTMLElement,
  filename: string,
): Promise<void> {
  const safeName = filename.replace(/[/\\?*:|"]/g, '_').slice(0, 120) || 'poster.png';
  const canvas = await rasterizePosterLayoutPageRoot(pageRoot);
  const blob: Blob | null = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png', 1);
  });
  if (!blob) throw new Error('exportPosterSinglePngFromRoot: toBlob failed');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

/** 多页 → 逐页 PNG 下载 */
export async function exportPosterLayoutPngPages(
  pageRoots: HTMLElement[],
  baseFilename: string,
): Promise<number> {
  if (pageRoots.length === 0) {
    throw new Error('exportPosterLayoutPngPages: no pages');
  }
  const safeBase = baseFilename.replace(/[/\\?*:|"]/g, '_').slice(0, 120) || 'poster';
  const n = pageRoots.length;

  for (let i = 0; i < n; i++) {
    const name = n === 1 ? `${safeBase}.png` : `${safeBase}_${String(i + 1).padStart(2, '0')}.png`;
    await exportPosterSinglePngFromRoot(pageRoots[i]!, name);

    if (i >= n - 1) break;

    const ok = window.confirm(
      `第 ${i + 1} 张已导出。\n\n点击「确定」继续下载第 ${i + 2}/${n} 张；点击「取消」结束。`,
    );
    if (!ok) return i + 1;
  }
  return n;
}

/**
 * 从分页 HTML 导出 PDF（不依赖预览 DOM ref；点击时先弹出保存对话框保留用户手势）
 */
export async function exportPosterPdfFromPageHtmls(
  pageHtmls: string[],
  title: string,
  layoutProfile: PosterLayoutProfile,
  filename: string,
): Promise<void> {
  if (pageHtmls.length === 0) {
    throw new Error('没有可导出的页面');
  }

  const saveHandle = await pickPdfSaveHandle(filename);
  const hasNativePicker = Boolean(
    (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker,
  );
  if (saveHandle === null && hasNativePicker) {
    return;
  }

  await ensurePosterJapaneseFontLoaded();
  const mounts = mountPosterExportPages(document, pageHtmls, title, layoutProfile);
  const { width, height } = getPosterExportCanvasSize(layoutProfile);

  try {
    const flatPages = mounts.map((mount) => ({
      pageRoot: mount.root,
      canvasWidthPx: width,
      canvasHeightPx: height,
    }));

    const first = flatPages[0]!;
    const wMm0 = first.canvasWidthPx * CSS_PX_TO_MM;
    const hMm0 = first.canvasHeightPx * CSS_PX_TO_MM;
    const pdf = new jsPDF({
      orientation: hMm0 >= wMm0 ? 'portrait' : 'landscape',
      unit: 'mm',
      format: [wMm0, hMm0],
      hotfixes: ['px_scaling'],
    });

    for (let i = 0; i < flatPages.length; i++) {
      const { pageRoot, canvasWidthPx, canvasHeightPx } = flatPages[i]!;
      const wMm = canvasWidthPx * CSS_PX_TO_MM;
      const hMm = canvasHeightPx * CSS_PX_TO_MM;
      const canvas = await rasterizePosterLayoutPageRoot(pageRoot);
      addCanvasToPdfPage(pdf, canvas, wMm, hMm, i === 0);
    }

    const blob = pdf.output('blob') as Blob;
    assertValidPdfBlob(blob);
    if (saveHandle) {
      await writeBlobToFileHandle(saveHandle, blob);
    } else {
      await deliverPosterPdfBlob(blob, filename);
    }
  } finally {
    for (const mount of mounts) {
      mount.dispose();
    }
  }
}

/**
 * 从分页 HTML 导出 PNG（不依赖预览 DOM ref）
 */
export async function exportPosterPngFromPageHtmls(
  pageHtmls: string[],
  title: string,
  layoutProfile: PosterLayoutProfile,
  baseFilename: string,
): Promise<number> {
  if (pageHtmls.length === 0) {
    throw new Error('没有可导出的页面');
  }

  await ensurePosterJapaneseFontLoaded();
  const mounts = mountPosterExportPages(document, pageHtmls, title, layoutProfile);
  const safeBase = baseFilename.replace(/[/\\?*:|"]/g, '_').slice(0, 120) || 'poster';
  const n = pageHtmls.length;

  try {
    for (let i = 0; i < n; i++) {
      const name = n === 1 ? `${safeBase}.png` : `${safeBase}_${String(i + 1).padStart(2, '0')}.png`;
      const canvas = await rasterizePosterLayoutPageRoot(mounts[i]!.root);
      const blob: Blob | null = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png', 1);
      });
      if (!blob) {
        throw new Error('PNG 导出失败：无法生成图片');
      }
      deliverDownloadBlob(blob, name);

      if (i >= n - 1) {
        break;
      }

      // 短暂延迟，降低浏览器批量拦截下载的概率，同时避免弹窗打断用户手势链
      await new Promise<void>((resolve) => setTimeout(resolve, 350));
    }
    return n;
  } finally {
    for (const mount of mounts) {
      mount.dispose();
    }
  }
}
