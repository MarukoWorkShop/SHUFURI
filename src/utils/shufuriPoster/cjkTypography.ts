/**
 * CJK 排版：避头尾、单字/孤标点不成行。
 * 预览与导出共用同一套 CSS 与测量修复逻辑。
 */

export const CJK_NO_BREAK_CLASS = 'cjk-no-break';

/** 页级排版收紧下限（与分页 spacingScale 联动） */
export const CJK_TYPOGRAPHY_SCALE_MIN = 0.85;

export const CJK_TYPOGRAPHY_SCALE_STEPS = [
  1.0, 0.98, 0.96, 0.94, 0.92, 0.9, 0.88, 0.86, 0.85,
] as const;

/** 需应用避头尾规则的正文行选择器（相对 fv-body-h） */
export const CJK_LINE_BREAK_SELECTOR = [
  '.cn-line',
  '.jp-line',
  '.ko-line',
  '.zh-line',
  '.vocab-word-cn',
  '.vocab-ex-cn',
  '.grammar-title-cn',
  '.grammar-ex-cn',
  '.vocab-ex-ja',
  '.grammar-ex-ja',
  '.vocab-ex-ko',
  '.grammar-ex-ko',
  '.vocab-ex-zh',
  '.grammar-ex-zh',
  '.vocab-line1',
  'h3.grammar-point-title',
].join(',');

const CJK_LETTER_RE =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/u;

/** 避头：禁止出现在行首 */
const LINE_HEAD_FORBIDDEN_RE =
  /^[),.;:!?%}\]°·'"‰′″、。，．：；？！…—・」』）】〉》〕〗〙〛ゝゞーヽヾ々〆〇〉》\]]/u;

