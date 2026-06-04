/**
 * 海报 PDF / PNG 导出管线（精简版，去 Capacitor / 日记依赖）
 * 基于原 APP posterPdfExport.ts + paperExport.ts 核心逻辑
 */
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ensurePosterFontsLoaded } from './furiganaLayout/fonts';
import type { PosterLayoutProfile, PosterPageSlice } from './furiganaLayout/types';
import { isNativeWebView, postShareImage } from './nativeBridge';
import {
  mountPosterExportPage,
  mountPosterExportPages,
  getPosterExportCanvasSize,
} from './posterExportMount';

/** CSS 像素（96dpi）→ jsPDF 毫米 */
const CSS_PX_TO_MM = 25.4 / 96;

/** html2canvas 栅格倍率（大图自动降采样，避免空白或内存溢出） */
const PDF_HTML2CANVAS_SCALE = 3;
/** JPEG 写入 PDF 时的压缩模式，与 shufu life paperExport 栅格化一致 */
const JPEG_ADD_COMPRESSION: 'FAST' | 'NONE' = 'FAST';
/** JPEG 质量（体积与锐度折中） */
const PDF_JPEG_QUALITY = 0.95;
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

/**
 * 自适应栅格倍率：大尺寸画布（手机 1080×1920）降为 2× 以避免 canvas 超限；
 * B5 打印画布（600×852）使用 3× 高清栅格。
 */
function pickRasterScale(width: number, height: number): number {
  const maxDim = Math.max(width, height);
  if (maxDim > 1500) return 2;
  return PDF_HTML2CANVAS_SCALE;
}

/**
 * html2canvas 选项：
 * 1) windowWidth/windowHeight —— 把 clone iframe 的视口钉到与目标元素同宽同高，防止
 *    fixed 全屏 backdrop 导致 clone 文档视口过大，内部 width:100% / flex 子项被撑宽。
 * 2) width/height —— 强制 canvas 像素尺寸严格等于目标元素 border-box × scale，
 *    禁止 html2canvas 因内部子元素溢出（scrollWidth > offsetWidth）而自动扩展 canvas。
 * 3) 不传入 x/y —— html2canvas 内部会把 opts.x/y 与 clone 元素的 left/top 叠加，
 *    而我们无法精确控制 clone iframe 中元素的绝对坐标，叠加后反而导致偏移或裁剪。
 * 4) 优先使用 data 属性中存储的预期画布尺寸（exportCanvasW/H），避免内容较少的末页
 *    offsetHeight < 预期高度导致 canvas 偏小，PDF 写入时被拉伸。
 */
function buildHtml2CanvasOpts(target: HTMLElement, scale: number): Html2CanvasOpts {
  // 优先使用 shell 上存储的预期尺寸（来自 mountPosterExportPage），fallback 到 offset 尺寸
  const expectedW = target.dataset.exportCanvasW
    ? Math.max(1, parseInt(target.dataset.exportCanvasW, 10))
    : Math.max(1, target.offsetWidth);
  const expectedH = target.dataset.exportCanvasH
    ? Math.max(1, parseInt(target.dataset.exportCanvasH, 10))
    : Math.max(1, target.offsetHeight);
  return {
    scale,
    width: expectedW,
    height: expectedH,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: expectedW,
    windowHeight: expectedH,
  };
}

async function waitForLayoutStable(target: HTMLElement): Promise<void> {
  void target.offsetHeight;
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** 强制把 canvas 裁剪/填充到精确的期望像素尺寸 */
function forceCanvasSize(
  source: HTMLCanvasElement,
  expectedW: number,
  expectedH: number,
): HTMLCanvasElement {
  if (source.width === expectedW && source.height === expectedH) {
    return source;
  }
  const fixed = document.createElement('canvas');
  fixed.width = expectedW;
  fixed.height = expectedH;
  const ctx = fixed.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, expectedW, expectedH);
  // 从 source 左上角裁剪出 expectedW × expectedH，不做任何缩放
  const srcW = Math.min(source.width, expectedW);
  const srcH = Math.min(source.height, expectedH);
  ctx.drawImage(source, 0, 0, srcW, srcH, 0, 0, srcW, srcH);
  return fixed;
}

