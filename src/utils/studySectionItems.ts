/**
 * 重点词汇 / 重点语法：条目级删除与编辑（复用划词笔记交互模式）
 */
import { nanoid } from 'nanoid';
import { prepareBodyHtmlForPreview } from './inkEditUtils';

export type StudyItemKind = 'vocab' | 'grammar';

export type VocabItemPayload = {
  term: string;
  meaning: string;
  example: string;
  translation: string;
};

export type GrammarItemPayload = {
  titlePrimary: string;
  titleSecondary: string;
  detail: string;
  example: string;
  translation: string;
};

const STUDY_ID_ATTR = 'data-shufuri-study-id';
const STUDY_KIND_ATTR = 'data-shufuri-study-kind';
const DELETE_CLASS = 'shufuri-study-item__delete';

function parseBodyRoot(bodyHtml: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const root = document.createElement('div');
  root.innerHTML = bodyHtml;
  const clip = Array.from(root.children).find(
    (n): n is HTMLElement =>
      n instanceof HTMLElement &&
      (n.classList.contains('clip-body') || n.classList.contains('lyrics-notes-body')),
  );
  if (clip) {
    for (const kid of Array.from(root.children)) {
      if (kid !== clip) clip.appendChild(kid);
    }
  }
  return root;
}

function serializeBodyRoot(root: HTMLElement): string {
  return root.innerHTML;
}

function isExplainNote(el: Element): boolean {
  return el.getAttribute('data-shufuri-explain-note') === '1';
}

function studyItems(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll('.lyrics-vocab-item, .lyrics-grammar-item'),
  ).filter((n): n is HTMLElement => n instanceof HTMLElement && !isExplainNote(n));
}

function ensureDeleteButton(item: HTMLElement, id: string, kind: StudyItemKind): boolean {
  let btn = item.querySelector(`.${DELETE_CLASS}`) as HTMLElement | null;
  if (!btn) {
    btn = document.createElement('button');
    (btn as HTMLButtonElement).type = 'button';
    btn.className = DELETE_CLASS;
    btn.setAttribute('style', 'display:none');
    btn.setAttribute('aria-label', kind === 'vocab' ? '删除词汇' : '删除语法点');
    btn.textContent = '×';
    item.insertBefore(btn, item.firstChild);
    btn.setAttribute(STUDY_ID_ATTR, id);
    btn.setAttribute(STUDY_KIND_ATTR, kind);
    return true;
  }
  let changed = false;
  if (btn.getAttribute(STUDY_ID_ATTR) !== id) {
    btn.setAttribute(STUDY_ID_ATTR, id);
    changed = true;
  }
  if (btn.getAttribute(STUDY_KIND_ATTR) !== kind) {
    btn.setAttribute(STUDY_KIND_ATTR, kind);
    changed = true;
  }
  return changed;
}

function kindOfItem(item: HTMLElement): StudyItemKind {
  return item.classList.contains('lyrics-grammar-item') ? 'grammar' : 'vocab';
}

/** 为重点词汇/语法条目补齐 id 与删除按钮（跳过划词笔记） */
export function ensureStudyItemIdsInBodyHtml(bodyHtml: string): string {
  if (!bodyHtml.trim()) return bodyHtml;
  const root = parseBodyRoot(bodyHtml);
  if (!root) return bodyHtml;

  let changed = false;
  for (const item of studyItems(root)) {
    const kind = kindOfItem(item);
    let id = item.getAttribute(STUDY_ID_ATTR)?.trim() ?? '';
    if (!id) {
      id = nanoid();
      item.setAttribute(STUDY_ID_ATTR, id);
      changed = true;
    }
    if (item.getAttribute(STUDY_KIND_ATTR) !== kind) {
      item.setAttribute(STUDY_KIND_ATTR, kind);
      changed = true;
    }
    if (!item.classList.contains('shufuri-study-item')) {
      item.classList.add('shufuri-study-item');
      changed = true;
    }
    if (ensureDeleteButton(item, id, kind)) changed = true;
  }

  return changed ? serializeBodyRoot(root) : bodyHtml;
}

function findStudyItem(root: HTMLElement, itemId: string): HTMLElement | null {
  return (
    studyItems(root).find((n) => n.getAttribute(STUDY_ID_ATTR) === itemId) ?? null
  );
}

function removeEmptySection(item: HTMLElement): void {
  const section = item.closest('.lyrics-vocabulary, .lyrics-grammar');
  item.remove();
  if (!(section instanceof HTMLElement)) return;
  if (section.classList.contains('lyrics-explain-notes')) return;
  const remaining = section.querySelectorAll(
    '.lyrics-vocab-item:not([data-shufuri-explain-note="1"]), .lyrics-grammar-item',
  );
  if (remaining.length === 0) section.remove();
}

