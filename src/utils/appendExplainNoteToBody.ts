import type { LangCode } from '../services/appSettings';
import { resolvePosterClass } from '../codec/masterHandbook';
import { nanoid } from 'nanoid';
import { escapeHtml } from './escapeHtml';
import { prepareBodyHtmlForPreview } from './inkEditUtils';

export type ExplainNotePayload = {
  /** 单条笔记的唯一标识（编辑/删除定位用）；旧笔记可能没有 id */
  id?: string;
  term: string;
  contextSense: string;
  grammar?: string;
  /** 语法分子式（如「[语素|标签] + [语素|标签]」），保存与导出时保留 */
  formula?: string;
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
  const formula = payload.formula?.trim() || '';
  const formulaLine = formula
    ? `<p class="vocab-formula">${escapeHtml(formula)}</p>`
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
    formulaLine +
    detail +
    moodLine +
    `</div>`
  );
}

/**
 * 在内存节点上解析正文，避免 `parseFromString('<div>'+bodyHtml+'</div>')`
 * 在标签不严格时把内容甩到 root 外导致 innerHTML 丢正文。
 */
function parseExplainNotesRoot(bodyHtml: string): {
  root: HTMLElement;
  host: HTMLElement;
  section: HTMLElement | null;
} | null {
  if (typeof document === 'undefined') return null;
  const root = document.createElement('div');
  root.innerHTML = bodyHtml;

  // 笔记必须写在 clip-body 内；若历史数据把笔记挂成兄弟节点，先并回 clip-body
  const clip = Array.from(root.children).find(
    (n): n is HTMLElement =>
      n instanceof HTMLElement &&
      (n.classList.contains('clip-body') || n.classList.contains('lyrics-notes-body')),
  );
  if (clip) {
    for (const kid of Array.from(root.children)) {
      if (kid !== clip) {
        clip.appendChild(kid);
      }
    }
  }
  const host = clip ?? root;

  const section = host.querySelector(`.${NOTES_SECTION_CLASS}`);
  return { root, host, section: section as HTMLElement | null };
}

function noteNodesInSection(section: HTMLElement): HTMLElement[] {
  return Array.from(
    section.querySelectorAll('[data-shufuri-explain-note="1"]'),
  ).filter((n): n is HTMLElement => n instanceof HTMLElement);
}

export type ExplainNoteListItem = {
  id: string;
  term: string;
  contextSense: string;
  grammar: string;
  formula: string;
  mood: string;
};

/** 从正文解析划词笔记列表（桌面笔记本页镜像；不另持久化） */
export function listExplainNotesFromBodyHtml(bodyHtml: string): ExplainNoteListItem[] {
  const parsed = parseExplainNotesRoot(bodyHtml);
  if (!parsed?.section) return [];

  return noteNodesInSection(parsed.section).map((note, index) => {
    const id =
      note.getAttribute('data-shufuri-explain-note-id')?.trim() || `orphan-${index}`;
    const term =
      (
        note.querySelector(
          '.vocab-line1 .vocab-word, .vocab-line1 .vocab-word-ko, .vocab-line1 .vocab-word-cn',
        ) as HTMLElement | null
      )?.textContent?.trim() ?? '';
    const contextSense =
      (note.querySelector('.vocab-line1 .vocab-meaning') as HTMLElement | null)?.textContent?.trim() ??
      '';
    const grammar =
      (note.querySelector('.grammar-detail') as HTMLElement | null)?.textContent?.trim() ?? '';
    const formula =
      (note.querySelector('.vocab-formula') as HTMLElement | null)?.textContent?.trim() ?? '';
    const mood =
      (note.querySelector('.vocab-ex-zh') as HTMLElement | null)?.textContent?.trim() ?? '';
    return { id, term, contextSense, grammar, formula, mood };
  });
}

function serializeExplainNotesRoot(root: HTMLElement): string {
  // 若仅有单个 clip-body 子节点，写回时保持单一根（与 normalizeLyricsBodyHtml 一致）
  if (
    root.children.length === 1 &&
    root.firstElementChild instanceof HTMLElement &&
    (root.firstElementChild.classList.contains('clip-body') ||
      root.firstElementChild.classList.contains('lyrics-notes-body'))
  ) {
    return root.innerHTML;
  }
  return root.innerHTML;
}

