/**
 * Master Handbook domClass 快照
 * 运行: npx tsx scripts/testMasterHandbook.mjs
 */
import { resolvePosterClass, usesRubyMarkup, usesPlainHtml } from '../src/codec/masterHandbook.ts';

const langs = ['jp', 'ko', 'en', 'zh'];
const contentLangs = ['jp', 'ko', 'en', 'zh'];

assert(resolvePosterClass('lyricPrimary', 'jp') === 'jp-line', 'jp lyric primary');
assert(resolvePosterClass('lyricPrimary', 'ko') === 'ko-line', 'ko lyric primary');
assert(resolvePosterClass('lyricPrimary', 'en') === 'jp-line', 'en lyric primary');
assert(resolvePosterClass('lyricPrimary', 'zh') === 'cn-line', 'zh lyric primary');

// lyricSecondary：interfaceLanguage 决定 zh-line vs gloss-line
for (const lang of ['jp', 'ko', 'en', 'zh']) {
  if (lang === 'zh') {
    assert(
      resolvePosterClass('lyricSecondary', lang, { interfaceLanguage: 'zh' }) === '',
      'zh native + zh iface: no gloss line',
    );
    assert(
      resolvePosterClass('lyricSecondary', lang, { interfaceLanguage: 'en' }) === 'gloss-line',
      'zh + en iface: gloss-line',
    );
    continue;
  }
  if (lang === 'en') {
    assert(
      resolvePosterClass('lyricSecondary', lang, { interfaceLanguage: 'en' }) === '',
      'en native + en iface: no gloss line',
    );
    assert(
      resolvePosterClass('lyricSecondary', lang, { interfaceLanguage: 'zh' }) === 'zh-line',
      'en + zh iface: zh-line',
    );
    continue;
  }
  assert(
    resolvePosterClass('lyricSecondary', lang, { interfaceLanguage: 'zh' }) === 'zh-line',
    `${lang} + zh iface: zh-line`,
  );
  assert(
    resolvePosterClass('lyricSecondary', lang, { interfaceLanguage: 'en' }) === 'gloss-line',
    `${lang} + en iface: gloss-line`,
  );
}

// pedagogical translation / grammar gloss spans
for (const lang of contentLangs) {
  assert(
    resolvePosterClass('vocabExampleSecondary', lang, { interfaceLanguage: 'zh' }) === 'vocab-ex-zh',
    `${lang} vocab ex zh iface`,
  );
  assert(
    resolvePosterClass('vocabExampleSecondary', lang, { interfaceLanguage: 'en' }) === 'vocab-ex-gloss',
    `${lang} vocab ex en iface`,
  );
  assert(
    resolvePosterClass('grammarExampleSecondary', lang, { interfaceLanguage: 'zh' }) === 'grammar-ex-zh',
    `${lang} grammar ex zh iface`,
  );
  assert(
    resolvePosterClass('grammarExampleSecondary', lang, { interfaceLanguage: 'en' }) === 'grammar-ex-gloss',
    `${lang} grammar ex en iface`,
  );
  assert(
    resolvePosterClass('grammarTitleSecondary', lang, { interfaceLanguage: 'zh' }) === 'grammar-title-zh',
    `${lang} grammar title zh iface`,
  );
  assert(
    resolvePosterClass('grammarTitleSecondary', lang, { interfaceLanguage: 'en' }) === 'grammar-title-gloss',
    `${lang} grammar title en iface`,
  );
}

assert(usesRubyMarkup('lyricPrimary', 'jp'), 'jp uses ruby');
assert(!usesRubyMarkup('lyricPrimary', 'ko'), 'ko plain');
assert(usesPlainHtml('lyricPrimary', 'en'), 'en plain html');

assert(resolvePosterClass('grammarTitlePrimary', 'en') === 'grammar-title-ja', 'en grammar title primary');
assert(resolvePosterClass('grammarTitlePrimary', 'ko') === 'grammar-title-ko', 'ko grammar title primary');

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
