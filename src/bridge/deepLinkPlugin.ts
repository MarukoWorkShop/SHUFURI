/**
 * DeepLink Capacitor 自定义插件类型定义
 *
 * 对应 iOS 原生 DeepLinkPlugin.swift，提供：
 * - checkInstalledApps: 检测已安装的 AI App
 * - openApp: 通过 URL Scheme 唤起指定 AI App
 */

import { registerPlugin } from '@capacitor/core';

export interface AiAppInfo {
  id: string;
  name: string;
  scheme: string;
}

export interface DeepLinkPlugin {
  /**
   * 检测设备上已安装的 AI 聊天应用
   * @returns { apps: AiAppInfo[] } 已安装的 App 列表
   */
  checkInstalledApps(): Promise<{ apps: AiAppInfo[] }>;

  /**
   * 通过 URL Scheme 唤起指定 AI App
   * @param scheme App 的 URL Scheme（如 "chatgpt://"）
   */
  openApp(options: { scheme: string }): Promise<{ opened: boolean }>;
}

const DeepLink = registerPlugin<DeepLinkPlugin>('DeepLink');

export default DeepLink;