function ensureNoteDeleteButton(note: HTMLElement, noteId: string): boolean {
  let btn = note.querySelector('.shufuri-explain-note__delete') as HTMLElement | null;
  if (!btn) {
    btn = document.createElement('button');
    (btn as HTMLButtonElement).type = 'button';
    btn.className = 'shufuri-explain-note__delete';
    btn.setAttribute('aria-label', '删除划词笔记');
    btn.setAttribute('style', 'display:none');
    btn.textContent = '×';
    note.insertBefore(btn, note.firstChild);
    btn.setAttribute('data-shufuri-explain-note-id', noteId);
    return true;
  }
  if (btn.getAttribute('data-shufuri-explain-note-id') !== noteId) {
    btn.setAttribute('data-shufuri-explain-note-id', noteId);
    return true;
  }
  return false;
}

/**
 * 为缺少 id / 删除按钮的旧划词笔记补齐，便于编辑页点选与删除。
 * 不调用 prepareBodyHtmlForPreview，避免与 inkEditUtils 循环依赖。
 */
export function ensureExplainNoteIdsInBodyHtml(bodyHtml: string): string {
  if (!bodyHtml.trim() || typeof document === 'undefined') return bodyHtml;
  const parsed = parseExplainNotesRoot(bodyHtml);
  if (!parsed?.section) return bodyHtml;

  let changed = false;
  for (const note of noteNodesInSection(parsed.section)) {
    let id = note.getAttribute('data-shufuri-explain-note-id')?.trim() ?? '';
    if (!id) {
      id = nanoid();
      note.setAttribute('data-shufuri-explain-note-id', id);
      changed = true;
    }
    if (ensureNoteDeleteButton(note, id)) changed = true;
  }

  return changed ? serializeExplainNotesRoot(parsed.root) : bodyHtml;
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

  return prepareBodyHtmlForPreview(serializeExplainNotesRoot(root));
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

  const wrap = document.createElement('div');
  wrap.innerHTML = item;
  const next = wrap.firstElementChild;
  if (!(next instanceof HTMLElement)) return bodyHtml;

  target.replaceWith(next);
  return prepareBodyHtmlForPreview(serializeExplainNotesRoot(root));
}

/**
 * 将已写入的划词笔记词条 class 对齐到当前语种（修正早期一律 vocab-word 的韩语稿）。
 */
export function normalizeExplainNoteVocabClasses(
  bodyHtml: string,
  lang: LangCode,
): string {
  const targetClass = resolvePosterClass('vocabTerm', lang);
  if (targetClass === 'vocab-word') return bodyHtml;

  const parsed = parseExplainNotesRoot(bodyHtml);
  if (!parsed) return bodyHtml;
  const { root, section } = parsed;
  if (!section) return bodyHtml;

  let changed = false;
  section
    .querySelectorAll(
      '.vocab-line1 .vocab-word, .vocab-line1 .vocab-word-ko, .vocab-line1 .vocab-word-cn',
    )
    .forEach((el) => {
      if (el.classList.contains(targetClass)) return;
      el.classList.remove('vocab-word', 'vocab-word-ko', 'vocab-word-cn');
      el.classList.add(targetClass);
      changed = true;
    });

  // 即便 class 未变，也可能刚把笔记兄弟节点并回 clip-body，需要写回
  const next = serializeExplainNotesRoot(root);
  if (!changed && next === bodyHtml) return bodyHtml;
  return next;
}

/**
 * 将笔记条追加到正文末尾的「划词笔记」区（无则新建，样式同 lyrics-vocabulary）。
 * 必须挂在 `.clip-body` 内部，否则分页会把整块 clip-body 当成单一 atom，导致全书挤进第 1 页。
 */
export function appendExplainNoteToBodyHtml(bodyHtml: string, itemHtml: string): string {
  const item = itemHtml.trim();
  if (!item) return bodyHtml;

  const parsed = parseExplainNotesRoot(bodyHtml);
  if (!parsed) {
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

  const { root, host } = parsed;
  let section = parsed.section;
  if (!section) {
    section = document.createElement('div');
    section.className = `lyrics-vocabulary ${NOTES_SECTION_CLASS}`;
    section.setAttribute('data-lyrics-force-next-page', '1');
    const h2 = document.createElement('h2');
    h2.className = 'lyrics-section-title';
    h2.textContent = NOTES_SECTION_TITLE;
    section.appendChild(h2);
    host.appendChild(section);
  }

  const wrap = document.createElement('div');
  wrap.innerHTML = item;
  const node = wrap.firstElementChild;
  if (node) section.appendChild(node);

  return serializeExplainNotesRoot(root);
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
