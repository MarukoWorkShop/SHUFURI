/**
 * 系统 locale → interfaceLanguage 首次默认推断
 * 运行: npx tsx scripts/testResolveSystemLanguage.mjs
 */
import { resolveSystemInterfaceLanguage } from '../src/services/languageMatrix/resolveSystemLanguage.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const cases = [
  { lang: 'zh-CN', expected: 'zh' },
  { lang: 'zh-TW', expected: 'zh' },
  { lang: 'en-US', expected: 'en' },
  { lang: 'en-GB', expected: 'en' },
  { lang: 'th-TH', expected: 'en' },
  { lang: 'ja-JP', expected: 'en' },
  { lang: 'ko-KR', expected: 'en' },
  { lang: 'fr-FR', expected: 'en' },
];

const prev = navigator.language;
for (const { lang, expected } of cases) {
  Object.defineProperty(navigator, 'language', { value: lang, configurable: true });
  assert(
    resolveSystemInterfaceLanguage() === expected,
    `${lang} → ${expected}, got ${resolveSystemInterfaceLanguage()}`,
  );
}
Object.defineProperty(navigator, 'language', { value: prev, configurable: true });

console.log('testResolveSystemLanguage: OK');
