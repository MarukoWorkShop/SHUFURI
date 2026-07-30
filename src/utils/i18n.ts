import { getAppSettings } from '../services/appSettings';

/**
 * 界面语言快捷切换函数。
 * 用法：L('中文', 'Chinese') → 根据当前 interfaceLanguage 返回对应文本。
 *
 * 全局共享，替代各组件内重复定义的 L()。
 * 注意：非响应式，读取的是 localStorage 快照。
 * 语言切换后通过 App state 变更触发组件重渲染，届时重新取值。
 */
export function L(zh: string, en: string): string {
  const iface = getAppSettings().interfaceLanguage;
  return iface === 'en' ? en : zh;
}
