/**
 * 图片格式转换工具
 *
 * 处理 HEIC 等浏览器不原生支持的图片格式，
 * 在文件读取阶段统一转换为 JPEG data URL。
 */

import heic2any from 'heic2any';

/** 支持转换的 MIME 类型 */
const CONVERTIBLE_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

/**
 * 将 File 转换为浏览器可渲染的 JPEG data URL。
 *
 * - 非 HEIC/HEIF 文件直接走 FileReader（零开销）
 * - HEIC/HEIF 文件通过 heic2any WASM 解码器转为 Blob 再读为 data URL
 *
 * @param file 用户选择的图片 File 对象
 * @returns Promise<string> — image/jpeg 格式的 base64 data URL
 */
export async function fileToJpegDataUrl(file: File): Promise<string> {
  // 非 HEIC 格式：直接读取，无需转换
  if (!CONVERTIBLE_TYPES.has(file.type)) {
    return readAsDataUrl(file);
  }

  // HEIC → Blob (JPEG) → data URL
  try {
    const blob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    });

    // heic2any 返回单个 Blob 或 Blob[]
    const jpegBlob = Array.isArray(blob) ? blob[0] : blob;
    return readBlobAsDataUrl(jpegBlob);
  } catch (e) {
    console.warn('[imageConvert] HEIC 转换失败，尝试直接读取', e);
    // 降级：部分新浏览器已支持 HEIC 渲染（如 Safari），直接读取试试
    return readAsDataUrl(file);
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('HEIC 转码后读取失败'));
    reader.readAsDataURL(blob);
  });
}
