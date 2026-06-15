/**
 * Capacitor 原生桥接层
 *
 * 替换原有的 Expo RN WebView 桥接，使用 Capacitor 插件直接调用原生能力。
 * 保持原有 API 接口签名不变，确保消费者文件无需改动。
 */

import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { App } from '@capacitor/app';
import SaveToGallery from '../bridge/saveToGalleryPlugin';
import type { GalleryPermissionStatus } from '../bridge/saveToGalleryPlugin';

// ---- 类型（保持原有对外接口） ----------------------------------------------

export type ExportVectorPdfPayload = {
  type: 'EXPORT_VECTOR_PDF';
  requestId: string;
  html: string;
  filename: string;
  pageWidthMm: number;
  pageHeightMm: number;
};

export type ClipboardWritePayload = {
  type: 'CLIPBOARD_WRITE';
  requestId: string;
  text: string;
};

export type ClipboardReadPayload = {
  type: 'CLIPBOARD_READ';
  requestId: string;
};

export type ShareImagePayload = {
  type: 'SHARE_IMAGE';
  requestId: string;
  dataBase64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/svg+xml';
  filename: string;
};

export type SaveImageToLibraryPayload = {
  type: 'SAVE_IMAGE_TO_LIBRARY';
  requestId: string;
  dataBase64: string;
  mimeType: 'image/jpeg' | 'image/png';
  filename: string;
};

export type NativeBridgeResponse =
  | { type: 'APP_BECAME_ACTIVE' }
  | { type: 'EXPORT_VECTOR_PDF_DONE'; requestId: string }
  | { type: 'EXPORT_VECTOR_PDF_ERROR'; requestId: string; message: string }
  | { type: 'CLIPBOARD_WRITE_DONE'; requestId: string }
  | { type: 'CLIPBOARD_WRITE_ERROR'; requestId: string; message: string }
  | { type: 'CLIPBOARD_READ_DONE'; requestId: string; text: string }
  | { type: 'CLIPBOARD_READ_ERROR'; requestId: string; message: string }
  | { type: 'SHARE_IMAGE_DONE'; requestId: string }
  | { type: 'SHARE_IMAGE_ERROR'; requestId: string; message: string }
  | { type: 'SAVE_IMAGE_TO_LIBRARY_DONE'; requestId: string }
  | { type: 'SAVE_IMAGE_TO_LIBRARY_ERROR'; requestId: string; message: string };

// ---- 检测 ----------------------------------------------------------------

/** 检测是否在 Capacitor 原生 WebView 中运行 */
export function isNativeWebView(): boolean {
  return Capacitor.isNativePlatform();
}

// ---- 应用前后台监听 --------------------------------------------------------

const appForegroundListeners = new Set<() => void>();

/** 注册 App 回到前台时的回调，返回取消注册函数 */
export function onAppBecameActive(listener: () => void): () => void {
  appForegroundListeners.add(listener);

  let removeHandle: (() => void) | null = null;

  // Capacitor App 状态监听（返回 Promise<PluginListenerHandle>）
  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      listener();
    }
  }).then((handle) => {
    removeHandle = () => handle.remove();
  });

  return () => {
    appForegroundListeners.delete(listener);
    removeHandle?.();
  };
}

// ---- 剪贴板 --------------------------------------------------------------

export async function postClipboardWrite(text: string): Promise<void> {
  await Clipboard.write({ string: text });
}

export async function postClipboardRead(): Promise<string> {
  const result = await Clipboard.read();
  return result.value;
}

// ---- 分享图片 ------------------------------------------------------------

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?*:|"]/g, '_').slice(0, 80) || 'poster';
}

async function base64ToTempFile(
  dataBase64: string,
  mimeType: string,
  filename: string,
): Promise<string> {
  const ext = mimeType === 'image/jpeg' ? 'jpg'
    : mimeType === 'image/svg+xml' ? 'svg'
    : 'png';
  const safeName = sanitizeFilename(filename);

  // 去掉可能的 data: URL 前缀
  let cleanBase64 = dataBase64.trim();
  const comma = cleanBase64.indexOf(',');
  if (cleanBase64.startsWith('data:') && comma >= 0) {
    cleanBase64 = cleanBase64.slice(comma + 1);
  }

  const result = await Filesystem.writeFile({
    path: `${safeName}.${ext}`,
    data: cleanBase64,
    directory: Directory.Cache,
  });

  return result.uri;
}