/** 避尾：禁止出现在行尾 */
const LINE_TAIL_FORBIDDEN_RE =
  /[(\[{‘“'"‵′〈《「『【〔〖（［｛「『【〈《（\[]$/u;

const PUNCT_ONLY_RE =
  /^[,.;:!?%°·'"、。，．：；？！…—・「」『』（）【】〈〉《》〔〕〖〗〙〛ゝゞーヽヾ々〆〇]+$/u;

export function isCjkLetter(ch: string): boolean {
  return CJK_LETTER_RE.test(ch);
}

export function lineViolatesCjkRules(line: string): boolean {
  const t = line.trim();
  if (!t) {
    return false;
  }
  if (t.length === 1) {
    return isCjkLetter(t) || PUNCT_ONLY_RE.test(t);
  }
  if (LINE_HEAD_FORBIDDEN_RE.test(t)) {
    return true;
  }
  if (LINE_TAIL_FORBIDDEN_RE.test(t)) {
    return true;
  }
  return false;
}

/** spacingScale<1 时略微缩小字号、收紧字距（行距由调用方 spacingScale 处理） */
export function cjkFontScale(spacingScale: number): number {
  const s = Math.max(CJK_TYPOGRAPHY_SCALE_MIN, Math.min(1, spacingScale));
  if (s >= 1) {
    return 1;
  }
  return 1 - (1 - s) * 0.35;
}

export function cjkLetterSpacingEm(spacingScale: number): string {
  const s = Math.max(CJK_TYPOGRAPHY_SCALE_MIN, Math.min(1, spacingScale));
  if (s >= 1) {
    return '0';
  }
  const em = -((1 - s) * 0.12);
  return `${em.toFixed(4)}em`;
}

/** CJK 正文换行与避头尾 CSS 片段 */
export function buildCjkWrapCss(): string {
  return `
    line-break: strict;
    word-break: keep-all;
    overflow-wrap: break-word;
    white-space: normal;
    text-wrap: pretty;
    hanging-punctuation: allow-end;
  `;
}

/** 西文辅助行（释义等） */
export function buildLatinWrapCss(): string {
  return `
    line-break: auto;
    word-break: break-word;
    overflow-wrap: break-word;
    white-space: normal;
    text-wrap: pretty;
  `;
}

export function buildCjkNoBreakClassCss(): string {
  return `
  .fv-html-poster-root .fv-body-h .${CJK_NO_BREAK_CLASS} {
    white-space: nowrap;
    word-break: keep-all;
    line-break: strict;
  }`;
}

export function collectInlineUnits(root: HTMLElement): HTMLElement[] {
  const units: HTMLElement[] = [];
  const visit = (node: Node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    if (node.classList.contains(CJK_NO_BREAK_CLASS)) {
      units.push(node);
      return;
    }
    if (node.classList.contains('zh-char-slot') || node.tagName === 'RUBY') {
      units.push(node);
      return;
    }
    for (const child of node.childNodes) {
      visit(child);
    }
  };
  visit(root);
  return units;
}

function groupUnitsByVisualLine(units: HTMLElement[]): HTMLElement[][] {
  if (units.length === 0) {
    return [];
  }
  const lines: HTMLElement[][] = [];
  let current: HTMLElement[] = [];
  let lastTop = units[0]!.getBoundingClientRect().top;
  const threshold = 2;
  for (const unit of units) {
    const top = unit.getBoundingClientRect().top;
    if (current.length > 0 && Math.abs(top - lastTop) > threshold) {
      lines.push(current);
      current = [];
    }
    current.push(unit);
    lastTop = top;
  }
  if (current.length > 0) {
    lines.push(current);
  }
  return lines;
}

function collectVisualLinesByCharRange(element: HTMLElement): string[] {
  const doc = element.ownerDocument;
  const range = doc.createRange();
  const lines: string[] = [];
  let currentTop = -1;
  let current = '';

  const flush = () => {
    if (current.trim()) {
      lines.push(current);
    }
    current = '';
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      for (let i = 0; i < text.length; i += 1) {
        const ch = text[i]!;
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rect = range.getBoundingClientRect();
        if (currentTop >= 0 && Math.abs(rect.top - currentTop) > 2) {
          flush();
        }
        currentTop = rect.top;
        current += ch;
      }
      return;
    }
    if (node instanceof HTMLElement && node.tagName === 'RT') {
      return;
    }
    for (const child of node.childNodes) {
      walk(child);
    }
  };

  walk(element);
  flush();
  return lines;
}

export function collectVisualLines(element: HTMLElement): string[] {
  if (!element.isConnected) {
    return [];
  }
  const units = collectInlineUnits(element);
  if (units.length > 0) {
    return groupUnitsByVisualLine(units)
      .map((lineUnits) => lineUnits.map((u) => u.textContent ?? '').join(''))
      .filter((line) => line.trim().length > 0);
  }
  return collectVisualLinesByCharRange(element);
}

export function elementHasCjkLineViolations(element: HTMLElement): boolean {
  return collectVisualLines(element).some(lineViolatesCjkRules);
}

function wrapUnitsInNoBreak(units: HTMLElement[]): void {
  if (units.length < 2) {
    return;
  }
  const parent = units[0]!.parentNode;
  if (!parent) {
    return;
  }
  const span = units[0]!.ownerDocument.createElement('span');
  span.className = CJK_NO_BREAK_CLASS;
  parent.insertBefore(span, units[0]!);
  for (const unit of units) {
    span.appendChild(unit);
  }
}

function repairByUnits(element: HTMLElement): boolean {
  const units = collectInlineUnits(element);
  if (units.length < 2) {
    return false;
  }
  const lineGroups = groupUnitsByVisualLine(units);
  const lines = lineGroups.map((g) => g.map((u) => u.textContent ?? '').join(''));

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (!lineViolatesCjkRules(line)) {
      continue;
    }

    if (i > 0) {
      const prev = lineGroups[i - 1]!;
      const cur = lineGroups[i]!;
      const joinCount =
        cur.length === 1 || LINE_HEAD_FORBIDDEN_RE.test(line.trim())
          ? 1
          : LINE_TAIL_FORBIDDEN_RE.test(lines[i - 1]!.trimEnd())
            ? 1
            : 1;
      const fromPrev = prev.slice(-joinCount);
      const fromCur = cur.slice(0, 1);
      wrapUnitsInNoBreak([...fromPrev, ...fromCur]);
      return true;
    }

    if (lineGroups[i]!.length >= 2) {
      wrapUnitsInNoBreak(lineGroups[i]!.slice(0, 2));
      return true;
    }
  }
  return false;
}

function repairByCharRange(element: HTMLElement): boolean {
  const doc = element.ownerDocument;
  const range = doc.createRange();
  type CharPos = { node: Text; offset: number; top: number };
  const chars: CharPos[] = [];

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      const text = textNode.textContent ?? '';
      for (let i = 0; i < text.length; i += 1) {
        range.setStart(textNode, i);
        range.setEnd(textNode, i + 1);
        chars.push({ node: textNode, offset: i, top: range.getBoundingClientRect().top });
      }
      return;
    }
    if (node instanceof HTMLElement && node.tagName === 'RT') {
      return;
    }
    for (const child of node.childNodes) {
      walk(child);
    }
  };
  walk(element);
  if (chars.length < 2) {
    return false;
  }

  const lineGroups: CharPos[][] = [];
  let cur: CharPos[] = [];
  let lastTop = chars[0]!.top;
  for (const c of chars) {
    if (cur.length > 0 && Math.abs(c.top - lastTop) > 2) {
      lineGroups.push(cur);
      cur = [];
    }
    cur.push(c);
    lastTop = c.top;
  }
  if (cur.length > 0) {
    lineGroups.push(cur);
  }

  const lines = lineGroups.map((g) =>
    g.map((c) => (c.node.textContent ?? '')[c.offset] ?? '').join(''),
  );

  for (let i = 0; i < lines.length; i += 1) {
    if (!lineViolatesCjkRules(lines[i]!)) {
      continue;
    }
    if (i > 0) {
      const a = lineGroups[i - 1]!.at(-1)!;
      const b = lineGroups[i]![0]!;
      return wrapCharPair(doc, a, b);
    }
    if (lineGroups[i]!.length >= 2) {
      return wrapCharPair(doc, lineGroups[i]![0]!, lineGroups[i]![1]!);
    }
  }
  return false;
}

function wrapCharPair(
  doc: Document,
  a: { node: Text; offset: number },
  b: { node: Text; offset: number },
): boolean {
  const span = doc.createElement('span');
  span.className = CJK_NO_BREAK_CLASS;

  if (a.node === b.node) {
    const start = Math.min(a.offset, b.offset);
    const end = Math.max(a.offset, b.offset);
    if (end - start < 1) {
      return false;
    }
    const tail = a.node.splitText(start);
    const after = tail.splitText(end - start + 1);
    span.appendChild(tail);
    a.node.parentNode?.insertBefore(span, after);
    return true;
  }

  if (b.node.compareDocumentPosition(a.node) & Node.DOCUMENT_POSITION_FOLLOWING) {
    return wrapCharPair(doc, b, a);
  }

  const parent = a.node.parentNode;
  if (!parent) {
    return false;
  }
  const leftChar = a.node.splitText(a.offset);
  const rightChar = b.node.splitText(b.offset);
  parent.insertBefore(span, leftChar);
  span.appendChild(leftChar);
  span.appendChild(rightChar);
  return true;
}

/** 在已挂载 DOM 上修复一处违例；返回是否修改 */
export function applyCjkNoBreakGuards(element: HTMLElement): boolean {
  if (!element.isConnected) {
    return false;
  }
  if (repairByUnits(element)) {
    return true;
  }
  return repairByCharRange(element);
}

export function repairAllCjkLineBreaks(root: ParentNode, maxPasses = 16): boolean {
  let changed = false;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    let passChanged = false;
    const lines = root.querySelectorAll(CJK_LINE_BREAK_SELECTOR);
    for (const node of lines) {
      if (node instanceof HTMLElement && applyCjkNoBreakGuards(node)) {
        passChanged = true;
        changed = true;
        break;
      }
    }
    if (!passChanged) {
      break;
    }
  }
  return changed;
}

export function countCjkLineBreakViolations(root: ParentNode): number {
  let count = 0;
  const lines = root.querySelectorAll(CJK_LINE_BREAK_SELECTOR);
  for (const node of lines) {
    if (node instanceof HTMLElement && elementHasCjkLineViolations(node)) {
      count += 1;
    }
  }
  return count;
}
