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
assert(
  editCss.includes('var(--color-edit-canvas-bg)'),
  'edit canvas background uses theme light token',
);
assert(editCss.includes('#141413'), 'edit near-black lyric color');
assert(editCss.includes('line-height: 1.52'), 'edit Kami reading line-height');
assert(editCss.includes('var(--color-fg-secondary)'), 'edit translation uses theme token');
console.log('OK: edit theme-tinted reading overrides');

const themeCss = fs.readFileSync(new URL('../src/styles/theme.css', import.meta.url), 'utf8');
assert(themeCss.includes('--color-edit-canvas-bg'), 'theme defines edit canvas bg token');
assert(
  /\[data-theme="mono"\][\s\S]*?--color-edit-canvas-bg:\s*#f0efec/i.test(themeCss),
  'mono edit canvas = light silver-gray',
);
assert(
  /\[data-theme="blue"\][\s\S]*?--color-edit-canvas-bg:\s*#eef2f5/i.test(themeCss),
  'blue edit canvas = light mist blue',
);
assert(
  /\[data-theme="red"\][\s\S]*?--color-edit-canvas-bg:\s*#f7f0ef/i.test(themeCss),
  'red edit canvas = light sakura pink',
);
console.log('OK: per-theme edit canvas light backgrounds');

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
