import {
  applyPosterBodyMaxHeight,
  buildShufuriPosterInnerCss,
  buildShufuriPosterRootStyle,
  measurePosterBodyNaturalHeightPx,
  getShufuriPosterCanvasDimensions,
} from './shufuriPosterShared';
import { applyPosterTitleElement, resolveDisplayArtist, resolveDisplayTitle } from './posterTitle';
import type { PosterLayoutProfile, PosterPageSlice, PosterRenderOptions } from './types';
import type { LyricsLanguage, LangCode } from '../../services/appSettings';
import { getAppSettings } from '../../services/appSettings';
import {
  CJK_TYPOGRAPHY_SCALE_MIN,
  CJK_TYPOGRAPHY_SCALE_STEPS,
  countCjkLineBreakViolations,
  repairAllCjkLineBreaks,
} from './cjkTypography';

export type PosterMeasurer = {
  contentFits: (nodes: HTMLElement[], showTitle: boolean) => boolean;
  pageOverflows: (nodes: HTMLElement[], showTitle: boolean) => boolean;
  pageHtmlOverflows: (html: string, showTitle: boolean) => boolean;
  /** 就地填充正文并修复 CJK 避头尾，返回剩余违例数 */
  tuneCjkLineBreaksInPlace: (nodes: HTMLElement[], showTitle: boolean) => number;
  contentFitsInPlace: (nodes: HTMLElement[], showTitle: boolean) => boolean;
  dispose: () => void;
};

const FIT_EPSILON_PX = 1;
const ORPHAN_MAX_LINES = 2;
const MIN_ORPHAN_SPACING_SCALE = CJK_TYPOGRAPHY_SCALE_MIN;
const ORPHAN_SPACING_STEPS = CJK_TYPOGRAPHY_SCALE_STEPS;

const PAGE_LINE_SELECTORS =
  '.jp-line,.ko-line,.zh-line,.cn-line,.gloss-line,.vocab-line1,.vocab-ex-ja,.vocab-ex-ko,.vocab-ex-zh,.vocab-ex-cn,.vocab-ex-gloss,h3.grammar-point-title,.grammar-detail,.grammar-ex-ja,.grammar-ex-ko,.grammar-ex-zh,.grammar-ex-cn,.grammar-ex-gloss,h2.lyrics-section-title';

type PagePack = {
  blocks: HTMLElement[];
  spacingScale: number;
};

/**
 * 正文溢出判定（fv-body-h overflow:hidden）。
 *
 * 关键前提：调用方显式设置了 body.style.maxHeight = 画布可用高度，
 * 保证 body.clientHeight 被约束到固定值。否则在离屏 DOM 上 flex 布局
 * 可能不会正确收缩 body，导致 clientHeight=scrollHeight 始终不溢出。
 */
function bodyContentOverflows(body: HTMLElement, profile: PosterLayoutProfile): boolean {
  void body.offsetHeight;
  const clientH = body.clientHeight;
  const slack =
    profile === 'mobilePoster' || profile === 'squarePoster' ? 10 : FIT_EPSILON_PX;
  if (clientH >= 1) {
    return body.scrollHeight > clientH + slack;
  }
  const maxH =
    parseFloat(body.dataset.posterBodyMaxHeight || '') || parseFloat(body.style.maxHeight);
  if (!Number.isFinite(maxH) || maxH <= 0) {
    return false;
  }
  return measurePosterBodyNaturalHeightPx(body) > maxH + slack;
}

