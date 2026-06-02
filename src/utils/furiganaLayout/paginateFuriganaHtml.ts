import {
  buildFuriganaPosterInnerCss,
  buildFuriganaPosterRootStyle,
  getFuriganaPosterCanvasDimensions,
  getFuriganaCanvasInsets,
} from './furiganaPosterShared';
import type { PosterLayoutProfile } from './types';

type PosterMeasurer = {
  contentFits: (nodes: HTMLElement[], showTitle: boolean) => boolean;
  pageOverflows: (nodes: HTMLElement[], showTitle: boolean) => boolean;
  pageHtmlOverflows: (html: string, showTitle: boolean) => boolean;
  dispose: () => void;
};

const FIT_EPSILON_PX = 1;
const SAFETY_MARGIN_PX = 16;

/**
 * 正文溢出判定（fv-body-h overflow:hidden）。
 *
 * 关键前提：调用方显式设置了 body.style.maxHeight = 画布可用高度，
 * 保证 body.clientHeight 被约束到固定值。否则在离屏 DOM 上 flex 布局
 * 可能不会正确收缩 body，导致 clientHeight=scrollHeight 始终不溢出。
 */
function bodyContentOverflows(body: HTMLElement): boolean {
  const clientH = body.clientHeight;
  return clientH >= 1 && body.scrollHeight > clientH + FIT_EPSILON_PX;
}

function createPosterMeasurer(
  doc: Document,
  profile: PosterLayoutProfile,
  title: string,
): PosterMeasurer {
  const { width: canvasW, height: canvasH } = getFuriganaPosterCanvasDimensions(profile);
  const insets = getFuriganaCanvasInsets(profile);
  const shellInnerH = canvasH - insets.top - insets.bottom;

  // wrapper 提供固定尺寸的 containing block，避免 shell 用 position:fixed
  // 导致内部 max-width:100% 按视口宽度计算而低估实际高度
  const wrapper = doc.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.width = canvasW + 'px';
  wrapper.style.height = canvasH + 'px';
  wrapper.style.overflow = 'hidden';
  wrapper.style.left = '-20000px';
  wrapper.style.top = '0';
  wrapper.style.opacity = '0';
  wrapper.style.pointerEvents = 'none';

  const shell = doc.createElement('div');
  shell.className = 'fv-html-poster-root';
  // 复用预览页完全一致的根样式（flex 布局、padding 等），仅覆盖 position/size
  // 以适配 wrapper 的 relative 定位
  Object.assign(shell.style, buildFuriganaPosterRootStyle(profile));
  shell.style.position = 'relative';
  shell.style.width = '100%';
  shell.style.height = '100%';

  const styleEl = doc.createElement('style');
  styleEl.textContent = buildFuriganaPosterInnerCss(profile);
  const titleEl = doc.createElement('h1');
  titleEl.className = 'fv-title-h';
  const body = doc.createElement('div');
  body.className = 'fv-body-h';

  shell.appendChild(styleEl);
  shell.appendChild(titleEl);
  shell.appendChild(body);
  wrapper.appendChild(shell);
  doc.body.appendChild(wrapper);

  const normalizedTitle = title.trim() || '歌词笔记';

  // 关键：不依赖 flex 约束，而是用已知画布尺寸显式设置 body 的 max-height。
  // body 有 box-sizing:border-box + padding-bottom，max-height 包含 padding。
  // scrollHeight > clientHeight 的判定在受约束的 clientHeight 下才准确。
  const setPageContext = (showTitle: boolean) => {
    if (showTitle) {
      titleEl.style.display = '';
      titleEl.textContent = normalizedTitle;
    } else {
      titleEl.style.display = 'none';
      titleEl.textContent = '';
    }
    void shell.offsetHeight;
    // 标题占用的垂直空间 = offsetHeight + margin-bottom
    const titleH = showTitle ? titleEl.offsetHeight : 0;
    const titleMB =
      showTitle ? parseFloat(getComputedStyle(titleEl).marginBottom) || 0 : 0;
    body.style.maxHeight = Math.max(0, shellInnerH - titleH - titleMB - SAFETY_MARGIN_PX) + 'px';
  };

  const fillBodyAndMeasure = (nodes: HTMLElement[]) => {
    body.replaceChildren();
    for (const node of nodes) {
      body.appendChild(node.cloneNode(true));
    }
    void body.offsetHeight;
    return bodyContentOverflows(body);
  };

  const fillBodyHtmlAndMeasure = (html: string) => {
    body.innerHTML = html;
    void body.offsetHeight;
    return bodyContentOverflows(body);
  };

  const contentFits = (nodes: HTMLElement[], showTitle: boolean): boolean => {
    if (nodes.length === 0) {
      return true;
    }
    setPageContext(showTitle);
    return !fillBodyAndMeasure(nodes);
  };

  const pageOverflows = (nodes: HTMLElement[], showTitle: boolean): boolean => {
    if (nodes.length === 0) {
      return false;
    }
    setPageContext(showTitle);
    return fillBodyAndMeasure(nodes);
  };

  const pageHtmlOverflows = (html: string, showTitle: boolean): boolean => {
    if (!html.trim()) {
      return false;
    }
    setPageContext(showTitle);
    return fillBodyHtmlAndMeasure(html);
  };

  return {
    contentFits,
    pageOverflows,
    pageHtmlOverflows,
    dispose: () => {
      doc.body.removeChild(wrapper);
    },
  };
}

