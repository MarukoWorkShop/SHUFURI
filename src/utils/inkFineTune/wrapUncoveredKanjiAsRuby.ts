import { escapeHtml } from '../escapeHtml';
import { inferPosterLangFromBodyHtml } from '../shufuriPoster/inferPosterLang';

/** 与 rubyMarkup.repairShorthandRubyMarkup 对齐的汉字类 */
const KANJI_RUN_RE = /[\u4e00-\u9fff々〆ヵヶ]+/g;

export const INK_EMPTY_RT_ATTR = 'data-ink-empty-rt';

function isInsideRubyLike(node: Node): boolean {
  let cur: Node | null = node.parentNode;
  while (cur) {
    if (cur.nodeType === 1) {
      const tag = (cur as Element).tagName;
      if (tag === 'RUBY' || tag === 'RT' || tag === 'RP') return true;
    }
    cur = cur.parentNode;
  }
  return false;
}

function replaceTextNodeWithKanjiRubies(textNode: Text, doc: Document): void {
  const raw = textNode.nodeValue ?? '';
  if (!raw || !KANJI_RUN_RE.test(raw)) {
    KANJI_RUN_RE.lastIndex = 0;
    return;
  }
  KANJI_RUN_RE.lastIndex = 0;

  const frag = doc.createDocumentFragment();
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = KANJI_RUN_RE.exec(raw)) !== null) {
    if (m.index > last) {
      frag.appendChild(doc.createTextNode(raw.slice(last, m.index)));
    }
    const ruby = doc.createElement('ruby');
    ruby.setAttribute(INK_EMPTY_RT_ATTR, '1');
    // 基字用 textContent；rt 保持空元素
    ruby.appendChild(doc.createTextNode(m[0]!));
    ruby.appendChild(doc.createElement('rt'));
    frag.appendChild(ruby);
    last = m.index + m[0]!.length;
  }
  if (last < raw.length) {
    frag.appendChild(doc.createTextNode(raw.slice(last)));
  }
  textNode.replaceWith(frag);
}

/**
 * 将日语歌词行中未被 ruby 覆盖的汉字 run 包装为可编辑空注音：
 * `<ruby data-ink-empty-rt="1">漢字<rt></rt></ruby>`
 *
 * 仅处理 `.lyrics-group .jp-line`；幂等；先收集 Text 再修改，避免 TreeWalker 变异。
 */
export function wrapUncoveredKanjiAsRuby(bodyHtml: string): string {
  if (!bodyHtml.trim()) return bodyHtml;
  if (inferPosterLangFromBodyHtml(bodyHtml) !== 'jp') return bodyHtml;

  const doc = new DOMParser().parseFromString(
    `<div id="ink-wrap-kanji-root">${bodyHtml}</div>`,
    'text/html',
  );
  const root = doc.getElementById('ink-wrap-kanji-root');
  if (!root) return bodyHtml;

  const lines = root.querySelectorAll('.lyrics-group .jp-line');
  if (lines.length === 0) return bodyHtml;

  const pending: Text[] = [];
  for (const line of lines) {
    const walker = doc.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      const text = node as Text;
      if (text.nodeValue && !isInsideRubyLike(text)) {
        pending.push(text);
      }
      node = walker.nextNode();
    }
  }

  for (const text of pending) {
    if (text.parentNode == null) continue;
    replaceTextNodeWithKanjiRubies(text, doc);
  }

  return root.innerHTML;
}

/** 测试辅助：构造空 ruby 的期望 HTML 片段 */
export function emptyKanjiRubyHtml(kanji: string): string {
  return `<ruby ${INK_EMPTY_RT_ATTR}="1">${escapeHtml(kanji)}<rt></rt></ruby>`;
}
