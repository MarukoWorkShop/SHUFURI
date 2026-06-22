/**
 * 注音开关影响分页密度：隐藏 ruby 后页数应减少或持平（同 fixture）
 * 运行: npx tsx scripts/testShowRubyPagination.mjs
 */
import { readFileSync } from 'fs';
import { Window } from 'happy-dom';
import { compileDocument } from '../src/codec/compileDocument.ts';
import { normalizeLyricsBodyHtml } from '../src/services/lyricsHtml.ts';
import { paginateShufuriPosterBodyHtml } from '../src/utils/shufuriPoster/paginateShufuriPosterHtml.ts';

const window = new Window({ url: 'http://localhost/' });
const { document, Node, Element, HTMLElement, Text } = window;
globalThis.window = window;
globalThis.document = document;
globalThis.Node = Node;
globalThis.Element = Element;
globalThis.HTMLElement = HTMLElement;
globalThis.Text = Text;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const raw = readFileSync(new URL('./fixtures/akizakura-user-paste.txt', import.meta.url), 'utf8');
const { bodyHtml } = compileDocument(raw, { interfaceLanguage: 'zh' });
const normalized = normalizeLyricsBodyHtml(bodyHtml);

const title = '秋桜';
const profile = 'mobilePoster';

const withRuby = paginateShufuriPosterBodyHtml(
  normalized,
  title,
  profile,
  document,
  undefined,
  'jp',
  'jp',
  undefined,
  { showRuby: true, userFontScale: 1, userLineHeightScale: 1 },
);

const withoutRuby = paginateShufuriPosterBodyHtml(
  normalized,
  title,
  profile,
  document,
  undefined,
  'jp',
  'jp',
  undefined,
  { showRuby: false, userFontScale: 1, userLineHeightScale: 1 },
);

assert(withRuby.length > 0, 'withRuby pages');
assert(withoutRuby.length > 0, 'withoutRuby pages');
assert(
  withoutRuby.length <= withRuby.length,
  `hide ruby should not increase pages (with=${withRuby.length}, without=${withoutRuby.length})`,
);

const dense = paginateShufuriPosterBodyHtml(
  normalized,
  title,
  profile,
  document,
  undefined,
  'jp',
  'jp',
  undefined,
  { showRuby: true, userFontScale: 0.9, userLineHeightScale: 0.9 },
);

assert(
  dense.length <= withRuby.length,
  `smaller density should not increase pages (dense=${dense.length}, base=${withRuby.length})`,
);

console.log('testShowRubyPagination: OK', {
  withRuby: withRuby.length,
  withoutRuby: withoutRuby.length,
  dense: dense.length,
});

await window.happyDOM.close();
