/**
 * Highlighter Brush（笔刷涂抹选词）
 *
 * 彻底替代讲解模式下的原生划词：把可讲解正文拆成字符级 span，
 * 监听 Pointer Events，用 elementFromPoint 命中手指划过的字，
 * 记录落笔首字与当前字两索引，按文档顺序圈定区间并加荧光笔高亮。
 * 松手时算出被涂文本的拼接字符串 + 起始字所在行上下文，原样喂给
 * useExplainSession.analyzeSelection（不改动 AI 解释管线）。
 *
 * 关键设计：
 * - token 在文档遍历顺序上编号，故 index 顺序即文档位置顺序，
 *   用 [min,max] 即可天然补全快速滑动漏掉的中间字。
 * - 跳过 rt/rp 注音与 .shufuri-explain-note/.shufuri-study-item，
 *   不破坏振假名布局，且笔记/学习条目内不触发笔刷。
 * - 通过 selectstart + preventDefault 禁掉原生选区，避免与原生
 *   划词 CSS（user-select）特异性冲突。
 */

import {
  findExplainSelectBlock,
  peerSelectorFor,
  textWithoutRubyNotes,
  type ExplainPickContext,
} from './readSelectionForExplain';

/** 一次涂抹允许的最大字符数，超出则钳止末端并提示 */
export const BRUSH_MAX_CHARS = 60;
export const BRUSH_TOKEN_CLASS = 'brush-token';
export const BRUSH_HIGHLIGHT_CLASS = 'brush-highlighted';

/** brush 就绪态 class（加在滚动容器 .edit-canvas-scroll 上） */
export const BRUSH_READY_CLASS = 'explain-brush-ready';
/** 正在涂抹态 class（暂停滚动用，加在滚动容器上） */
export const BRUSH_PAINTING_CLASS = 'explain-brush-painting';

/** 把可讲解正文的 HTML 拆成字符级 span，供笔刷命中。 */
export function tokenizeBrushableHtml(html: string): string {
  if (!html) return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return html;

  const SKIP = '.shufuri-explain-note, .shufuri-study-item';
  let index = 0;

  const walk = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName;
      // 注音不可拆；笔记/学习条目内不拆（点按留给条目编辑）
      if (tag === 'RT' || tag === 'RP') return;
      if (el.matches(SKIP)) return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const tn = node as Text;
      const text = tn.textContent ?? '';
      // 纯空白（含换行/缩进）保持原样，避免产生大量碎片文本节点
      if (!text.trim()) return;

      const frag = doc.createDocumentFragment();
      for (const ch of text) {
        if (/\s/u.test(ch)) {
          frag.appendChild(doc.createTextNode(ch));
        } else {
          const span = doc.createElement('span');
          span.className = BRUSH_TOKEN_CLASS;
          span.setAttribute('data-brush-index', String(index++));
          span.textContent = ch;
          frag.appendChild(span);
        }
      }
      tn.parentNode?.replaceChild(frag, tn);
      return;
    }

    for (const child of Array.from(node.childNodes)) walk(child);
  };

  walk(root);
  return root.innerHTML;
}

export type BrushSelection = {
  text: string;
  context: ExplainPickContext;
};

export type BrushControllerOptions = {
  /** 滚动容器（.edit-canvas-scroll），事件挂载与就绪/涂抹 class 加在这里 */
  root: HTMLElement;
  /** 正文容器（.fv-body-h） */
  body: HTMLElement;
  maxChars?: number;
  onSelect: (selection: BrushSelection) => void;
  onOverflow?: () => void;
};

export type BrushController = {
  destroy: () => void;
};