export async function postShareImage(payload: Omit<ShareImagePayload, 'type' | 'requestId'>): Promise<void> {
  const uri = await base64ToTempFile(payload.dataBase64, payload.mimeType, payload.filename);
  await Share.share({
    title: payload.filename,
    url: uri,
    dialogTitle: `分享 ${payload.filename}`,
  });
}

// ---- 保存图片到相册 -------------------------------------------------------

/** 保存图片结果 */
export type SaveImageResult =
  | { success: true }
  | { success: false; code: 'PERMISSION_DENIED' | 'PERMISSION_RESTRICTED' | 'SAVE_FAILED' | 'DECODE_FAILED' | 'UNKNOWN'; message: string };

/**
 * 将 base64 图片直接保存到 iOS 系统图库（PHPhotoLibrary）
 *
 * 权限流程：
 * - authorized/limited → 直接保存
 * - not_determined → 弹系统权限对话框
 * - denied → 返回 PERMISSION_DENIED（调用方应引导用户去「设置」中开启）
 * - restricted → 返回 PERMISSION_RESTRICTED
 *
 * 保存失败会返回详细错误码，调用方可据此给用户合适提示。
 */
export async function postSaveImageToLibrary(
  payload: Omit<SaveImageToLibraryPayload, 'type' | 'requestId'>,
): Promise<SaveImageResult> {
  try {
    const result = await SaveToGallery.saveImage({
      dataBase64: payload.dataBase64,
      filename: payload.filename,
    });
    if (result.success) {
      return { success: true };
    }
    return { success: false, code: 'UNKNOWN', message: '保存失败' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const lowerMsg = msg.toLowerCase();

    if (lowerMsg.includes('permission_denied')) {
      return { success: false, code: 'PERMISSION_DENIED', message: msg };
    }
    if (lowerMsg.includes('permission_restricted')) {
      return { success: false, code: 'PERMISSION_RESTRICTED', message: msg };
    }
    if (lowerMsg.includes('decode_failed')) {
      return { success: false, code: 'DECODE_FAILED', message: msg };
    }
    if (lowerMsg.includes('save_failed')) {
      return { success: false, code: 'SAVE_FAILED', message: msg };
    }
    return { success: false, code: 'UNKNOWN', message: msg };
  }
}

/** 查询照片库写权限状态（仅在原生环境有效） */
export async function checkGalleryPermission(): Promise<GalleryPermissionStatus | null> {
  if (!isNativeWebView()) return null;
  try {
    const result = await SaveToGallery.checkPermission();
    return result.status;
  } catch {
    return 'unknown';
  }
}

/** 请求照片库写权限（仅在 not_determined 时弹系统对话框） */
export async function requestGalleryPermission(): Promise<GalleryPermissionStatus | null> {
  if (!isNativeWebView()) return null;
  try {
    const result = await SaveToGallery.requestPermission();
    return result.status;
  } catch {
    return 'unknown';
  }
}

// ---- AI App Deep Link -----------------------------------------------------

import DeepLink from '../bridge/deepLinkPlugin';
import type { AiAppInfo } from '../bridge/deepLinkPlugin';

/** 检测已安装的 AI App（仅在原生环境有效） */
export async function checkInstalledAiApps(): Promise<AiAppInfo[]> {
  if (!isNativeWebView()) return [];
  try {
    const result = await DeepLink.checkInstalledApps();
    return result.apps;
  } catch (e) {
    console.error('[native-bridge] checkInstalledAiApps error:', e);
    return [];
  }
}

/** 通过 URL Scheme 唤起指定 AI App */
export async function openAiApp(scheme: string): Promise<boolean> {
  if (!isNativeWebView()) return false;
  try {
    const result = await DeepLink.openApp({ scheme });
    return result.opened;
  } catch (e) {
    console.error('[native-bridge] openAiApp error:', e);
    return false;
  }
}

// ---- 剪贴板检测辅助（判断是否为结构化歌词） --------------------------------

/**
 * 判断文本是否为 Shufu 结构化歌词格式
 * 匹配 ===BEGIN=== / ===LYRICS=== / ---PAIR--- / ==TITLE== 等标记
 */
export function isStructuredLyricsText(text: string): boolean {
  if (!text || text.length < 50) return false;
  const trimmed = text.trim();
  return (
    trimmed.includes('===BEGIN===') &&
    (trimmed.includes('===LYRICS===') || trimmed.includes('---PAIR---'))
  );
}

/**
 * 从结构化歌词文本中提取歌名
 * 匹配多种格式:
 *   - # 歌手名《歌名》     (带 # 前缀)
 *   - 歌手名《歌名》       (无 # 前缀，AI 返回格式)
 *   - 《歌名》             (仅书名号)
 */
export function extractTitleFromStructuredText(text: string): string {
  // Pass 1: # 歌手名《歌名》
  const hashMatch = text.match(/#\s*(?:[^《\n]+)?《([^》]+)》/);
  if (hashMatch) return hashMatch[1].trim();

  // Pass 2: 取 ===BEGIN=== 与 ===LYRICS=== 之间的头部，匹配 歌手名《歌名》
  const headerPart = text.split(/===LYRICS===/i)[0] ?? '';
  const bracketMatch = headerPart.match(/(?:.|\n)*?《([^》\n]+)》/);
  if (bracketMatch) return bracketMatch[1].trim();

  return '';
}

// ---- QQ 音乐分享链接识别 ------------------------------------------------

/** QQ 音乐分享链接特征 */
const QQ_MUSIC_SHARE_RE = /(?:https?:\/\/[a-z]\d\.y\.qq\.com\/[^\s]+)[\s]*@QQ音乐/i;

/**
 * 检测剪贴板文本是否为 QQ 音乐分享
 * 格式: 歌手名《歌名》 https://c6.y.qq.com/... @QQ音乐
 */
export function isQQMusicShare(text: string): boolean {
  return QQ_MUSIC_SHARE_RE.test(text);
}

/**
 * 从 QQ 音乐分享文本中提取歌手和歌名
 * 格式: JUJU (ジュジュ)《やさしさで溢れるように》 https://... @QQ音乐
 *      MACO (まこ)《告白》 https://... @QQ音乐
 *
 * @returns { artist?: string; title?: string }
 */
export function parseQQMusicShare(text: string): { artist?: string; title?: string } {
  // 提取《歌名》之前的部分作为歌手名
  // 去掉 https:// 开始的部分
  const cleanText = text.replace(/https?:\/\/[^\s]+/g, '').replace(/@QQ音乐/g, '').trim();

  // 匹配: 歌手名《歌名》
  const match = cleanText.match(/^(.+?)《([^》]+)》/);
  if (!match) return {};

  const rawArtist = match[1].trim();
  const title = match[2].trim();

  return { artist: rawArtist, title };
}

// ---- 矢量 PDF 导出 --------------------------------------------------------

/**
 * Capacitor 中用 jsPDF 客户端生成 PDF，写入临时文件后分享。
 * 不再依赖 expo-print。
 */
import { jsPDF } from 'jspdf';

const CSS_PX_TO_MM = 25.4 / 96;

export async function postExportVectorPdf(
  payload: Omit<ExportVectorPdfPayload, 'type' | 'requestId'>,
): Promise<void> {
  // 用临时 iframe 渲染 HTML → html2canvas 栅格化 → 写入 PDF → 分享
  const { default: html2canvas } = await import('html2canvas');

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = `${payload.pageWidthMm / CSS_PX_TO_MM}px`;
  iframe.style.height = `${payload.pageHeightMm / CSS_PX_TO_MM}px`;
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) throw new Error('无法创建 iframe 文档');
    doc.open();
    doc.write(payload.html);
    doc.close();

    await new Promise((resolve) => setTimeout(resolve, 500));

    const canvas = await html2canvas(doc.body, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const wMm = canvas.width * CSS_PX_TO_MM / 2;
    const hMm = canvas.height * CSS_PX_TO_MM / 2;
    const pdf = new jsPDF({
      orientation: hMm >= wMm ? 'portrait' : 'landscape',
      unit: 'mm',
      format: [wMm, hMm],
      hotfixes: ['px_scaling'],
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(imgData, 'JPEG', 0, 0, wMm, hMm, undefined, 'FAST');

    const pdfBlob = pdf.output('blob') as Blob;
    const pdfBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(pdfBlob);
    });

    const safeName = sanitizeFilename(payload.filename);
    const result = await Filesystem.writeFile({
      path: `${safeName}.pdf`,
      data: pdfBase64,
      directory: Directory.Cache,
    });

    await Share.share({
      title: payload.filename,
      url: result.uri,
      dialogTitle: `分享 ${payload.filename}.pdf`,
    });
  } finally {
    document.body.removeChild(iframe);
  }
}
