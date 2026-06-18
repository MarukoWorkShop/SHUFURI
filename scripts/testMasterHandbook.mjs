/**
 * Master Handbook domClass 快照
 * 运行: npx tsx scripts/testMasterHandbook.mjs
 */
import { resolvePosterClass, usesRubyMarkup, usesPlainHtml } from '../src/codec/masterHandbook.ts';

const langs = ['jp', 'ko', 'en', 'zh'];

assert(resolvePosterClass('lyricPrimary', 'jp') === 'jp-line', 'jp lyric primary');
assert(resolvePosterClass('lyricPrimary', 'ko') === 'ko-line', 'ko lyric primary');
assert(resolvePosterClass('lyricPrimary', 'en') === 'jp-line', 'en lyric primary');
assert(resolvePosterClass('lyricPrimary', 'zh') === 'cn-line', 'zh lyric primary');

assert(resolvePosterClass('lyricSecondary', 'jp') === 'zh-line', 'jp gloss class');
assert(resolvePosterClass('lyricSecondary', 'en') === 'gloss-line', 'en gloss class');
assert(resolvePosterClass('lyricSecondary', 'zh', { interfaceLanguage: 'zh' }) === '', 'zh native skip gloss');

assert(usesRubyMarkup('lyricPrimary', 'jp'), 'jp uses ruby');
assert(!usesRubyMarkup('lyricPrimary', 'ko'), 'ko plain');
assert(usesPlainHtml('lyricPrimary', 'en'), 'en plain html');

assert(resolvePosterClass('grammarTitlePrimary', 'en') === 'grammar-title-ja', 'en grammar title primary');
assert(resolvePosterClass('grammarTitleSecondary', 'en') === 'grammar-title-gloss', 'en grammar title gloss');
assert(resolvePosterClass('grammarTitleSecondary', 'jp') === 'grammar-title-zh', 'jp grammar title gloss zh');

for (const lang of langs) {
  assert(resolvePosterClass('vocabTerm', lang), `vocab term class for ${lang}`);
}

console.log('OK');

function assert(cond, label) {
  if (!cond) {
    console.error('FAIL:', label);
    process.exit(1);
  }
}
