import type { LangCode } from '../services/appSettings';
import { resolvePosterClass } from '../codec/masterHandbook';
import { escapeHtml } from './escapeHtml';
import { prepareBodyHtmlForPreview } from './inkEditUtils';

export type ExplainNotePayload = {
  /** 单条笔记的唯一标识（编辑/删除定位用）；旧笔记可能没有 id */
  id?: string;
  term: string;
  contextSense: string;
  grammar?: string;
  mood?: string;
  /** 正文语种；决定 vocab-word / vocab-word-ko 等 class */
  lang?: LangCode;
};

const NOTES_SECTION_CLASS = 'lyrics-explain-notes';
const NOTES_SECTION_TITLE = '划词笔记';

/** 韩语语法说明里的谚文片段，避免被 .grammar-detail * 的中文字体盖掉 */
const HANGUL_RUN_RE = /[\uAC00-\uD7A3]+/g;

function wrapHangulRuns(escapedText: string): string {
  return escapedText.replace(HANGUL_RUN_RE, (m) => `<span class="ko-run">${m}</span>`);
}

/** 与重点词汇条同结构：竖划线导轨 + vocab-line1 / detail / 次行 */
export function buildExplainNoteItemHtml(payload: ExplainNotePayload): string {
  const term = payload.term.replace(/\s+/g, '').trim();
  if (!term) return '';

  const id = payload.id ?? '';
  const lang = payload.lang ?? 'jp';
  const vocabWordClass = resolvePosterClass('vocabTerm', lang);
  const sense = payload.contextSense.trim();
  const grammar = payload.grammar?.trim() || '';
  const mood = payload.mood?.trim() || '';

  const meaning = sense
    ? ` <span class="vocab-meaning">${escapeHtml(sense)}</span>`
    : '';
  const grammarHtml =
    lang === 'ko' ? wrapHangulRuns(escapeHtml(grammar)) : escapeHtml(grammar);
  const detail = grammar
    ? `<p class="grammar-detail">${grammarHtml}</p>`
    : '';
  const moodLine = mood
    ? `<p class="vocab-ex-zh">${escapeHtml(mood)}</p>`
    : '';

  return (
    `<div class="lyrics-vocab-item shufuri-explain-note" data-shufuri-explain-note="1" data-shufuri-explain-note-id="${escapeHtml(
      id,
    )}">` +
    // 默认在导出/海报模式隐藏；编辑页通过覆盖样式显示
    `<button type="button" class="shufuri-explain-note__delete" data-shufuri-explain-note-id="${escapeHtml(
      id,
    )}" aria-label="删除划词笔记" style="display:none">×</button>` +
    `<p class="vocab-line1"><span class="${vocabWordClass}">${escapeHtml(term)}</span>${meaning}</p>` +
    detail +
    moodLine +
    `</div>`
  );
}

function parseExplainNotesRoot(bodyHtml: string): {
  doc: Document;
  root: HTMLElement;
  section: HTMLElement | null;
} | null {
  if (typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(
    `<div id="shufuri-note-root">${bodyHtml}</div>`,
    'text/html',
  );
  const root = doc.getElementById('shufuri-note-root') as HTMLElement | null;
  if (!root) return null;
  const section = root.querySelector(`.${NOTES_SECTION_CLASS}`);
  return { doc, root, section: section as HTMLElement | null };
}

function noteNodesInSection(section: HTMLElement): HTMLElement[] {
  return Array.from(
    section.querySelectorAll('[data-shufuri-explain-note="1"]'),
  ).filter((n): n is HTMLElement => n instanceof HTMLElement);
}

/** 删除一条划词笔记条目（如果笔记区变空，会移除整个“划词笔记”区块） */
export function deleteExplainNoteFromBodyHtml(
  bodyHtml: string,
  noteId: string,
): string {
  if (!noteId.trim()) return bodyHtml;
  const parsed = parseExplainNotesRoot(bodyHtml);
  if (!parsed) return bodyHtml;
  const { root, section } = parsed;
  if (!section) return bodyHtml;

  const nodes = noteNodesInSection(section);
  const target = nodes.find(
    (n) => n.getAttribute('data-shufuri-explain-note-id') === noteId,
  );
  if (!target) return bodyHtml;

  target.remove();

  const remaining = noteNodesInSection(section);
  if (remaining.length === 0) {
    section.remove();
  }

  return prepareBodyHtmlForPreview(root.innerHTML);
}

/** 用 payload 替换指定 noteId 的划词笔记条目 */
export function updateExplainNoteInBodyHtml(
  bodyHtml: string,
  noteId: string,
  payload: Omit<ExplainNotePayload, 'id'> & { id?: string },
  lang?: LangCode,
): string {
  if (!noteId.trim()) return bodyHtml;
  const resolvedLang = payload.lang ?? lang ?? 'jp';
  const withId: ExplainNotePayload = { ...payload, id: noteId, lang: resolvedLang };
  const item = buildExplainNoteItemHtml(withId);
  if (!item) return bodyHtml;

  const parsed = parseExplainNotesRoot(bodyHtml);
  if (!parsed) return bodyHtml;
  const { root, section } = parsed;
  if (!section) return bodyHtml;

  const nodes = noteNodesInSection(section);
  const target = nodes.find(
    (n) => n.getAttribute('data-shufuri-explain-note-id') === noteId,
  );
  if (!target) return bodyHtml;

  const wrap = parsed.doc.createElement('div');
  wrap.innerHTML = item;
  const next = wrap.firstElementChild;
  if (!(next instanceof HTMLElement)) return bodyHtml;

  target.replaceWith(next);
  return prepareBodyHtmlForPreview(root.innerHTML);
}

/**
 * 将已写入的划词笔记词条 class 对齐到当前语种（修正早期一律 vocab-word 的韩语稿）。
 */
export function normalizeExplainNoteVocabClasses(
  bodyHtml: string,
  lang: LangCode,
): string {
  if (typeof DOMParser === 'undefined') return bodyHtml;

  const targetClass = resolvePosterClass('vocabTerm', lang);
  if (targetClass === 'vocab-word') return bodyHtml;

  const doc = new DOMParser().parseFromString(
    `<div id="shufuri-note-root">${bodyHtml}</div>`,
    'text/html',
  );
  const root = doc.getElementById('shufuri-note-root');
  if (!root) return bodyHtml;

  const section = root.querySelector(`.${NOTES_SECTION_CLASS}`);
  if (!section) return bodyHtml;

  let changed = false;
  section.querySelectorAll('.vocab-line1 .vocab-word, .vocab-line1 .vocab-word-ko, .vocab-line1 .vocab-word-cn')
    .forEach((el) => {
      if (el.classList.contains(targetClass)) return;
      el.classList.remove('vocab-word', 'vocab-word-ko', 'vocab-word-cn');
      el.classList.add(targetClass);
      changed = true;
    });

  return changed ? root.innerHTML : bodyHtml;
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
  lang?: LangCode,
): string {
  const resolvedLang = payload.lang ?? lang ?? 'jp';
  const withLang = { ...payload, lang: resolvedLang };
  const normalized = normalizeExplainNoteVocabClasses(bodyHtml, resolvedLang);
  const item = buildExplainNoteItemHtml(withLang);
  if (!item) return prepareBodyHtmlForPreview(normalized);
  return prepareBodyHtmlForPreview(appendExplainNoteToBodyHtml(normalized, item));
}