export function createPosterMeasurer(
  doc: Document,
  profile: PosterLayoutProfile,
  title: string,
  artist?: string,
  spacingScale = 1,
  language: LyricsLanguage = 'jp',
  lang?: LangCode,
  titleMarkupHtml?: string,
  renderOptions?: PosterRenderOptions,
): PosterMeasurer {
  const { width: canvasW, height: canvasH } = getShufuriPosterCanvasDimensions(profile);

  // wrapper 提供固定尺寸的 containing block，避免 shell 用 position:fixed
  // 导致内部 max-width:100% 按视口宽度计算而低估实际高度
  const wrapper = doc.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '0';
  wrapper.style.top = '0';
  wrapper.style.width = canvasW + 'px';
  wrapper.style.height = canvasH + 'px';
  wrapper.style.overflow = 'hidden';
  wrapper.style.visibility = 'hidden';
  wrapper.style.pointerEvents = 'none';
  wrapper.style.zIndex = '-1';

  const shell = doc.createElement('div');
  shell.className = 'fv-html-poster-root';
  // 直接使用 buildShufuriPosterRootStyle 的完整样式（已含带 px 单位的 width/height）
  Object.assign(shell.style, buildShufuriPosterRootStyle(profile));
  shell.style.position = 'relative';
  shell.dataset.rubyVisible = (renderOptions?.showRuby ?? true) ? 'true' : 'false';

  const styleEl = doc.createElement('style');
  styleEl.textContent = buildShufuriPosterInnerCss(profile, {
    spacingScale,
    language,
    lang,
    colorTheme: getAppSettings().colorTheme,
    showRuby: renderOptions?.showRuby,
    userFontScale: renderOptions?.userFontScale,
    userLineHeightScale: renderOptions?.userLineHeightScale,
  });
  const titleEl = doc.createElement('h1');
  titleEl.className = 'fv-title-h';
  const body = doc.createElement('div');
  body.className = 'fv-body-h';

  shell.appendChild(styleEl);
  shell.appendChild(titleEl);
  shell.appendChild(body);
  wrapper.appendChild(shell);
  doc.body.appendChild(wrapper);

  const normalizedTitle = resolveDisplayTitle(title);
  const displayArtist = resolveDisplayArtist(artist);

  // 关键：不依赖 flex 约束，而是用已知画布尺寸显式设置 body 的 max-height。
  // body 有 box-sizing:border-box + padding-bottom，max-height 包含 padding。
  // scrollHeight > clientHeight 的判定在受约束的 clientHeight 下才准确。
  const setPageContext = (showTitle: boolean) => {
    if (showTitle) {
      titleEl.style.display = '';
      if (titleMarkupHtml?.trim()) {
        titleEl.innerHTML = titleMarkupHtml;
      } else {
        applyPosterTitleElement(titleEl, normalizedTitle, displayArtist);
      }
    } else {
      titleEl.style.display = 'none';
      titleEl.textContent = '';
    }
    void shell.offsetHeight;
    applyPosterBodyMaxHeight(body, profile, {
      showTitle,
      titleEl: showTitle ? titleEl : null,
    });
  };

  const fillBodyAndMeasure = (nodes: HTMLElement[]) => {
    body.replaceChildren();
    for (const node of nodes) {
      body.appendChild(node.cloneNode(true));
    }
    void body.offsetHeight;
    return bodyContentOverflows(body, profile);
  };

  const fillBodyInPlace = (nodes: HTMLElement[]) => {
    body.replaceChildren();
    for (const node of nodes) {
      body.appendChild(node);
    }
    void body.offsetHeight;
  };

  const fillBodyInPlaceAndMeasure = (nodes: HTMLElement[]) => {
    fillBodyInPlace(nodes);
    return bodyContentOverflows(body, profile);
  };

  const fillBodyHtmlAndMeasure = (html: string) => {
    body.innerHTML = html;
    void body.offsetHeight;
    return bodyContentOverflows(body, profile);
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

  const contentFitsInPlace = (nodes: HTMLElement[], showTitle: boolean): boolean => {
    if (nodes.length === 0) {
      return true;
    }
    setPageContext(showTitle);
    return !fillBodyInPlaceAndMeasure(nodes);
  };

  const tuneCjkLineBreaksInPlace = (nodes: HTMLElement[], showTitle: boolean): number => {
    if (nodes.length === 0) {
      return 0;
    }
    setPageContext(showTitle);
    fillBodyInPlace(nodes);
    repairAllCjkLineBreaks(body);
    void body.offsetHeight;
    return countCjkLineBreakViolations(body);
  };

  return {
    contentFits,
    pageOverflows,
    pageHtmlOverflows,
    tuneCjkLineBreaksInPlace,
    contentFitsInPlace,
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
  let pendingCn: HTMLElement | null = null;
  let pendingGloss: HTMLElement | null = null;

  const flushPendingZhPipeline = () => {
    if (pendingCn && pendingGloss) {
      const group = document.createElement('div');
      group.className = 'lyrics-group lyrics-group--zh';
      group.appendChild(pendingCn);
      group.appendChild(pendingGloss);
      rebuilt.push(group);
      pendingCn = null;
      pendingGloss = null;
      return;
    }
    if (pendingCn) {
      const group = document.createElement('div');
      group.className = 'lyrics-group lyrics-group--zh';
      group.appendChild(pendingCn);
      rebuilt.push(group);
      pendingCn = null;
    }
    if (pendingGloss) {
      const group = document.createElement('div');
      group.className = 'lyrics-group lyrics-group--zh';
      group.appendChild(pendingGloss);
      rebuilt.push(group);
      pendingGloss = null;
    }
  };

  const flushPendingPair = () => {
    flushPendingZhPipeline();
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
        !last.querySelector('.jp-line') &&
        !last.querySelector('.ko-line')
      ) {
        last.insertBefore(pendingJp, last.firstChild);
      } else {
        const group = document.createElement('div');
        group.className = 'lyrics-group';
        group.appendChild(pendingJp);
        rebuilt.push(group);
      }
      pendingJp = null;
    }
    if (pendingZh) {
      const last = rebuilt[rebuilt.length - 1];
      const hasOrig = (el: Element) =>
        el.querySelector('.jp-line') || el.querySelector('.ko-line');
      if (
        last instanceof HTMLElement &&
        last.classList.contains('lyrics-group') &&
        hasOrig(last) &&
        !last.querySelector('.zh-line')
      ) {
        last.appendChild(pendingZh);
      } else {
        const group = document.createElement('div');
        group.className = 'lyrics-group';
        group.appendChild(pendingZh);
        rebuilt.push(group);
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

    const isOrigLine = node.classList.contains('jp-line') || node.classList.contains('ko-line');

    if (isOrigLine) {
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

    if (node.classList.contains('cn-line')) {
      if (pendingGloss) {
        const group = document.createElement('div');
        group.className = 'lyrics-group lyrics-group--zh';
        group.appendChild(node);
        group.appendChild(pendingGloss);
        rebuilt.push(group);
        pendingGloss = null;
        continue;
      }
      pendingCn = node;
      continue;
    }

    if (node.classList.contains('gloss-line')) {
      if (pendingCn) {
        const group = document.createElement('div');
        group.className = 'lyrics-group lyrics-group--zh';
        group.appendChild(pendingCn);
        group.appendChild(node);
        rebuilt.push(group);
        pendingCn = null;
        continue;
      }
      pendingGloss = node;
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

    const cn = atom.querySelector('.cn-line');
    if (cn) {
      repaired.push(atom);
      i += 1;
      continue;
    }

    const orig = atom.querySelector('.jp-line') || atom.querySelector('.ko-line');
    const zh = atom.querySelector('.zh-line');
    if (orig && zh) {
      repaired.push(atom);
      i += 1;
      continue;
    }

    const last = repaired[repaired.length - 1];
    if (last instanceof HTMLElement && last.classList.contains('lyrics-group')) {
      const lastOrig = last.querySelector('.jp-line') || last.querySelector('.ko-line');
      const lastZh = last.querySelector('.zh-line');
      if (orig && !lastOrig && lastZh) {
        last.insertBefore(orig.cloneNode(true), last.firstChild);
        i += 1;
        continue;
      }
      if (zh && !lastZh && lastOrig) {
        last.appendChild(zh.cloneNode(true));
        i += 1;
        continue;
      }
    }

    if (orig && !zh && i + 1 < atoms.length) {
      const next = atoms[i + 1]!;
      if (next.classList.contains('lyrics-group')) {
        const nextZh = next.querySelector('.zh-line');
        const nextOrig = next.querySelector('.jp-line') || next.querySelector('.ko-line');
        if (nextZh && !nextOrig) {
          const group = document.createElement('div');
          group.className = 'lyrics-group';
          group.appendChild(orig.cloneNode(true));
          group.appendChild(nextZh.cloneNode(true));
          repaired.push(group);
          i += 2;
          continue;
        }
      }
    }

    if (orig || zh) {
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
  if (!atom.classList.contains('lyrics-group')) return false;
  if (atom.querySelector('.cn-line')) return true;
  return (
    !!(atom.querySelector('.jp-line') || atom.querySelector('.ko-line')) &&
    !!atom.querySelector('.zh-line')
  );
}

function warnPaginationIssue(message: string, atom?: HTMLElement): void {
  if (typeof console !== 'undefined' && console.warn) {
    const preview = atom?.textContent?.trim().slice(0, 60) ?? '';
    console.warn(`[paginateShufuri] ${message}${preview ? `: "${preview}…"` : ''}`);
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

  // 中文语法条目不拆子块，避免标题/解释/例句各自带上项目符号
  if (item.classList.contains('lyrics-grammar-item--zh')) {
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

function countPageContentLines(blocks: HTMLElement[]): number {
  let count = 0;
  for (const block of blocks) {
    if (block.matches(PAGE_LINE_SELECTORS)) {
      count += 1;
    } else {
      count += block.querySelectorAll(PAGE_LINE_SELECTORS).length;
    }
  }
  return count;
}

function createMeasurerAtScale(
  doc: Document,
  profile: PosterLayoutProfile,
  title: string,
  artist: string | undefined,
  scale: number,
  language: LyricsLanguage = 'jp',
  lang?: LangCode,
  titleMarkupHtml?: string,
  renderOptions?: PosterRenderOptions,
): PosterMeasurer {
  return createPosterMeasurer(
    doc,
    profile,
    title,
    artist,
    scale,
    language,
    lang,
    titleMarkupHtml,
    renderOptions,
  );
}

/** 末页 ≤2 行时尝试收紧行距并并回上一页；行距不低于 0.9，否则保留孤页 */
function preventOrphanPages(
  pages: HTMLElement[][],
  doc: Document,
  profile: PosterLayoutProfile,
  title: string,
  artist?: string,
  language: LyricsLanguage = 'jp',
  lang?: LangCode,
  titleMarkupHtml?: string,
  renderOptions?: PosterRenderOptions,
): PagePack[] {
  let packs: PagePack[] = pages.map((blocks) => ({ blocks, spacingScale: 1 }));

  for (;;) {
    if (packs.length < 2) {
      break;
    }

    const lastIdx = packs.length - 1;
    const last = packs[lastIdx]!;
    if (countPageContentLines(last.blocks) > ORPHAN_MAX_LINES) {
      break;
    }

    const prevIdx = lastIdx - 1;
    const prev = packs[prevIdx]!;
    const combined = [...prev.blocks, ...last.blocks];
    const showTitle = prevIdx === 0;
    const maxScale = prev.spacingScale;

    let mergedScale: number | null = null;
    for (const scale of ORPHAN_SPACING_STEPS) {
      if (scale > maxScale + 1e-6) {
        continue;
      }
      if (scale < MIN_ORPHAN_SPACING_SCALE - 1e-6) {
        continue;
      }

      const probeMeasurer = createMeasurerAtScale(
        doc,
        profile,
        title,
        artist,
        scale,
        language,
        lang,
        titleMarkupHtml,
        renderOptions,
      );
      try {
        const html = joinPageBlocks(combined, new Set<string>());
        if (!probeMeasurer.pageHtmlOverflows(html, showTitle)) {
          mergedScale = scale;
          break;
        }
      } finally {
        probeMeasurer.dispose();
      }
    }

    if (mergedScale == null) {
      break;
    }

    packs = [...packs.slice(0, prevIdx), { blocks: combined, spacingScale: mergedScale }];
  }

  return packs;
}

/** 逐页收紧字距/行距并就地修复避头尾违例 */
function optimizeCjkTypographyOnPacks(
  packs: PagePack[],
  doc: Document,
  profile: PosterLayoutProfile,
  title: string,
  artist?: string,
  language: LyricsLanguage = 'jp',
  lang?: LangCode,
  titleMarkupHtml?: string,
  renderOptions?: PosterRenderOptions,
): PagePack[] {
  return packs.map((pack, packIdx) => {
    const showTitle = packIdx === 0;
    const scales = CJK_TYPOGRAPHY_SCALE_STEPS.filter(
      (s) => s <= pack.spacingScale + 1e-6 && s >= CJK_TYPOGRAPHY_SCALE_MIN - 1e-6,
    );

    let best: PagePack = pack;

    for (const scale of scales) {
      const trialBlocks = pack.blocks.map((b) => b.cloneNode(true) as HTMLElement);
      const measurer = createMeasurerAtScale(
        doc,
        profile,
        title,
        artist,
        scale,
        language,
        lang,
        titleMarkupHtml,
        renderOptions,
      );
      try {
        if (!measurer.contentFitsInPlace(trialBlocks, showTitle)) {
          continue;
        }
        const violations = measurer.tuneCjkLineBreaksInPlace(trialBlocks, showTitle);
        if (!measurer.contentFitsInPlace(trialBlocks, showTitle)) {
          continue;
        }
        best = { blocks: trialBlocks, spacingScale: scale };
        if (violations === 0) {
          break;
        }
      } finally {
        measurer.dispose();
      }
    }

    return best;
  });
}

function resolvePaginationBodyRoot(wrapper: HTMLElement): HTMLElement {
  const topKids = Array.from(wrapper.children).filter(
    (n): n is HTMLElement => n instanceof HTMLElement,
  );
  if (topKids.length === 0) {
    return wrapper;
  }
  if (topKids.length === 1) {
    const only = topKids[0]!;
    if (
      only.classList.contains('clip-body') ||
      only.classList.contains('lyrics-notes-body') ||
      !only.classList.contains('lyrics-group')
    ) {
      return only;
    }
  }
  // 多个并列 lyrics-group / section，或仅有单个 lyrics-group 时仍用 wrapper 保留全部兄弟节点
  return wrapper;
}

export function paginateShufuriPosterBodyHtml(
  safeBodyHtml: string,
  title: string,
  profile: PosterLayoutProfile = 'clipPosterPrint',
  doc: Document = document,
  artist?: string,
  language: LyricsLanguage = 'jp',
  lang?: LangCode,
  titleMarkupHtml?: string,
  renderOptions?: PosterRenderOptions,
): PosterPageSlice[] {
  const trimmed = safeBodyHtml.trim();
  if (!trimmed) {
    return [{ html: '', spacingScale: 1 }];
  }

  const wrapper = doc.createElement('div');
  wrapper.innerHTML = trimmed;
  const bodyRoot = resolvePaginationBodyRoot(wrapper);
  normalizeBodyRoot(bodyRoot);

  let atoms = flattenAtoms(bodyRoot).filter((a) => !isSkippableAtom(a));
  atoms = repairLyricsGroupAtoms(atoms);
  atoms = preparePaginationAtoms(atoms);

  const measurer = createPosterMeasurer(
    doc,
    profile,
    title,
    artist,
    1,
    language,
    lang,
    titleMarkupHtml,
    renderOptions,
  );

  try {
    const rawPages = flowAtomsIntoPages(atoms, measurer);
    const pages = verifyAndRepairPages(rawPages, measurer);
    const pagePacks = optimizeCjkTypographyOnPacks(
      preventOrphanPages(
        pages,
        doc,
        profile,
        title,
        artist,
        language,
        lang,
        titleMarkupHtml,
        renderOptions,
      ),
      doc,
      profile,
      title,
      artist,
      language,
      lang,
      titleMarkupHtml,
      renderOptions,
    );

    if (pagePacks.length === 0) {
      return [{ html: trimmed, spacingScale: 1 }];
    }

    const emittedSectionTitles = new Set<string>();

    return pagePacks
      .map(({ blocks, spacingScale }) => ({
        html: joinPageBlocks(blocks, emittedSectionTitles),
        spacingScale,
      }))
      .filter((slice) => pageHtmlHasContent(slice.html, doc));
  } finally {
    measurer.dispose();
  }
}

/** @deprecated 使用 paginateShufuriPosterBodyHtml */
export const paginateFuriganaBodyHtml = paginateShufuriPosterBodyHtml;