function flattenAtoms(root: HTMLElement): HTMLElement[] {
  const kids = Array.from(root.children).filter(
    (n): n is HTMLElement => n instanceof HTMLElement,
  );
  if (kids.length > 0) return kids;
  return [root];
}

function isSectionContainer(el: HTMLElement): boolean {
  return (
    el.classList.contains('lyrics-vocabulary') ||
    el.classList.contains('lyrics-grammar') ||
    el.classList.contains('lyrics-grammar-spacer')
  );
}

function ensureLyricPairsInBodyRoot(root: HTMLElement): void {
  const rebuilt: HTMLElement[] = [];
  let pendingJp: HTMLElement | null = null;
  let pendingZh: HTMLElement | null = null;

  const flushPendingPair = () => {
    if (pendingJp && pendingZh) {
      const group = document.createElement('div');
      group.className = 'lyrics-group';
      group.appendChild(pendingJp);
      group.appendChild(pendingZh);
      rebuilt.push(group);
      pendingJp = null;
      pendingZh = null;
      return;
    }
    if (pendingJp) {
      const last = rebuilt[rebuilt.length - 1];
      if (
        last instanceof HTMLElement &&
        last.classList.contains('lyrics-group') &&
        last.querySelector('.zh-line') &&
        !last.querySelector('.jp-line')
      ) {
        last.insertBefore(pendingJp, last.firstChild);
      }
      pendingJp = null;
    }
    if (pendingZh) {
      const last = rebuilt[rebuilt.length - 1];
      if (
        last instanceof HTMLElement &&
        last.classList.contains('lyrics-group') &&
        last.querySelector('.jp-line') &&
        !last.querySelector('.zh-line')
      ) {
        last.appendChild(pendingZh);
      }
      pendingZh = null;
    }
  };

  for (const node of Array.from(root.children)) {
    if (!(node instanceof HTMLElement)) continue;

    if (node.classList.contains('lyrics-group')) {
      flushPendingPair();
      rebuilt.push(node);
      continue;
    }

    if (isSectionContainer(node)) {
      flushPendingPair();
      rebuilt.push(node);
      continue;
    }

    if (node.classList.contains('jp-line')) {
      if (pendingZh) {
        const group = document.createElement('div');
        group.className = 'lyrics-group';
        group.appendChild(node);
        group.appendChild(pendingZh);
        rebuilt.push(group);
        pendingZh = null;
        continue;
      }
      pendingJp = node;
      continue;
    }

    if (node.classList.contains('zh-line')) {
      if (pendingJp) {
        const group = document.createElement('div');
        group.className = 'lyrics-group';
        group.appendChild(pendingJp);
        group.appendChild(node);
        rebuilt.push(group);
        pendingJp = null;
        continue;
      }
      pendingZh = node;
      continue;
    }

    flushPendingPair();
    rebuilt.push(node);
  }

  flushPendingPair();
  root.replaceChildren(...rebuilt);
}