function buildBrushSelection(
  body: HTMLElement,
  s: number,
  e: number,
): BrushSelection | null {
  const startEl = body.querySelector<HTMLElement>(
    `.${BRUSH_TOKEN_CLASS}[data-brush-index="${s}"]`,
  );
  const endEl = body.querySelector<HTMLElement>(
    `.${BRUSH_TOKEN_CLASS}[data-brush-index="${e}"]`,
  );
  if (!startEl || !endEl) return null;

  const range = document.createRange();
  try {
    range.setStartBefore(startEl);
    range.setEndAfter(endEl);
  } catch {
    return null;
  }

  const text = textWithoutRubyNotes(range.cloneContents());
  if (!text) return null;

  const block = findExplainSelectBlock(startEl);
  const surroundingLine = block ? textWithoutRubyNotes(block) : text;

  let prevLine = '';
  let nextLine = '';
  if (block) {
    const root = block.closest(
      '.fv-body-h, .fv-edit-document-root, .edit-canvas-scroll',
    ) as HTMLElement | null;
    const line = block.matches('.jp-line, .zh-line, .ko-line, .cn-line')
      ? block
      : null;
    if (line && root) {
      const all = Array.from(
        root.querySelectorAll<HTMLElement>(peerSelectorFor(line)),
      );
      const idx = all.indexOf(line);
      if (idx >= 0) {
        prevLine = idx > 0 ? textWithoutRubyNotes(all[idx - 1]!) : '';
        nextLine = idx < all.length - 1 ? textWithoutRubyNotes(all[idx + 1]!) : '';
      }
    }
  }

  return { text, context: { text, surroundingLine, prevLine, nextLine } };
}