export function deleteStudyItemFromBodyHtml(bodyHtml: string, itemId: string): string {
  if (!itemId.trim()) return bodyHtml;
  const root = parseBodyRoot(ensureStudyItemIdsInBodyHtml(bodyHtml));
  if (!root) return bodyHtml;
  const target = findStudyItem(root, itemId);
  if (!target) return bodyHtml;
  removeEmptySection(target);
  return prepareBodyHtmlForPreview(serializeBodyRoot(root));
}

function setOrCreateLine(
  item: HTMLElement,
  selector: string,
  tagName: 'p' | 'span',
  className: string,
  text: string,
  parent?: HTMLElement,
): void {
  const trimmed = text.trim();
  let el = item.querySelector(selector) as HTMLElement | null;
  if (!trimmed) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement(tagName);
    el.className = className;
    (parent ?? item).appendChild(el);
  }
  el.textContent = trimmed;
}

export function updateVocabItemInBodyHtml(
  bodyHtml: string,
  itemId: string,
  payload: VocabItemPayload,
): string {
  if (!itemId.trim()) return bodyHtml;
  const root = parseBodyRoot(ensureStudyItemIdsInBodyHtml(bodyHtml));
  if (!root) return bodyHtml;
  const item = findStudyItem(root, itemId);
  if (!item || kindOfItem(item) !== 'vocab') return bodyHtml;

  const term = payload.term.replace(/\s+/g, '').trim();
  if (!term) return bodyHtml;

  let line1 = item.querySelector('.vocab-line1') as HTMLElement | null;
  if (!line1) {
    line1 = document.createElement('p');
    line1.className = 'vocab-line1';
    const btn = item.querySelector(`.${DELETE_CLASS}`);
    if (btn?.nextSibling) item.insertBefore(line1, btn.nextSibling);
    else item.appendChild(line1);
  }

  let termEl = line1.querySelector(
    '[class*="vocab-word"]',
  ) as HTMLElement | null;
  if (!termEl) {
    termEl = document.createElement('span');
    termEl.className = 'vocab-word';
    line1.insertBefore(termEl, line1.firstChild);
  }
  termEl.textContent = term;

  setOrCreateLine(line1, '.vocab-meaning', 'span', 'vocab-meaning', payload.meaning, line1);

  const exPrimary =
    item.querySelector('.vocab-ex-ja, .vocab-ex-ko, .vocab-ex-cn') as HTMLElement | null;
  const exPrimaryClass =
    exPrimary?.className ||
    (item.querySelector('.vocab-ex-ko') ? 'vocab-ex-ko' : 'vocab-ex-ja');
  if (payload.example.trim()) {
    if (exPrimary) exPrimary.textContent = payload.example.trim();
    else {
      const p = document.createElement('p');
      p.className = exPrimaryClass;
      p.textContent = payload.example.trim();
      item.appendChild(p);
    }
  } else {
    exPrimary?.remove();
  }

  const exZh = item.querySelector('.vocab-ex-zh, .vocab-ex-gloss') as HTMLElement | null;
  const exZhClass = exZh?.className?.includes('gloss') ? 'vocab-ex-gloss' : 'vocab-ex-zh';
  if (payload.translation.trim()) {
    if (exZh) exZh.textContent = payload.translation.trim();
    else {
      const p = document.createElement('p');
      p.className = exZhClass;
      p.textContent = payload.translation.trim();
      item.appendChild(p);
    }
  } else {
    exZh?.remove();
  }

  return prepareBodyHtmlForPreview(serializeBodyRoot(root));
}

