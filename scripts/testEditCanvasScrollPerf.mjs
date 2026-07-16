/**
 * 编辑画布滚动性能相关 CSS / 空 ruby 回归（不撤空 ruby）
 * 运行：npx tsx scripts/testEditCanvasScrollPerf.mjs
 */

import fs from 'node:fs';
import { compileEditCssOverrides } from '../src/utils/posterTypography/cssCompiler.ts';
import { wrapUncoveredKanjiAsRuby, INK_EMPTY_RT_ATTR } from '../src/utils/inkFineTune/wrapUncoveredKanjiAsRuby.ts';
import { Window } from 'happy-dom';

const window = new Window({ url: 'https://localhost/' });
globalThis.DOMParser = window.DOMParser;
globalThis.NodeFilter = window.NodeFilter;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const editCss = compileEditCssOverrides();
assert(!/content-visibility\s*:/.test(editCss), 'edit CSS must NOT use content-visibility (scrollHeight loop)');
assert(editCss.includes('contain: style'), 'edit CSS may use style containment');
console.log('OK: no content-visibility property in edit overrides');

const previewCss = fs.readFileSync(
  new URL('../src/styles/app/export-preview.css', import.meta.url),
  'utf8',
);
assert(
  previewCss.includes('.edit-canvas-scroll:not(.is-ink-edit-armed)') &&
    previewCss.includes('pointer-events: none'),
  'browse mode must disable pointer-events until toolbox armed',
);
assert(
  previewCss.includes('.edit-canvas-scroll.is-ink-edit-armed.is-scrolling'),
  'armed+scrolling must keep interaction lock',
);
console.log('OK: browse/edit arm + scroll lock CSS');

const input = `<div class="lyrics-group"><p class="jp-line"><ruby>深<rt>ふか</rt></ruby>く祈る</p><p class="zh-line">译</p></div>`;
const wrapped = wrapUncoveredKanjiAsRuby(input);
assert(wrapped.includes(`${INK_EMPTY_RT_ATTR}="1"`), 'empty ruby wrap must remain active');
assert(wrapped.includes('祈'), 'uncovered kanji still wrapped');
console.log('OK: empty ruby wrap preserved');

console.log('\ntestEditCanvasScrollPerf: all passed.');
