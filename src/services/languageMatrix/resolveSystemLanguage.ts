import type { InterfaceLanguage } from './types';

/** 从 navigator.language 推断使用语言（仅首次默认）；无法识别时默认 English 学习 */
export function resolveSystemInterfaceLanguage(): InterfaceLanguage {
  if (typeof navigator === 'undefined') return 'en';
  const loc = navigator.language.toLowerCase();
  if (loc.startsWith('en')) return 'en';
  if (loc.startsWith('zh')) return 'zh';
  return 'en';
}
