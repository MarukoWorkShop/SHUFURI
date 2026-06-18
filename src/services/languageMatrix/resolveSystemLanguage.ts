import type { InterfaceLanguage } from './types';

/** 从 navigator.language 推断使用语言；无法识别时默认中文 */
export function resolveSystemInterfaceLanguage(): InterfaceLanguage {
  if (typeof navigator === 'undefined') return 'zh';
  const loc = navigator.language.toLowerCase();
  if (loc.startsWith('en')) return 'en';
  if (loc.startsWith('zh')) return 'zh';
  return 'zh';
}
