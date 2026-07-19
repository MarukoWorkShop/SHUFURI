import { escapeHtml } from './escapeHtml';
import { prepareBodyHtmlForPreview } from './inkEditUtils';

export type ExplainNotePayload = {
  term: string;
  contextSense: string;
  grammar?: string;
  mood?: string;
};

const NOTES_SECTION_CLASS = 'lyrics-explain-notes';
const NOTES_SECTION_TITLE = '划词笔记';

/** 与重点词汇条同结构：竖划线导轨 + vocab-line1 / detail / 次行 */
export function buildExplainNoteItemHtml(payload: ExplainNotePayload): string {
  const term = payload.term.replace(/\s+/g, '').trim();
  if (!term) return '';

  const sense = payload.contextSense.trim();
  const grammar = payload.grammar?.trim() || '';
  const mood = payload.mood?.trim() || '';

  const meaning = sense
    ? ` <span class="vocab-meaning">${escapeHtml(sense)}</span>`
    : '';
  const detail = grammar
    ? `<p class="grammar-detail">${escapeHtml(grammar)}</p>`
    : '';
  const moodLine = mood
    ? `<p class="vocab-ex-zh">${escapeHtml(mood)}</p>`
    : '';

  return (
    `<div class="lyrics-vocab-item" data-shufuri-explain-note="1">` +
    `<p class="vocab-line1"><span class="vocab-word">${escapeHtml(term)}</span>${meaning}</p>` +
    detail +
    moodLine +
    `</div>`
  );
}

/**
 * 将笔记条追加到正文末尾的「划词笔记」区（无则新建，样式同 lyrics-vocabulary）。
 */
export function appendExplainNoteToBodyHtml(bodyHtml: string, itemHtml: string): string {
  const item = itemHtml.trim();
  if (!item) return bodyHtml;

  if (typeof DOMParser === 'undefined') {
    // SSR / 非浏览器兜底：直接拼接区块
    if (bodyHtml.includes(NOTES_SECTION_CLASS)) {
      return bodyHtml.replace(
        new RegExp(`(<div[^>]*class="[^"]*${NOTES_SECTION_CLASS}[^"]*"[^>]*>)([\\s\\S]*?)(</div>)\\s*$`),
        (_, open, mid, close) => `${open}${mid}${item}${close}`,
      );
    }
    return (
      `${bodyHtml}` +
      `<div class="lyrics-vocabulary ${NOTES_SECTION_CLASS}" data-lyrics-force-next-page="1">` +
      `<h2 class="lyrics-section-title">${NOTES_SECTION_TITLE}</h2>${item}</div>`
    );
  }

  const doc = new DOMParser().parseFromString(
    `<div id="shufuri-note-root">${bodyHtml}</div>`,
    'text/html',
  );
  const root = doc.getElementById('shufuri-note-root');
  if (!root) return bodyHtml;

  let section = root.querySelector(`.${NOTES_SECTION_CLASS}`);
  if (!section) {
    section = doc.createElement('div');
    section.className = `lyrics-vocabulary ${NOTES_SECTION_CLASS}`;
    section.setAttribute('data-lyrics-force-next-page', '1');
    const h2 = doc.createElement('h2');
    h2.className = 'lyrics-section-title';
    h2.textContent = NOTES_SECTION_TITLE;
    section.appendChild(h2);
    root.appendChild(section);
  }

  const wrap = doc.createElement('div');
  wrap.innerHTML = item;
  const node = wrap.firstElementChild;
  if (node) section.appendChild(node);

  return root.innerHTML;
}

export function commitExplainNoteToBody(
  bodyHtml: string,
  payload: ExplainNotePayload,
): string {
  const item = buildExplainNoteItemHtml(payload);
  if (!item) return bodyHtml;
  return prepareBodyHtmlForPreview(appendExplainNoteToBodyHtml(bodyHtml, item));
}