export function updateGrammarItemInBodyHtml(
  bodyHtml: string,
  itemId: string,
  payload: GrammarItemPayload,
): string {
  if (!itemId.trim()) return bodyHtml;
  const root = parseBodyRoot(ensureStudyItemIdsInBodyHtml(bodyHtml));
  if (!root) return bodyHtml;
  const item = findStudyItem(root, itemId);
  if (!item || kindOfItem(item) !== 'grammar') return bodyHtml;

  const primary = payload.titlePrimary.trim();
  if (!primary) return bodyHtml;

  let title = item.querySelector('h3.grammar-point-title') as HTMLElement | null;
  if (!title) {
    title = document.createElement('h3');
    title.className = 'grammar-point-title';
    const btn = item.querySelector(`.${DELETE_CLASS}`);
    if (btn?.nextSibling) item.insertBefore(title, btn.nextSibling);
    else item.insertBefore(title, item.firstChild);
  }

  let primaryEl = title.querySelector(
    '.grammar-title-ja, .grammar-title-ko, .grammar-title-cn',
  ) as HTMLElement | null;
  if (!primaryEl) {
    primaryEl = document.createElement('span');
    primaryEl.className = 'grammar-title-ja';
    title.insertBefore(primaryEl, title.firstChild);
  }
  primaryEl.textContent = primary;

  setOrCreateLine(
    title,
    '.grammar-title-zh, .grammar-title-gloss',
    'span',
    title.querySelector('.grammar-title-gloss') ? 'grammar-title-gloss' : 'grammar-title-zh',
    payload.titleSecondary,
    title,
  );

  setOrCreateLine(item, '.grammar-detail', 'p', 'grammar-detail', payload.detail);

  const exPrimary = item.querySelector(
    '.grammar-ex-ja, .grammar-ex-ko, .grammar-ex-cn',
  ) as HTMLElement | null;
  const exPrimaryClass = exPrimary?.className || 'grammar-ex-ja';
  if (payload.example.trim()) {
    if (exPrimary) exPrimary.textContent = payload.example.trim();
    else {
      const p = document.createElement('p');
      p.className = exPrimaryClass;
      p.textContent = payload.example.trim();
      item.appendChild(p);
    }
  } else {
    exPrimary?.remove();
  }

  const exZh = item.querySelector('.grammar-ex-zh, .grammar-ex-gloss') as HTMLElement | null;
  const exZhClass = exZh?.className?.includes('gloss') ? 'grammar-ex-gloss' : 'grammar-ex-zh';
  if (payload.translation.trim()) {
    if (exZh) exZh.textContent = payload.translation.trim();
    else {
      const p = document.createElement('p');
      p.className = exZhClass;
      p.textContent = payload.translation.trim();
      item.appendChild(p);
    }
  } else {
    exZh?.remove();
  }

  return prepareBodyHtmlForPreview(serializeBodyRoot(root));
}

export function readVocabItemFromElement(item: HTMLElement): VocabItemPayload {
  return {
    term:
      item
        .querySelector('.vocab-line1 [class*="vocab-word"]')
        ?.textContent?.replace(/\s+/g, '')
        .trim() ?? '',
    meaning: item.querySelector('.vocab-meaning')?.textContent?.trim() ?? '',
    example:
      item.querySelector('.vocab-ex-ja, .vocab-ex-ko, .vocab-ex-cn')?.textContent?.trim() ??
      '',
    translation:
      item.querySelector('.vocab-ex-zh, .vocab-ex-gloss')?.textContent?.trim() ?? '',
  };
}

export function readGrammarItemFromElement(item: HTMLElement): GrammarItemPayload {
  return {
    titlePrimary:
      item
        .querySelector(
          'h3.grammar-point-title .grammar-title-ja, h3.grammar-point-title .grammar-title-ko, h3.grammar-point-title .grammar-title-cn',
        )
        ?.textContent?.trim() ?? '',
    titleSecondary:
      item
        .querySelector(
          'h3.grammar-point-title .grammar-title-zh, h3.grammar-point-title .grammar-title-gloss',
        )
        ?.textContent?.trim() ?? '',
    detail: item.querySelector('.grammar-detail')?.textContent?.trim() ?? '',
    example:
      item
        .querySelector('.grammar-ex-ja, .grammar-ex-ko, .grammar-ex-cn')
        ?.textContent?.trim() ?? '',
    translation:
      item.querySelector('.grammar-ex-zh, .grammar-ex-gloss')?.textContent?.trim() ?? '',
  };
}

export type NotebookVocabEntry = VocabItemPayload & {
  id: string;
  /** 词条 HTML（可含 ruby），供笔记本展示 */
  termHtml: string;
};

export type NotebookGrammarEntry = GrammarItemPayload & {
  id: string;
  titlePrimaryHtml: string;
};

/** 桌面笔记本：列出正文内重点词汇 / 语法点（不含划词笔记） */
export function listStudyEntriesFromBodyHtml(bodyHtml: string): {
  vocab: NotebookVocabEntry[];
  grammar: NotebookGrammarEntry[];
} {
  const root = parseBodyRoot(bodyHtml);
  if (!root) return { vocab: [], grammar: [] };

  const vocab: NotebookVocabEntry[] = [];
  const grammar: NotebookGrammarEntry[] = [];

  studyItems(root).forEach((item, index) => {
    const kind = kindOfItem(item);
    const id = item.getAttribute(STUDY_ID_ATTR)?.trim() || `orphan-study-${kind}-${index}`;
    if (kind === 'vocab') {
      const payload = readVocabItemFromElement(item);
      const termHtml =
        item.querySelector('.vocab-line1 [class*="vocab-word"]')?.innerHTML?.trim() ||
        payload.term;
      vocab.push({ id, ...payload, termHtml });
      return;
    }
    const payload = readGrammarItemFromElement(item);
    const titlePrimaryHtml =
      item
        .querySelector(
          'h3.grammar-point-title .grammar-title-ja, h3.grammar-point-title .grammar-title-ko, h3.grammar-point-title .grammar-title-cn',
        )
        ?.innerHTML?.trim() || payload.titlePrimary;
    grammar.push({ id, ...payload, titlePrimaryHtml });
  });

  return { vocab, grammar };
}