export function createBrushController(
  opts: BrushControllerOptions,
): BrushController {
  const { root, body, onSelect, onOverflow } = opts;
  const maxChars = opts.maxChars ?? BRUSH_MAX_CHARS;

  let painting = false;
  let startIdx = -1;
  let lastRange: [number, number] | null = null;
  let overflowToastShown = false;

  // 从事件真实 target 向上找 .brush-token：最可靠，且不受祖先
  // transform: scale 导致的 elementFromPoint 命中测试怪异影响（桌面拖拽适用）
  const walkToToken = (el: HTMLElement | null): HTMLElement | null => {
    while (el && el !== body) {
      if (el.classList?.contains(BRUSH_TOKEN_CLASS)) return el;
      el = el.parentElement;
    }
    return null;
  };

  const tokenAtPoint = (x: number, y: number): HTMLElement | null => {
    let el = document.elementFromPoint(x, y) as HTMLElement | null;
    while (el && el !== body) {
      if (el.classList?.contains(BRUSH_TOKEN_CLASS)) return el;
      el = el.parentElement;
    }
    return null;
  };

  // 桌面鼠标拖拽：ev.target 即当前指针下的字，直接用；
  // 触摸指针：target 被钉在落点元素，改用坐标命中（elementFromPoint）
  const resolveToken = (ev: PointerEvent): HTMLElement | null =>
    walkToToken(ev.target as HTMLElement | null) ??
    tokenAtPoint(ev.clientX, ev.clientY);

  const indexOf = (el: HTMLElement): number => {
    // 直接用 token 自带的 data-brush-index 作为下标（token 化时按文档顺序编号，
    // querySelectorAll 也按文档顺序返回，故数组下标 == data-brush-index）。
    // 这样不依赖 indexOf 对照「创建时快照」，规避快照陈旧导致 -1 的问题。
    const raw = el.dataset.brushIndex;
    const n = raw == null ? -1 : Number(raw);
    return Number.isFinite(n) ? n : -1;
  };

  const clearHighlight = () => {
    // 不依赖 lastRange 下标对应：直接按 class 清所有残留高亮，
    // 对重渲染/跨手势残留都免疫。
    const all = body.getElementsByClassName(BRUSH_HIGHLIGHT_CLASS);
    // 复制为静态数组，避免边删边改 live HTMLCollection 跳过元素
    for (const el of Array.from(all)) {
      el.classList.remove(BRUSH_HIGHLIGHT_CLASS);
    }
    lastRange = null;
  };

  const applyRange = (s: number, e: number) => {
    const ns = Math.min(s, e);
    const ne = Math.max(s, e);
    if (ns < 0 || ne < 0) return;
    if (lastRange) {
      const [os, oe] = lastRange;
      for (let i = os; i <= oe; i++) {
        if (i < ns || i > ne) tokenByDataIndex(i)?.classList.remove(BRUSH_HIGHLIGHT_CLASS);
      }
    }
    for (let i = ns; i <= ne; i++) {
      tokenByDataIndex(i)?.classList.add(BRUSH_HIGHLIGHT_CLASS);
    }
    lastRange = [ns, ne];
  };

  // 落笔时刷新 tokens 后必须重建到 data-brush-index 的稳定映射，
  // 否则数组顺序若与 data-brush-index 不一致（重渲染/字体加载重排）会高亮错位。
  const tokenByDataIndex = (idx: number): HTMLElement | null => {
    return body.querySelector<HTMLElement>(
      `.${BRUSH_TOKEN_CLASS}[data-brush-index="${idx}"]`,
    );
  };

  const onPointerDown = (ev: PointerEvent) => {
    const token = resolveToken(ev);
    // 落在笔记/学习条目/注音等非 token 上 → 不触发笔刷（交给各自的交互）
    if (!token) return;
    if (ev.button != null && ev.button !== 0) return;

    ev.preventDefault();
    // 清理上一次保留的高亮
    clearHighlight();
    painting = true;
    startIdx = indexOf(token);
    overflowToastShown = false;
    root.classList.add(BRUSH_PAINTING_CLASS);
    applyRange(startIdx, startIdx);
  };

  const onPointerMove = (ev: PointerEvent) => {
    if (!painting) return;
    ev.preventDefault();
    const token = resolveToken(ev);
    if (!token) return;
    const idx = indexOf(token);
    if (idx < 0) return;

    let s = startIdx;
    let e = idx;
    if (s > e) [s, e] = [e, s];

    // 超出字数上限 → 钳止末端并提示一次
    if (e - s + 1 > maxChars) {
      if (startIdx <= idx) {
        e = startIdx + maxChars - 1;
      } else {
        s = startIdx - maxChars + 1;
      }
      if (!overflowToastShown) {
        overflowToastShown = true;
        onOverflow?.();
      }
    }
    applyRange(s, e);
  };

  const finish = () => {
    if (!painting) return;
    painting = false;
    root.classList.remove(BRUSH_PAINTING_CLASS);
    if (!lastRange) {
      startIdx = -1;
      return;
    }
    const [s, e] = lastRange;
    const sel = buildBrushSelection(body, s, e);
    // 保留高亮作为「正在讲解」反馈；下次落笔时由 clearHighlight 清掉
    if (sel && sel.text) {
      onSelect(sel);
    } else {
      clearHighlight();
    }
    startIdx = -1;
  };

  const onPointerUp = () => finish();
  const onPointerCancel = () => {
    painting = false;
    root.classList.remove(BRUSH_PAINTING_CLASS);
    clearHighlight();
    startIdx = -1;
  };

  // selectstart 阻止原生选区（仅限正文内）；与 CSS user-select 解耦
  const onSelectStart = (ev: Event) => {
    if (body.contains(ev.target as Node)) ev.preventDefault();
  };

  // 落笔/涂抹监听挂在正文（.fv-body-h）上：事件从 token 冒泡上来即命中；
  // 抬笔/取消挂 window，确保拖到正文外松手也能结束并出讲解。
  body.addEventListener('pointerdown', onPointerDown);
  body.addEventListener('pointermove', onPointerMove);
  body.addEventListener('selectstart', onSelectStart);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);

  return {
    destroy: () => {
      body.removeEventListener('pointerdown', onPointerDown);
      body.removeEventListener('pointermove', onPointerMove);
      body.removeEventListener('selectstart', onSelectStart);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      root.classList.remove(BRUSH_PAINTING_CLASS);
      clearHighlight();
    },
  };
}
