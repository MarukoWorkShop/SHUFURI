/**
 * 划词上下文：本句 + 相邻歌词行（去 ruby）。
 * 选区会钳制到单一语义块，避免跨段落误选。
 * 日语可选：Kuromoji 词界吸附，减少半句乱选。
 */

import {
  isContentPos,
  isSkippablePos,
  tokenizeJapanese,
  type KuromojiToken,
} from '../services/dict/kuromojiTokenizer';

export type ExplainPickContext = {
  text: string;
  surroundingLine: string;
  prevLine: string;
  nextLine: string;
};

export type ReadSelectionForExplainOptions = {
  /** 日语行松手后吸附到 Kuromoji 词界 */
  enableJapaneseTokenSnap?: boolean;
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

/** 日语吸附目标块 */
const JP_SNAP_BLOCK_SELECTOR = [
  '.jp-line',
  '.grammar-ex-ja',
  '.vocab-ex-ja',
  '.grammar-title-ja',
].join(', ');

type DomPoint = { node: Text; offset: number };

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

/**
 * 基字串 + 每字符 DOM 锚点（跳过 rt/rp 与空白），供词界偏移映射。
 */
export function collectJpPlainPoints(root: Node): { text: string; points: DomPoint[] } {
  const points: DomPoint[] = [];
  let text = '';
  const walk = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const tn = n as Text;
      const s = tn.textContent ?? '';
      for (let i = 0; i < s.length; i++) {
        const ch = s[i]!;
        if (/\s/u.test(ch)) continue;
        points.push({ node: tn, offset: i });
        text += ch;
      }
      return;
    }
    if (n.nodeType === Node.ELEMENT_NODE) {
      const tag = (n as Element).tagName;
      if (tag === 'RT' || tag === 'RP') return;
    }
    for (const child of Array.from(n.childNodes)) walk(child);
  };
  walk(root);
  return { text, points };
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

function isJpSnapBlock(block: HTMLElement | null): block is HTMLElement {
  return !!block?.matches(JP_SNAP_BLOCK_SELECTOR);
}

/** 将 DOM 位置映射到基字串偏移（插入点：位于该字符之前） */
function plainOffsetBefore(
  points: DomPoint[],
  container: Node,
  offset: number,
): number {
  if (!points.length) return 0;

  if (container.nodeType === Node.TEXT_NODE) {
    const textNode = container as Text;
    let lastInNode = -1;
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      if (p.node !== textNode) {
        if (lastInNode >= 0) break;
        continue;
      }
      lastInNode = i;
      if (p.offset >= offset) return i;
    }
    if (lastInNode >= 0) {
      const last = points[lastInNode]!;
      if (offset > last.offset) return lastInNode + 1;
      return lastInNode;
    }
  }

  try {
    const block = points[0]!.node.parentElement?.closest(EXPLAIN_SELECT_BLOCK_SELECTOR);
    if (!block) return points.length;
    const pre = document.createRange();
    pre.selectNodeContents(block);
    pre.setEnd(container, offset);
    const prefix = collectJpPlainPoints(pre.cloneContents()).text;
    return Math.min(Math.max(0, prefix.length), points.length);
  } catch {
    return points.length;
  }
}

function applyPlainRangeToSelection(
  sel: Selection,
  points: DomPoint[],
  start: number,
  end: number,
): boolean {
  if (start < 0 || end > points.length || start >= end) return false;
  const a = points[start]!;
  const b = points[end - 1]!;
  try {
    const range = document.createRange();
    range.setStart(a.node, a.offset);
    range.setEnd(b.node, b.offset + 1);
    if (range.collapsed) return false;
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  } catch {
    return false;
  }
}

type TokenSpan = { start: number; end: number; token: KuromojiToken };

function buildTokenSpans(tokens: KuromojiToken[]): TokenSpan[] {
  const spans: TokenSpan[] = [];
  let offset = 0;
  for (const token of tokens) {
    const surface = token.surface_form.replace(/\s+/g, '');
    if (!surface) continue;
    spans.push({ start: offset, end: offset + surface.length, token });
    offset += surface.length;
  }
  return spans;
}