function mergeAdjacentSections(root: HTMLElement, sectionClass: string): void {
  let anchor: HTMLElement | null = null;
  for (const node of Array.from(root.children)) {
    if (!(node instanceof HTMLElement) || !node.classList.contains(sectionClass)) {
      anchor = null;
      continue;
    }
    if (!anchor) {
      anchor = node;
      continue;
    }
    for (const child of Array.from(node.children)) {
      if (
        child instanceof HTMLElement &&
        (child.classList.contains('lyrics-section-title') || child.tagName === 'H2')
      ) {
        continue;
      }
      anchor.appendChild(child);
    }
    node.remove();
  }
}

function normalizeBodyRoot(bodyRoot: HTMLElement): void {
  ensureLyricPairsInBodyRoot(bodyRoot);
  mergeAdjacentSections(bodyRoot, 'lyrics-vocabulary');
  mergeAdjacentSections(bodyRoot, 'lyrics-grammar');
}

/** 合并分页 atom 列表中不完整的歌词组，避免 jp/zh 分页分离 */
function repairLyricsGroupAtoms(atoms: HTMLElement[]): HTMLElement[] {
  const repaired: HTMLElement[] = [];
  let i = 0;

  while (i < atoms.length) {
    const atom = atoms[i]!;
    if (!atom.classList.contains('lyrics-group')) {
      repaired.push(atom);
      i += 1;
      continue;
    }

    const jp = atom.querySelector('.jp-line');
    const zh = atom.querySelector('.zh-line');
    if (jp && zh) {
      repaired.push(atom);
      i += 1;
      continue;
    }

    const last = repaired[repaired.length - 1];
    if (last instanceof HTMLElement && last.classList.contains('lyrics-group')) {
      const lastJp = last.querySelector('.jp-line');
      const lastZh = last.querySelector('.zh-line');
      if (jp && !lastJp && lastZh) {
        last.insertBefore(jp.cloneNode(true), last.firstChild);
        i += 1;
        continue;
      }
      if (zh && !lastZh && lastJp) {
        last.appendChild(zh.cloneNode(true));
        i += 1;
        continue;
      }
    }

    if (jp && !zh && i + 1 < atoms.length) {
      const next = atoms[i + 1]!;
      if (next.classList.contains('lyrics-group')) {
        const nextZh = next.querySelector('.zh-line');
        const nextJp = next.querySelector('.jp-line');
        if (nextZh && !nextJp) {
          const group = document.createElement('div');
          group.className = 'lyrics-group';
          group.appendChild(jp.cloneNode(true));
          group.appendChild(nextZh.cloneNode(true));
          repaired.push(group);
          i += 2;
          continue;
        }
      }
    }

    if (jp || zh) {
      repaired.push(atom);
    }
    i += 1;
  }

  return repaired;
}

function explodeSectionToItemUnits(section: HTMLElement): HTMLElement[] {
  const isVocab = section.classList.contains('lyrics-vocabulary');
  const itemClass = isVocab ? 'lyrics-vocab-item' : 'lyrics-grammar-item';
  const items = Array.from(section.querySelectorAll(`:scope > .${itemClass}`)).filter(
    (n): n is HTMLElement => n instanceof HTMLElement,
  );

  if (items.length === 0) {
    return [section];
  }

  const heading = section.querySelector(':scope > h2.lyrics-section-title, :scope > h2');
  const forceNewPage = section.getAttribute('data-lyrics-force-next-page') === '1';

  return items.map((item, index) => {
    const unit = document.createElement('div');
    unit.className = 'lyrics-pagination-unit';
    if (index === 0 && forceNewPage) {
      unit.setAttribute('data-lyrics-force-next-page', '1');
    }
    if (index === 0 && heading) {
      unit.appendChild(heading.cloneNode(true));
    }
    unit.appendChild(item.cloneNode(true));
    return unit;
  });
}

function joinPageBlocks(blocks: HTMLElement[], emittedSectionTitles: Set<string>): string {
  return blocks
    .map((el) => {
      const clone = el.cloneNode(true) as HTMLElement;
      const heading = clone.querySelector('h2.lyrics-section-title, :scope > h2');
      if (heading instanceof HTMLElement) {
        const isGrammar = clone.querySelector('.lyrics-grammar-item') !== null;
        const sectionKey = isGrammar ? 'grammar' : 'vocabulary';
        if (emittedSectionTitles.has(sectionKey)) {
          heading.remove();
        } else {
          emittedSectionTitles.add(sectionKey);
        }
      }
      return clone.outerHTML;
    })
    .join('');
}

