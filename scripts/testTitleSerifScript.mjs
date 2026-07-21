/**
 * 歌名衬线脚本检测：简体专形 → source-han；日文汉字形 → kozmin
 * 运行：npx tsx scripts/testTitleSerifScript.mjs
 */
import assert from 'node:assert/strict';
import {
  textHasSimplifiedChineseForms,
  resolveTitleFieldSerifOverride,
} from '../src/utils/shufuriPoster/titleSerifScript.ts';

assert.equal(textHasSimplifiedChineseForms('秋樱'), true);
assert.equal(textHasSimplifiedChineseForms('秋桜'), false);
assert.equal(textHasSimplifiedChineseForms('千本桜'), false);
assert.equal(textHasSimplifiedChineseForms('邓丽君'), true);
assert.equal(textHasSimplifiedChineseForms('山口百惠'), false);

assert.equal(resolveTitleFieldSerifOverride('jp', '秋樱'), 'source-han');
assert.equal(resolveTitleFieldSerifOverride('jp', '秋桜'), 'kozmin');
assert.equal(resolveTitleFieldSerifOverride('jp', '残酷な天使のテーゼ'), 'kozmin');
assert.equal(resolveTitleFieldSerifOverride('jp', '山口百惠'), 'kozmin');
assert.equal(resolveTitleFieldSerifOverride('jp', '邓丽君'), 'source-han');

assert.equal(resolveTitleFieldSerifOverride('zh', '任意标题'), 'source-han');
assert.equal(resolveTitleFieldSerifOverride('zh', '秋桜'), 'source-han');

assert.equal(resolveTitleFieldSerifOverride('ko', '秋天的故事'), 'source-han');
assert.equal(resolveTitleFieldSerifOverride('ko', '가을'), null);
assert.equal(resolveTitleFieldSerifOverride('en', 'Hello'), null);
assert.equal(resolveTitleFieldSerifOverride('en', '月亮代表我的心'), 'source-han');

console.log('testTitleSerifScript: ok');
