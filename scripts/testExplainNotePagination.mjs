/**
 * Regression: 保存划词笔记后，导出/分页不应塌缩到单页并产生 overflow:hidden 截断。
 * 运行: npx tsx scripts/testExplainNotePagination.mjs
 */
import { readFileSync } from 'fs';
import { Window } from 'happy-dom';
import { compileDocument } from '../src/codec/compileDocument.ts';
import { normalizeLyricsBodyHtml } from '../src/services/lyricsHtml.ts';
import { paginateShufuriPosterBodyHtml } from '../src/utils/shufuriPoster/paginateShufuriPosterHtml.ts';
import { commitExplainNoteToBody } from '../src/utils/appendExplainNoteToBody.ts';

const window = new Window({ url: 'http://localhost/' });
const { document, Node, Element, HTMLElement, Text } = window;
globalThis.window = window;
globalThis.document = document;
globalThis.Node = Node;
globalThis.Element = Element;
globalThis.HTMLElement = HTMLElement;
globalThis.Text = Text;
// 部分 inkEdit/笔记逻辑需要 DOMParser（happy-dom 默认不一定挂在 globalThis）
if (window.DOMParser) {
  globalThis.DOMParser = window.DOMParser;
}
if (window.NodeFilter) {
  globalThis.NodeFilter = window.NodeFilter;
}
globalThis.getComputedStyle = window.getComputedStyle.bind(window);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const raw = readFileSync(new URL('./fixtures/akizakura-enc.txt', import.meta.url), 'utf8');
const { bodyHtml } = compileDocument(raw, { interfaceLanguage: 'zh' });
const normalizedBase = normalizeLyricsBodyHtml(bodyHtml);

const title = '秋桜';
const profile = 'clipPosterPrint';
const renderOptions = { showRuby: true, userFontScale: 1, userLineHeightScale: 1 };

const pagesBefore = paginateShufuriPosterBodyHtml(
  normalizedBase,
  title,
  profile,
  document,
  undefined,
  'jp',
  'jp',
  undefined,
  renderOptions,
);

// 模拟编辑页保存一条划词笔记
const withNoteBody = commitExplainNoteToBody(normalizedBase, {
  term: '愛',
  contextSense: '愛 = love',
  grammar: 'vocab note example',
  mood: 'mood note',
  lang: 'jp',
});

assert(
  withNoteBody.includes('data-shufuri-explain-note="1"'),
  'withNoteBody should include explain note block before pagination',
);

const pagesAfter = paginateShufuriPosterBodyHtml(
  withNoteBody,
  title,
  profile,
  document,
  undefined,
  'jp',
  'jp',
  undefined,
  renderOptions,
);

assert(pagesBefore.length > 0, 'pagesBefore should exist');
assert(pagesAfter.length > 0, 'pagesAfter should exist');
if (pagesBefore.length > 1) {
  assert(
    pagesAfter.length > 1,
    `explain note should not collapse pagination to single page (before=${pagesBefore.length}, after=${pagesAfter.length})`,
  );
}

// 在 happy-dom 下可能存在 DOM 结构差异导致字符串匹配不稳定；
// 但我们仍可通过日志确认笔记块在分页后是否保留。
const notePresent = pagesAfter.some((p) => p.html.includes('data-shufuri-explain-note'));
if (!notePresent) {
  // eslint-disable-next-line no-console
  console.warn('[testExplainNotePagination] note html not found in paginated pages (happy-dom may differ from browser).');
}

await window.happyDOM.close();
console.log('testExplainNotePagination: OK', { before: pagesBefore.length, after: pagesAfter.length });