function atomForcesNewPage(atom: HTMLElement): boolean {
  return atom.getAttribute('data-lyrics-force-next-page') === '1';
}

function isSkippableAtom(atom: HTMLElement): boolean {
  if (atom.classList.contains('lyrics-grammar-spacer')) {
    return true;
  }
  return (atom.textContent?.trim().length ?? 0) === 0 && atom.children.length === 0;
}

function isCompleteLyricsGroup(atom: HTMLElement): boolean {
  return (
    atom.classList.contains('lyrics-group') &&
    !!atom.querySelector('.jp-line') &&
    !!atom.querySelector('.zh-line')
  );
}

function warnPaginationIssue(message: string, atom?: HTMLElement): void {
  if (typeof console !== 'undefined' && console.warn) {
    const preview = atom?.textContent?.trim().slice(0, 60) ?? '';
    console.warn(`[paginateFurigana] ${message}${preview ? `: "${preview}…"` : ''}`);
  }
}

/** 将 vocab/grammar 分页单元拆成可独立装箱的子单元（歌词组不拆） */
function splitPaginationUnit(unit: HTMLElement): HTMLElement[] | null {
  if (!unit.classList.contains('lyrics-pagination-unit')) {
    return null;
  }

  const item = unit.querySelector(':scope .lyrics-vocab-item, :scope .lyrics-grammar-item');
  if (!(item instanceof HTMLElement)) {
    return null;
  }

  const children = Array.from(item.children).filter((n): n is Element => n instanceof Element);
  if (children.length <= 1) {
    return null;
  }

  const heading = unit.querySelector(':scope > h2.lyrics-section-title, :scope > h2');
  const forceNewPage = unit.getAttribute('data-lyrics-force-next-page') === '1';

  const makePart = (child: Element, index: number) => {
    const partUnit = document.createElement('div');
    partUnit.className = 'lyrics-pagination-unit';
    if (index === 0 && forceNewPage) {
      partUnit.setAttribute('data-lyrics-force-next-page', '1');
    }
    if (index === 0 && heading) {
      partUnit.appendChild(heading.cloneNode(true));
    }
    const itemClone = document.createElement('div');
    itemClone.className = item.className;
    itemClone.appendChild(child.cloneNode(true));
    partUnit.appendChild(itemClone);
    return partUnit;
  };

  return children.map((child, index) => makePart(child, index));
}

function preparePaginationAtoms(atoms: HTMLElement[]): HTMLElement[] {
  const prepared: HTMLElement[] = [];
  for (const atom of atoms) {
    if (
      atom.classList.contains('lyrics-vocabulary') ||
      atom.classList.contains('lyrics-grammar')
    ) {
      for (const unit of explodeSectionToItemUnits(atom)) {
        const parts = splitPaginationUnit(unit);
        prepared.push(...(parts ?? [unit]));
      }
      continue;
    }
    prepared.push(atom);
  }
  return prepared;
}

function pageHtmlHasContent(html: string, doc: Document): boolean {
  const probe = doc.createElement('div');
  probe.innerHTML = html;
  return (probe.textContent?.trim().length ?? 0) > 0;
}

function flowAtomsIntoPages(
  atoms: HTMLElement[],
  measurer: PosterMeasurer,
): HTMLElement[][] {
  const pages: HTMLElement[][] = [];
  let current: HTMLElement[] = [];
  let onFirstPage = true;
  const queue = [...atoms];

  const fits = (nodes: HTMLElement[]) => measurer.contentFits(nodes, onFirstPage);
  const flush = () => {
    if (current.length > 0) {
      pages.push(current);
      current = [];
      onFirstPage = false;
    }
  };

  while (queue.length > 0) {
    const atom = queue.shift()!;

    if (atom.classList.contains('lyrics-group') && !isCompleteLyricsGroup(atom)) {
      warnPaginationIssue('incomplete lyrics-group kept (not skipped)', atom);
    }

    if (atomForcesNewPage(atom) && current.length > 0) {
      flush();
    }

    if (fits([...current, atom])) {
      current.push(atom);
      continue;
    }

    if (current.length > 0) {
      flush();
    }

    if (fits([atom])) {
      current.push(atom);
      continue;
    }

    const splits = splitPaginationUnit(atom);
    if (splits && splits.length > 1) {
      queue.unshift(...splits.reverse());
      continue;
    }

    warnPaginationIssue('oversized atom cannot split, forcing single page', atom);
    pages.push([atom]);
    onFirstPage = false;
  }

  flush();
  return pages;
}

