/**
 * SaveToGallery Capacitor 自定义插件类型定义
 *
 * 对应 iOS 原生 SaveToGalleryPlugin.swift，提供：
 * - saveImage: 直接写入系统图库（PHPhotoLibrary）
 * - checkPermission: 查询当前权限状态
 * - requestPermission: 请求权限
 */

import { registerPlugin } from '@capacitor/core';

export interface SaveToGalleryPlugin {
  /**
   * 将 base64 图片直接保存到系统图库
   * @returns { success: boolean, filename: string }
   * @throws PERMISSION_DENIED — 用户拒绝权限
   * @throws PERMISSION_RESTRICTED — 权限受限（家长控制等）
   * @throws DECODE_FAILED — base64 解码失败
   * @throws SAVE_FAILED — 写入图库失败
   */
  saveImage(options: {
    dataBase64: string;
    filename?: string;
  }): Promise<{ success: boolean; filename: string }>;

  /**
   * 查询当前照片库写权限状态
   * @returns status: 'authorized' | 'limited' | 'denied' | 'restricted' | 'not_determined' | 'unknown'
   */
  checkPermission(): Promise<{ status: GalleryPermissionStatus }>;

  /**
   * 请求照片库写权限（仅在 not_determined 时弹系统对话框）
   * @returns status: 请求后的权限状态
   */
  requestPermission(): Promise<{ status: GalleryPermissionStatus }>;
}

export type GalleryPermissionStatus =
  | 'authorized'
  | 'limited'
  | 'denied'
  | 'restricted'
  | 'not_determined'
  | 'unknown';

const SaveToGallery = registerPlugin<SaveToGalleryPlugin>('SaveToGallery');

export default SaveToGallery;
