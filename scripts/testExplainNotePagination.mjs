/**
 * Regression: 保存划词笔记后，导出/分页不应把全书挤进第 1 页。
 * 运行: npx tsx scripts/testExplainNotePagination.mjs
 */
import { readFileSync } from 'fs';
import { Window } from 'happy-dom';
import { compileDocument } from '../src/codec/compileDocument.ts';
import { normalizeLyricsBodyHtml } from '../src/services/lyricsHtml.ts';
import { paginateShufuriPosterBodyHtml } from '../src/utils/shufuriPoster/paginateShufuriPosterHtml.ts';
import { commitExplainNoteToBody } from '../src/utils/appendExplainNoteToBody.ts';

const window = new Window({ url: 'http://localhost/', width: 1200, height: 2000 });
const { document, Node, Element, HTMLElement, Text } = window;
Object.assign(globalThis, {
  window,
  document,
  Node,
  Element,
  HTMLElement,
  Text,
  DOMParser: window.DOMParser,
  NodeFilter: window.NodeFilter,
  getComputedStyle: window.getComputedStyle.bind(window),
});

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function countGroups(html) {
  return (html.match(/lyrics-group/g) || []).length;
}

function pageHasNotes(html) {
  return (
    html.includes('data-shufuri-explain-note') ||
    html.includes('划词笔记') ||
    html.includes('lyrics-explain-notes')
  );
}

function pageIsWholeClipBody(html) {
  const t = html.trim();
  return /^<div class="clip-body[\s>]/.test(t) && countGroups(t) > 3;
}

const raw = readFileSync(new URL('./fixtures/akizakura-enc.txt', import.meta.url), 'utf8');
const { bodyHtml } = compileDocument(raw, { interfaceLanguage: 'zh' });
const normalizedBase = normalizeLyricsBodyHtml(bodyHtml);
const groupsBefore = countGroups(normalizedBase);

const title = '秋桜';
const renderOptions = { showRuby: true, userFontScale: 1, userLineHeightScale: 1 };
const profiles = ['mobilePoster', 'squarePoster', 'clipPosterPrint'];

const withNoteBody = commitExplainNoteToBody(normalizedBase, {
  id: 'note-test-1',
  term: '愛',
  contextSense: '愛 = love',
  grammar: 'vocab note example',
  mood: 'mood note',
  lang: 'jp',
});

assert(
  withNoteBody.includes('data-shufuri-explain-note="1"'),
  'withNoteBody should include explain note block',
);
assert(
  countGroups(withNoteBody) === groupsBefore,
  `lyrics-group count must stay stable after note commit (${groupsBefore} -> ${countGroups(withNoteBody)})`,
);

// 笔记必须在 clip-body 内（不能写成兄弟节点）
{
  const probe = document.createElement('div');
  probe.innerHTML = withNoteBody.trim();
  const top = [...probe.children];
  assert(top.length === 1, `body should have single root after note commit, got ${top.length}`);
  const root = top[0];
  assert(
    root instanceof HTMLElement &&
      (root.classList.contains('clip-body') || root.classList.contains('lyrics-notes-body')),
    'root must be clip-body',
  );
  assert(
    !!root.querySelector('.lyrics-explain-notes, [data-shufuri-explain-note="1"]'),
    'explain notes must live inside clip-body',
  );
}

// 历史坏数据：笔记在 clip-body 外时，分页仍应展开而非整页装箱
const legacyOutside = `${normalizedBase}<div class="lyrics-vocabulary lyrics-explain-notes" data-lyrics-force-next-page="1"><h2 class="lyrics-section-title">划词笔记</h2><div class="lyrics-vocab-item shufuri-explain-note" data-shufuri-explain-note="1"><p class="vocab-line1"><span class="vocab-word">旧</span></p></div></div>`;

for (const profile of profiles) {
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
  const pagesLegacy = paginateShufuriPosterBodyHtml(
    legacyOutside,
    title,
    profile,
    document,
    undefined,
    'jp',
    'jp',
    undefined,
    renderOptions,
  );

  assert(pagesBefore.length > 0, `${profile}: pagesBefore`);
  assert(pagesAfter.length > 0, `${profile}: pagesAfter`);

  // 不得出现「第 1 页是整块 clip-body（全书）+ 第 2 页仅笔记」
  assert(
    !pageIsWholeClipBody(pagesAfter[0].html),
    `${profile}: page0 must not be a whole clip-body atom (collapse bug)`,
  );
  assert(
    !pageIsWholeClipBody(pagesLegacy[0].html),
    `${profile}: legacy outside-clip notes must not collapse page0 to clip-body atom`,
  );

  if (pagesBefore.length > 1) {
    assert(
      pagesAfter.length >= pagesBefore.length,
      `${profile}: pages must not shrink after note (before=${pagesBefore.length}, after=${pagesAfter.length})`,
    );
  }

  const notePageIdx = pagesAfter.findIndex((p) => pageHasNotes(p.html));
  assert(notePageIdx >= 0, `${profile}: explain notes must appear in paginated output`);

  // 笔记前若有多页歌词/板块，笔记不应抢走前面的 force-next 边界
  if (pagesBefore.length >= 3) {
    assert(
      notePageIdx >= 1,
      `${profile}: notes should not start on page 0 when song has multiple sections`,
    );
    // 重点词汇/语法仍应出现在笔记页之前（或同书内独立页）
    const vocabBeforeNotes = pagesAfter
      .slice(0, notePageIdx + 1)
      .some((p) => /重点词汇/.test(p.html) && !pageHasNotes(p.html));
    const grammarBeforeNotes = pagesAfter
      .slice(0, notePageIdx + 1)
      .some((p) => /重点语法/.test(p.html) && !pageHasNotes(p.html));
    assert(
      vocabBeforeNotes || grammarBeforeNotes || pagesAfter.length >= pagesBefore.length,
      `${profile}: vocab/grammar sections should remain paginated with notes`,
    );
  }

  console.log(`OK ${profile}`, {
    before: pagesBefore.length,
    after: pagesAfter.length,
    legacy: pagesLegacy.length,
    notePageIdx,
  });
}

await window.happyDOM.close();
console.log('testExplainNotePagination: OK');