/** 给任意 Promise 加超时，超时抛出描述性错误 */
function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} 超时（${ms}ms）`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** 长按单页保存：更低倍率，避免 iOS WebView 内存溢出 */
const QUICK_SAVE_RASTERIZE_TIMEOUT_MS = 30_000;
const QUICK_SAVE_JPEG_QUALITY = 0.9;

export type QuickSaveImageOptions = {
  format?: 'jpeg' | 'png';
  jpegQuality?: number;
  /** 是否在栅格化前把离屏 DOM 移入视口（长按保存应 false，避免全屏白屏卡顿感） */
  prepareVisible?: boolean;
  maxScale?: number;
};

/** 长按保存专用栅格倍率：大画布强制 1× */
function pickQuickSaveRasterScale(width: number, height: number): number {
  const pixels = width * height;
  if (pixels >= 1_800_000) return 1;
  if (pixels >= 450_000) return 2;
  return PDF_HTML2CANVAS_SCALE;
}

/** 单页面栅格化超时（毫秒），极端情况 html2canvas 可能挂起 */
const RASTERIZE_PAGE_TIMEOUT_MS = 45_000;

/** 单次 html2canvas 栅格化（强制截取区域等于元素精确尺寸，禁止自动扩展） */
async function rasterizeWithHtml2canvas(
  target: HTMLElement,
  scaleOverride?: number,
  timeoutMs = RASTERIZE_PAGE_TIMEOUT_MS,
): Promise<HTMLCanvasElement> {
  // 使用与 buildHtml2CanvasOpts 一致的预期尺寸来源
  const w = target.dataset.exportCanvasW
    ? Math.max(1, parseInt(target.dataset.exportCanvasW, 10))
    : Math.max(1, target.offsetWidth);
  const h = target.dataset.exportCanvasH
    ? Math.max(1, parseInt(target.dataset.exportCanvasH, 10))
    : Math.max(1, target.offsetHeight);
  const scale = scaleOverride ?? pickRasterScale(w, h);
  const rawCanvas = await withDeadline(
    html2canvas(target, buildHtml2CanvasOpts(target, scale)),
    timeoutMs,
    'html2canvas 栅格化',
  );
  const expectedW = Math.round(w * scale);
  const expectedH = Math.round(h * scale);
  return forceCanvasSize(rawCanvas, expectedW, expectedH);
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: 'image/jpeg' | 'image/png',
  quality: number,
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), mimeType, quality);
  });
  if (!blob) {
    throw new Error('无法生成图片');
  }
  return blob;
}

/** 将单页根节点栅格化为 Canvas（导出 mount 已在离屏 1:1，直接栅格化） */
export async function rasterizePosterLayoutPageRoot(el: HTMLElement): Promise<HTMLCanvasElement> {
  await ensurePosterFontsLoaded();
  await waitForLayoutStable(el);
  await waitForImagesInElement(el);
  await preloadImagesInElementForPdf(el);
  await waitForLayoutStable(el);
  return await withDeadline(
    rasterizeWithHtml2canvas(el),
    RASTERIZE_PAGE_TIMEOUT_MS,
    '整页栅格化',
  );
}

/** 根据排版模式为 PDF 文件名追加 wide / narrow 后缀 */
export function posterPdfExportFilename(baseName: string, layoutProfile: PosterLayoutProfile): string {
  const sizeTag = layoutProfile === 'mobilePoster' ? 'narrow' : 'wide';
  const safeBase = baseName.replace(/[/\\?*:|"]/g, '_').slice(0, 110) || 'poster';
  return `${safeBase}_${sizeTag}`;
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

/** 将栅格 canvas 写入 jsPDF 当前页（与 shufu life 对齐：先 toDataURL 再 addImage） */
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
  const imgData = canvas.toDataURL('image/jpeg', PDF_JPEG_QUALITY);
  pdf.addImage(imgData, 'JPEG', 0, 0, wMm, hMm, undefined, JPEG_ADD_COMPRESSION);
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
  pageSlices: PosterPageSlice[],
  title: string,
  layoutProfile: PosterLayoutProfile,
  filename: string,
  artist?: string,
): Promise<void> {
  if (pageSlices.length === 0) {
    throw new Error('没有可导出的页面');
  }

  const exportFilename = posterPdfExportFilename(filename, layoutProfile);
  const saveHandle = await pickPdfSaveHandle(exportFilename);
  const hasNativePicker = Boolean(
    (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker,
  );
  if (saveHandle === null && hasNativePicker) {
    return;
  }

  await ensurePosterFontsLoaded();
  const mounts = mountPosterExportPages(document, pageSlices, title, layoutProfile, artist);
  const { width, height } = getPosterExportCanvasSize(layoutProfile);

  // 【闪烁修复】在栅格化前才将所有页面的 backdrop 移入可见区域
  for (const mount of mounts) {
    mount.prepare();
  }

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
      await deliverPosterPdfBlob(blob, exportFilename);
    }
  } finally {
    for (const mount of mounts) {
      mount.dispose();
    }
  }
}

/**
 * 将单页 HTML 栅格化为 Blob（用于长按保存等场景，默认 JPEG + 低倍率）。
 */
export async function rasterizePageHtmlToBlob(
  pageHtml: string,
  title: string,
  artist: string | undefined,
  showTitle: boolean,
  pageIndex: number,
  pageCount: number,
  layoutProfile: PosterLayoutProfile,
  spacingScale = 1,
  options: QuickSaveImageOptions = {},
): Promise<{ blob: Blob; mimeType: 'image/jpeg' | 'image/png' }> {
  const format = options.format ?? 'jpeg';
  const jpegQuality = options.jpegQuality ?? QUICK_SAVE_JPEG_QUALITY;
  const prepareVisible = options.prepareVisible ?? false;
  const { width, height } = getPosterExportCanvasSize(layoutProfile);
  const scale = options.maxScale ?? pickQuickSaveRasterScale(width, height);

  await ensurePosterFontsLoaded();
  const mount = mountPosterExportPage(document, {
    title,
    artist,
    showTitle,
    bodyFragmentHtml: pageHtml,
    pageIndex,
    pageCount,
    layoutProfile,
    spacingScale,
  });
  mount.prepare({ visible: prepareVisible });
  try {
    await waitForLayoutStable(mount.root);
    await waitForImagesInElement(mount.root);
    await preloadImagesInElementForPdf(mount.root);
    await waitForLayoutStable(mount.root);
    const canvas = await withDeadline(
      rasterizeWithHtml2canvas(mount.root, scale, QUICK_SAVE_RASTERIZE_TIMEOUT_MS),
      QUICK_SAVE_RASTERIZE_TIMEOUT_MS,
      '长按保存栅格化',
    );
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const blob = await canvasToBlob(
      canvas,
      mimeType,
      format === 'png' ? 1 : jpegQuality,
    );
    return { blob, mimeType };
  } finally {
    mount.dispose();
  }
}

/**
 * 将单页 HTML 栅格化为 data URL（用于长按保存等场景）。
 * 使用离屏挂载 → 1:1 栅格化 → data URL，不影响当前页面 DOM。
 */
export async function rasterizePageHtmlToDataUrl(
  pageHtml: string,
  title: string,
  artist: string | undefined,
  showTitle: boolean,
  pageIndex: number,
  pageCount: number,
  layoutProfile: PosterLayoutProfile,
  spacingScale = 1,
): Promise<string> {
  const { blob } = await rasterizePageHtmlToBlob(
    pageHtml,
    title,
    artist,
    showTitle,
    pageIndex,
    pageCount,
    layoutProfile,
    spacingScale,
    { format: 'jpeg', jpegQuality: QUICK_SAVE_JPEG_QUALITY, prepareVisible: false },
  );
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('无法读取图片'));
    reader.readAsDataURL(blob);
  });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('无法读取图片'));
    reader.readAsDataURL(blob);
  });
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

/** 逐页导出间隙让出主线程，便于 WebView GC 回收大 canvas */
async function yieldBetweenExportPages(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/**
 * 从分页 HTML 导出 PNG（不依赖预览 DOM ref）。
 * App 内：逐页 1× JPEG + 原生分享，避免 html2canvas 2× 多页同时挂载 OOM。
 * 浏览器：逐页 1× PNG 下载。
 */
export async function exportPosterPngFromPageHtmls(
  pageSlices: PosterPageSlice[],
  title: string,
  layoutProfile: PosterLayoutProfile,
  baseFilename: string,
  artist?: string,
): Promise<number> {
  if (pageSlices.length === 0) {
    throw new Error('没有可导出的页面');
  }

  const native = isNativeWebView();
  const safeBase = baseFilename.replace(/[/\\?*:|"]/g, '_').slice(0, 120) || 'poster';
  const trimmedTitle = title.trim() || '歌词笔记';
  const n = pageSlices.length;

  for (let i = 0; i < n; i++) {
    const slice = pageSlices[i]!;
    const { blob, mimeType } = await rasterizePageHtmlToBlob(
      slice.html,
      trimmedTitle,
      artist,
      i === 0,
      i,
      n,
      layoutProfile,
      slice.spacingScale ?? 1,
      {
        format: native ? 'jpeg' : 'png',
        prepareVisible: false,
      },
    );

    const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const downloadName =
      n === 1 ? `${safeBase}.${ext}` : `${safeBase}_${String(i + 1).padStart(2, '0')}.${ext}`;

    if (native) {
      const shareBase = downloadName.replace(/\.(png|jpg)$/i, '');
      await postShareImage({
        dataBase64: await blobToBase64(blob),
        mimeType,
        filename: shareBase,
      });
    } else {
      deliverDownloadBlob(blob, downloadName);
      if (i < n - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 350));
      }
    }

    await yieldBetweenExportPages();
  }

  return n;
}