/** 将 [start,end) 扩到完整 token；短选时内容词吸附紧随助词 */
export function expandOffsetsToTokenBounds(
  tokens: KuromojiToken[],
  start: number,
  end: number,
): { start: number; end: number } {
  const spans = buildTokenSpans(tokens);
  if (!spans.length) return { start, end };

  let s = start;
  let e = end;
  if (s > e) [s, e] = [e, s];

  // 折叠点击：落到所在 token
  if (s === e) {
    const hit =
      spans.find((sp) => sp.start <= s && s < sp.end) ??
      spans.find((sp) => sp.start <= s && s <= sp.end) ??
      spans[spans.length - 1]!;
    s = hit.start;
    e = hit.end;
  } else {
    let snapS = e;
    let snapE = s;
    let any = false;
    for (const sp of spans) {
      if (sp.end > s && sp.start < e) {
        any = true;
        snapS = Math.min(snapS, sp.start);
        snapE = Math.max(snapE, sp.end);
      }
    }
    if (!any) {
      const hit =
        spans.find((sp) => sp.start <= s && s < sp.end) ?? spans[0]!;
      return { start: hit.start, end: hit.end };
    }
    s = snapS;
    e = snapE;
  }

  // 短选：单一内容词 → 吞掉紧随 助詞/助動詞
  const covered = spans.filter((sp) => sp.start >= s && sp.end <= e);
  const contentCovered = covered.filter(
    (sp) => isContentPos(sp.token.pos) && !isSkippablePos(sp.token.pos),
  );
  if (contentCovered.length === 1 && covered.length <= 2) {
    const content = contentCovered[0]!;
    let ext = content.end;
    for (const sp of spans) {
      if (sp.start < content.end) continue;
      if (sp.start > ext) break;
      const pos = sp.token.pos;
      if (pos === '助詞' || pos === '助動詞') {
        ext = sp.end;
        continue;
      }
      break;
    }
    return { start: content.start, end: Math.max(e, ext) };
  }

  return { start: s, end: e };
}

/**
 * 将当前选区吸附到日语词界（原地改 Selection）。
 * @returns 是否完成吸附
 */
export async function snapSelectionToJapaneseTokens(sel: Selection): Promise<boolean> {
  if (!sel || sel.rangeCount < 1) return false;
  const block = findExplainSelectBlock(sel.anchorNode);
  if (!isJpSnapBlock(block)) return false;

  const { text, points } = collectJpPlainPoints(block);
  if (!text || !points.length) return false;

  const range = sel.getRangeAt(0);
  let start = plainOffsetBefore(points, range.startContainer, range.startOffset);
  let end = plainOffsetBefore(points, range.endContainer, range.endOffset);
  if (start > end) [start, end] = [end, start];

  let tokens: KuromojiToken[];
  try {
    tokens = await tokenizeJapanese(text);
  } catch (err) {
    console.warn('[explain-snap] kuromoji failed', err);
    return false;
  }
  if (!tokens.length) return false;

  const joined = tokens.map((t) => t.surface_form.replace(/\s+/g, '')).join('');
  if (joined !== text) {
    // 分词结果与基字串不一致时不强行改选区
    return false;
  }

  const snapped = expandOffsetsToTokenBounds(tokens, start, end);
  return applyPlainRangeToSelection(sel, points, snapped.start, snapped.end);
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
 * 日语可开启词界吸附（async）。
 */
export async function readSelectionForExplain(
  opts?: ReadSelectionForExplainOptions,
): Promise<ExplainPickContext | null> {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount < 1) return null;

  const enableSnap = opts?.enableJapaneseTokenSnap === true;

  // 非折叠：先钳行；折叠点击：若在日语块内则靠吸附扩词
  if (!sel.isCollapsed) {
    if (!clampSelectionToExplainBlock(sel)) return null;
  } else if (!enableSnap || !isJpSnapBlock(findExplainSelectBlock(sel.anchorNode))) {
    return null;
  }

  if (enableSnap) {
    await snapSelectionToJapaneseTokens(sel);
  }

  if (sel.isCollapsed || sel.rangeCount < 1) return null;
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
