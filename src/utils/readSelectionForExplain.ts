/**
 * 划词上下文：本句 + 相邻歌词行（去 ruby）。
 * 选区会钳制到单一语义块，避免跨段落误选。
 */

export type ExplainPickContext = {
  text: string;
  surroundingLine: string;
  prevLine: string;
  nextLine: string;
};

/** 钳制边界：细到行/词条，不含 .lyrics-group（一组含日+中） */
const EXPLAIN_SELECT_BLOCK_SELECTOR = [
  '.jp-line',
  '.ko-line',
  '.zh-line',
  '.cn-line',
  '.lyrics-vocab-item',
  '.lyrics-grammar-item',
  '.grammar-point-title',
  '.grammar-detail',
  '.grammar-ex-ja',
  '.grammar-ex-ko',
  '.grammar-ex-zh',
  '.grammar-ex-cn',
  '.vocab-ex-ja',
  '.vocab-ex-ko',
  '.vocab-ex-zh',
  '.vocab-ex-cn',
  'p',
  'h2',
  'h3',
].join(', ');

/** 去掉 ruby 注音（rt/rp），避免基字+假名粘连 */
export function textWithoutRubyNotes(root: Node): string {
  const walk = (n: Node): string => {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? '';
    if (
      n.nodeType === Node.DOCUMENT_FRAGMENT_NODE ||
      n.nodeType === Node.ELEMENT_NODE
    ) {
      const el = n as Element | DocumentFragment;
      if (n.nodeType === Node.ELEMENT_NODE) {
        const tag = (n as Element).tagName;
        if (tag === 'RT' || tag === 'RP') return '';
      }
      let out = '';
      for (const child of Array.from(el.childNodes)) out += walk(child);
      return out;
    }
    return '';
  };
  return walk(root).replace(/\s+/g, ' ').trim();
}

function lineText(el: Element | null): string {
  if (!el) return '';
  return textWithoutRubyNotes(el);
}

function peerSelectorFor(line: HTMLElement): string {
  if (line.classList.contains('jp-line')) return '.jp-line';
  if (line.classList.contains('ko-line')) return '.ko-line';
  return '.zh-line, .cn-line';
}

function elementFromNode(node: Node | null): Element | null {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : node.parentElement;
}

/** 最近语义可选块（不含 lyrics-group） */
export function findExplainSelectBlock(node: Node | null): HTMLElement | null {
  const el = elementFromNode(node);
  return (el?.closest(EXPLAIN_SELECT_BLOCK_SELECTOR) as HTMLElement | null) ?? null;
}

/**
 * 跨块选区收回到 anchor 所在块内（拖选起点）。
 * @returns 是否仍有非空选区
 */
export function clampSelectionToExplainBlock(sel: Selection): boolean {
  if (!sel || sel.isCollapsed || sel.rangeCount < 1) return false;

  const anchorBlock = findExplainSelectBlock(sel.anchorNode);
  if (!anchorBlock) return false;

  const focusBlock = findExplainSelectBlock(sel.focusNode);
  if (focusBlock === anchorBlock) return true;

  try {
    const original = sel.getRangeAt(0);
    const blockRange = document.createRange();
    blockRange.selectNodeContents(anchorBlock);

    // 交：max(starts) .. min(ends)
    const startAfterBlock =
      original.compareBoundaryPoints(Range.START_TO_START, blockRange) <= 0;
    const endAfterBlock =
      original.compareBoundaryPoints(Range.END_TO_END, blockRange) >= 0;

    const clamped = document.createRange();
    if (startAfterBlock) {
      clamped.setStart(blockRange.startContainer, blockRange.startOffset);
    } else {
      clamped.setStart(original.startContainer, original.startOffset);
    }
    if (endAfterBlock) {
      clamped.setEnd(blockRange.endContainer, blockRange.endOffset);
    } else {
      clamped.setEnd(original.endContainer, original.endOffset);
    }

    // 起点晚于终点 → 无交集
    if (clamped.collapsed || clamped.compareBoundaryPoints(Range.START_TO_END, clamped) >= 0) {
      return false;
    }
    if (!textWithoutRubyNotes(clamped.cloneContents())) return false;

    sel.removeAllRanges();
    sel.addRange(clamped);
    return true;
  } catch {
    return false;
  }
}

/**
 * 从编辑画布选区读取划选 + 前后句。
 */
export function readSelectionForExplain(): ExplainPickContext | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount < 1) return null;

  if (!clampSelectionToExplainBlock(sel)) return null;
  if (sel.isCollapsed || sel.rangeCount < 1) return null;

  const frag = sel.getRangeAt(0).cloneContents();
  const text = textWithoutRubyNotes(frag);
  if (!text) return null;

  const block = findExplainSelectBlock(sel.anchorNode);
  const surroundingLine = block ? lineText(block) : text;

  let prevLine = '';
  let nextLine = '';

  const lyricLine = block?.matches('.jp-line, .zh-line, .ko-line, .cn-line')
    ? block
    : (elementFromNode(sel.anchorNode)?.closest(
        '.jp-line, .zh-line, .ko-line, .cn-line',
      ) as HTMLElement | null);

  if (lyricLine) {
    const root = lyricLine.closest('.fv-body-h, .fv-edit-document-root, .edit-canvas-scroll');
    const all = root
      ? Array.from(root.querySelectorAll<HTMLElement>(peerSelectorFor(lyricLine)))
      : [];
    const idx = all.indexOf(lyricLine);
    if (idx >= 0) {
      prevLine = idx > 0 ? lineText(all[idx - 1]!) : '';
      nextLine = idx < all.length - 1 ? lineText(all[idx + 1]!) : '';
    }
  }

  return { text, surroundingLine, prevLine, nextLine };
}