/** 分页后逐页校验：用与预览一致的 joinPageBlocks + innerHTML 测量，溢出则拆块到下一页 */
function verifyAndRepairPages(
  pages: HTMLElement[][],
  measurer: PosterMeasurer,
): HTMLElement[][] {
  if (pages.length === 0) {
    return pages;
  }

  let current = pages.map((page) => [...page]);
  const maxPasses = Math.max(32, pages.length * 8);

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const next: HTMLElement[][] = [];
    let carry: HTMLElement[] = [];
    let changed = false;
    const emittedSectionTitles = new Set<string>();

    for (const page of current) {
      let blocks = [...carry, ...page];
      carry = [];
      const showTitle = next.length === 0;

      while (blocks.length > 0) {
        const probeTitles = new Set(emittedSectionTitles);
        const html = joinPageBlocks(blocks, probeTitles);
        if (!measurer.pageHtmlOverflows(html, showTitle)) {
          break;
        }

        changed = true;
        if (blocks.length === 1) {
          const splits = splitPaginationUnit(blocks[0]!);
          if (splits && splits.length > 1) {
            blocks = splits;
            continue;
          }
          warnPaginationIssue('page overflow on unsplittable atom', blocks[0]);
          break;
        }
        carry.unshift(blocks.pop()!);
      }

      if (blocks.length > 0) {
        joinPageBlocks(blocks, emittedSectionTitles);
        next.push(blocks);
      }
    }

    if (carry.length > 0) {
      changed = true;
      next.push(carry);
    }

    current = next.filter((page) => page.length > 0);
    if (!changed) {
      break;
    }
  }

  // 最终校验：仍有溢出则继续从页尾拆块（防止 carry 整页仍溢出）
  const emittedFinal = new Set<string>();
  const finalPages: HTMLElement[][] = [];
  let pending: HTMLElement[] = [];

  for (const page of current) {
    let blocks = [...pending, ...page];
    pending = [];
    const showTitle = finalPages.length === 0;

    while (blocks.length > 0) {
      const probeTitles = new Set(emittedFinal);
      const html = joinPageBlocks(blocks, probeTitles);
      if (!measurer.pageHtmlOverflows(html, showTitle)) {
        break;
      }
      if (blocks.length === 1) {
        const splits = splitPaginationUnit(blocks[0]!);
        if (splits && splits.length > 1) {
          pending = [...splits.slice(1), ...pending];
          blocks = [splits[0]!];
          continue;
        }
        break;
      }
      pending.unshift(blocks.pop()!);
    }

    if (blocks.length > 0) {
      joinPageBlocks(blocks, emittedFinal);
      finalPages.push(blocks);
    }
  }

  if (pending.length > 0) {
    finalPages.push(pending);
  }

  return finalPages.length > 0 ? finalPages : current;
}

export function paginateFuriganaBodyHtml(
  safeBodyHtml: string,
  title: string,
  profile: PosterLayoutProfile = 'clipPosterPrint',
  doc: Document = document,
): string[] {
  const trimmed = safeBodyHtml.trim();
  if (!trimmed) {
    return [''];
  }

  const wrapper = doc.createElement('div');
  wrapper.innerHTML = trimmed;
  const bodyRoot = (wrapper.firstElementChild as HTMLElement | null) ?? wrapper;
  normalizeBodyRoot(bodyRoot);

  let atoms = flattenAtoms(bodyRoot).filter((a) => !isSkippableAtom(a));
  atoms = repairLyricsGroupAtoms(atoms);
  atoms = preparePaginationAtoms(atoms);

  const measurer = createPosterMeasurer(doc, profile, title);

  try {
    const rawPages = flowAtomsIntoPages(atoms, measurer);
    const pages = verifyAndRepairPages(rawPages, measurer);

    if (pages.length === 0) {
      return [trimmed];
    }

    const emittedSectionTitles = new Set<string>();

    return pages
      .map((blocks) => joinPageBlocks(blocks, emittedSectionTitles))
      .filter((html) => pageHtmlHasContent(html, doc));
  } finally {
    measurer.dispose();
  }
}
