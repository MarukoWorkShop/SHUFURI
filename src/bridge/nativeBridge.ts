/**
 * Capacitor 原生桥接
 *
 * 迁移自 Expo RN WebView 双桥架构。
 * Capacitor 模式下原生调用通过插件 API（src/utils/nativeBridge.ts）完成，
 * 此文件仅保留桥接初始化与兼容接口。
 */

import { Capacitor } from '@capacitor/core';

// ---- 常量 ---------------------------------------------------------------

export const BRIDGE_RECEIVE_FN = '__shufuReceiveCommand';
export const BRIDGE_MSG_HANDLER = 'shufu';
export const BRIDGE_STORAGE_KEY = '__shufu_is_native';

// ---- 类型（保持兼容）---------------------------------------------------

export interface SetContentPayload {
  bodyHtml?: string;
  rawText?: string;
  title: string;
  layoutProfile: 'clipPosterPrint' | 'mobilePoster';
}

export type BridgeCommand =
  | { type: 'detect_native' }
  | { type: 'set_content'; payload: SetContentPayload }
  | { type: 'export_pdf' }
  | { type: 'export_png' }
  | { type: 'export_png_all' }
  | { type: 'reset' };

export interface ExportCompleteData {
  type: 'pdf' | 'png';
  dataBase64: string;
  filename: string;
  requestId: string;
}

export interface ExportProgressData {
  requestId: string;
  current: number;
  total: number;
}

export type BridgeEventData =
  | { event: 'ready' }
  | { event: 'export_complete'; data: ExportCompleteData }
  | { event: 'export_progress'; data: ExportProgressData }
  | { event: 'error'; data: { message: string } }
  | { event: 'save_image'; data: { dataBase64: string; mimeType: string; filename: string; requestId: string } }
  | { event: 'share_image'; data: { dataBase64: string; mimeType: string; filename: string; requestId: string } }
  | { event: 'vector_pdf'; data: { html: string; filename: string; pageWidthMm: number; pageHeightMm: number; requestId: string } }
  | { event: 'native_response'; data: { requestId: string; result?: string; error?: string } };

// ---- 初始化 ---------------------------------------------------------------

/** 初始化桥接（Capacitor 下检测原生环境并注册命令回调） */
export function initNativeBridge(
  _onCommand: (cmd: BridgeCommand) => void,
): boolean {
  if (typeof window === 'undefined') return false;

  if (!Capacitor.isNativePlatform()) return false;

  console.log('[ShufuBridge] Capacitor 原生桥接已就绪');
  return true;
}

/** 发送事件到原生层（Capacitor 下通过插件 API，此函数仅作兼容占位） */
export function postToNative(data: BridgeEventData): void {
  console.log('[ShufuBridge] postToNative (Capacitor no-op):', data.event);
}
