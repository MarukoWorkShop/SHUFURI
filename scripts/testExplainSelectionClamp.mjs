/**
 * 划词选区钳制：跨 jp/zh 行时应收回到起点行
 * 运行：npx tsx scripts/testExplainSelectionClamp.mjs
 */
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { clampSelectionToExplainBlock } from '../src/utils/readSelectionForExplain.ts';

const window = new Window({ url: 'https://localhost/' });
const { document } = window;
globalThis.window = window;
globalThis.document = document;
globalThis.Node = window.Node;
globalThis.Element = window.Element;
globalThis.Range = window.Range;
globalThis.Selection = window.Selection;

document.body.innerHTML = `
<div class="fv-body-h">
  <div class="lyrics-group">
    <div class="jp-line">こすもすの<ruby>花<rt>はな</rt></ruby>が</div>
    <div class="zh-line">大波斯菊的花</div>
  </div>
  <div class="lyrics-group">
    <div class="jp-line">秋の空に</div>
    <div class="zh-line">在秋空中</div>
  </div>
</div>
`;

const jp1 = document.querySelectorAll('.jp-line')[0];
const zh1 = document.querySelector('.zh-line');
assert.ok(jp1 && zh1);

const range = document.createRange();
range.setStart(jp1.firstChild, 0);
range.setEnd(zh1.firstChild, 2);
const sel = window.getSelection();
sel.removeAllRanges();
sel.addRange(range);

assert.equal(clampSelectionToExplainBlock(sel), true);
const clamped = sel.getRangeAt(0);
assert.ok(jp1.contains(clamped.commonAncestorContainer) || clamped.commonAncestorContainer === jp1);
assert.equal(zh1.contains(clamped.startContainer) || zh1.contains(clamped.endContainer), false);

console.log('testExplainSelectionClamp: ok');
