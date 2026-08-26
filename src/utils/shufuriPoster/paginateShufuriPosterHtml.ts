import {
  applyPosterBodyMaxHeight,
  buildShufuriPosterInnerCss,
  buildShufuriPosterRootStyle,
  measurePosterBodyNaturalHeightPx,
  getShufuriPosterCanvasDimensions,
} from './shufuriPosterShared';
import { applyPosterTitleElement, resolveDisplayArtist, resolveDisplayTitle, stampPosterTitleSerifClasses } from './posterTitle';
import { resolvePosterPipelineLang } from './inferPosterLang';
import type { PosterLayoutProfile, PosterPageSlice, PosterRenderOptions } from './types';
import type { LyricsLanguage, LangCode } from '../../services/appSettings';
import { getAppSettings } from '../../services/appSettings';
import { getPosterBackgroundUrl } from '../../config/posterBackgrounds';
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
function bodyContentOverflows(body: HTMLElement, _profile: PosterLayoutProfile): boolean {
  void body.offsetHeight;
  const clientH = body.clientHeight;
  // 全 profile 统一 1px 容差；过大的 slack 会把接近满页的内容误判为「装得下」
  const slack = FIT_EPSILON_PX;
  if (clientH >= 1) {
    return body.scrollHeight > clientH + slack;
  }
  const maxH =
    parseFloat(body.dataset.posterBodyMaxHeight || '') || parseFloat(body.style.maxHeight);
  // 无有效 maxHeight 时绝不当作「不溢出」（否则会整页装箱）
  if (!Number.isFinite(maxH) || maxH <= 0) {
    return true;
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
  // relative + 离屏：提供固定尺寸 containing block；避免 fixed 按视口算宽、
  // 也避免 visibility:hidden 在部分引擎里影响 scrollHeight 测量
  wrapper.style.position = 'relative';
  wrapper.style.left = '-99999px';
  wrapper.style.top = '0';
  wrapper.style.width = canvasW + 'px';
  wrapper.style.height = canvasH + 'px';
  wrapper.style.overflow = 'hidden';
  wrapper.style.pointerEvents = 'none';

  const backgroundImage = getPosterBackgroundUrl(renderOptions?.backgroundId);

  const shell = doc.createElement('div');
  shell.className = 'fv-html-poster-root';
  // 直接使用 buildShufuriPosterRootStyle 的完整样式（已含带 px 单位的 width/height）
  Object.assign(
    shell.style,
    buildShufuriPosterRootStyle(profile, backgroundImage),
  );
  shell.style.position = 'relative';
  shell.dataset.rubyVisible = (renderOptions?.showRuby ?? true) ? 'true' : 'false';
  if (renderOptions?.layoutVariant && renderOptions.layoutVariant !== 'standard') {
    shell.dataset.layoutVariant = renderOptions.layoutVariant;
  }
  // 关键：测量容器也激活 RASTER_SAFE_CSS 的 line-height:1.55 补偿，
  // 使分页测量的行高与导出栅格化完全一致（避免导出时内容撑高溢出压水印）
  shell.dataset.exportRaster = '1';

  const styleEl = doc.createElement('style');
  const pipelineLang = resolvePosterPipelineLang(lang, '', language) ?? 'jp';
  styleEl.textContent = buildShufuriPosterInnerCss(profile, {
    spacingScale,
    language,
    lang: pipelineLang,
    colorTheme: getAppSettings().colorTheme,
    showRuby: renderOptions?.showRuby,
    userFontScale: renderOptions?.userFontScale,
    userLineHeightScale: renderOptions?.userLineHeightScale,
    // 字体由 posterFonts.css / ensurePosterFontFacesRegistered 文档级注册；
    // 测量时再注入 @font-face（尤其思源 23MB + font-display:block）会卡死切比例。
    includeFontFaces: false,
    backgroundImage,
    layoutVariant: renderOptions?.layoutVariant,
  });
  const titleEl = doc.createElement('h1');
  titleEl.className = 'fv-title-h';
  const body = doc.createElement('div');
  body.className = 'fv-body-h';

  // Minimal 版式：标题下方的正方形图片区域（仅首页显示，与标题同步）
  let minimalImageEl: HTMLElement | null = null;
  if (renderOptions?.layoutVariant === 'minimal') {
    minimalImageEl = doc.createElement('div');
    minimalImageEl.className = 'fv-minimal-image';
    if (renderOptions?.minimalImageUrl) {
      const img = doc.createElement('img');
      img.src = renderOptions.minimalImageUrl;
      img.alt = '';
      minimalImageEl.appendChild(img);
    } else {
      minimalImageEl.innerHTML =
        '<svg class="fv-minimal-image__placeholder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
    }
  }

  shell.appendChild(styleEl);
  shell.appendChild(titleEl);
  if (minimalImageEl) shell.appendChild(minimalImageEl);
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
        stampPosterTitleSerifClasses(titleEl, pipelineLang);
      } else {
        applyPosterTitleElement(titleEl, normalizedTitle, displayArtist, pipelineLang);
      }
      if (minimalImageEl) minimalImageEl.style.display = '';
    } else {
      titleEl.style.display = 'none';
      titleEl.textContent = '';
      if (minimalImageEl) minimalImageEl.style.display = 'none';
    }
    void shell.offsetHeight;
    applyPosterBodyMaxHeight(body, profile, {
      showTitle,
      titleEl: showTitle ? titleEl : null,
      layoutVariant: renderOptions?.layoutVariant,
      // Minimal 图片区仅在标题显示时展示（与标题同步），此时其高度需从正文可用空间扣除
      extraTopEl: showTitle ? minimalImageEl : null,
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

/** 单栏测量器（split 版式每个栏复用一个） */
export interface SplitColumnMeasurer {
  contentFits: (nodes: HTMLElement[], showTitle: boolean) => boolean;
  pageHtmlOverflows: (html: string, showTitle: boolean) => boolean;
}

/** 分栏版式测量器：外壳与标准版式完全一致（共享标题高度），但正文含左右两个独立栏 */
export interface SplitPosterMeasurer {
  shell: HTMLElement;
  titleEl: HTMLElement;
  left: SplitColumnMeasurer;
  right: SplitColumnMeasurer;
  setPageContext: (showTitle: boolean) => void;
  destroy: () => void;
}

/**
 * 分栏版式测量容器（左 65% 歌词 / 右 35% 词解+语法）。
 *
 * 结构与预览/导出 DOM 完全一致：shell > style + h1 + .fv-body-h > .fv-split-root > 两个 .fv-split-col.fv-body-h。
 * 每个栏带 `fv-body-h` class → 复用全部标准版式原子样式规则（lyrics-group 间距、字号等）。
 * 左右栏各自独立测量 scrollHeight>clientHeight，互不干扰高度，从根本上避免 notebook 的"单栏误测→静默放行截断"。
 *
 * 关键约束（与 createPosterMeasurer 同等重要）：
 * - wrapper position:relative + 固定 canvasW×canvasH（约束1）
 * - shell Object.assign(buildShufuriPosterRootStyle) 且 position:relative（约束2/3）
 * - 外 .fv-body-h 用 applyPosterBodyMaxHeight 约束高度（约束4/5），栏内 overflow:hidden 由 compileSplitCss 提供
 * - 注入 layoutVariant="split" + 渐变底色皮肤（与预览/导出一致）
 */
export function createSplitPosterMeasurer(
  doc: Document,
  profile: PosterLayoutProfile,
  title: string,
  artist?: string,
  spacingScale = 1,
  language: LyricsLanguage = 'jp',
  lang?: LangCode,
  titleMarkupHtml?: string,
  renderOptions?: PosterRenderOptions,
): SplitPosterMeasurer {
  const { width: canvasW, height: canvasH } = getShufuriPosterCanvasDimensions(profile);

  const wrapper = doc.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.left = '-99999px';
  wrapper.style.top = '0';
  wrapper.style.width = canvasW + 'px';
  wrapper.style.height = canvasH + 'px';
  wrapper.style.overflow = 'hidden';
  wrapper.style.pointerEvents = 'none';

  const backgroundImage = getPosterBackgroundUrl(renderOptions?.backgroundId);

  const shell = doc.createElement('div');
  shell.className = 'fv-html-poster-root';
  Object.assign(shell.style, buildShufuriPosterRootStyle(profile, backgroundImage));
  shell.style.position = 'relative';
  shell.dataset.rubyVisible = (renderOptions?.showRuby ?? true) ? 'true' : 'false';
  shell.dataset.layoutVariant = 'split';
  shell.dataset.exportRaster = '1';

  const styleEl = doc.createElement('style');
  const pipelineLang = resolvePosterPipelineLang(lang, '', language) ?? 'jp';
  styleEl.textContent = buildShufuriPosterInnerCss(profile, {
    spacingScale,
    language,
    lang: pipelineLang,
    colorTheme: getAppSettings().colorTheme,
    showRuby: renderOptions?.showRuby,
    userFontScale: renderOptions?.userFontScale,
    userLineHeightScale: renderOptions?.userLineHeightScale,
    includeFontFaces: false,
    backgroundImage,
    layoutVariant: 'split',
  });
  const titleEl = doc.createElement('h1');
  titleEl.className = 'fv-title-h';

  const outerBody = doc.createElement('div');
  outerBody.className = 'fv-body-h';
  const splitRoot = doc.createElement('div');
  splitRoot.className = 'fv-split-root';
  const leftBody = doc.createElement('div');
  leftBody.className = 'fv-split-col fv-body-h fv-split-col--left';
  const rightBody = doc.createElement('div');
  rightBody.className = 'fv-split-col fv-body-h fv-split-col--right';
  splitRoot.appendChild(leftBody);
  splitRoot.appendChild(rightBody);
  outerBody.appendChild(splitRoot);

  shell.appendChild(styleEl);
  shell.appendChild(titleEl);
  shell.appendChild(outerBody);
  wrapper.appendChild(shell);
  doc.body.appendChild(wrapper);

  const normalizedTitle = resolveDisplayTitle(title);
  const displayArtist = resolveDisplayArtist(artist);

  const setPageContext = (showTitle: boolean) => {
    if (showTitle) {
      titleEl.style.display = '';
      if (titleMarkupHtml?.trim()) {
        titleEl.innerHTML = titleMarkupHtml;
        stampPosterTitleSerifClasses(titleEl, pipelineLang);
      } else {
        applyPosterTitleElement(titleEl, normalizedTitle, displayArtist, pipelineLang);
      }
    } else {
      titleEl.style.display = 'none';
      titleEl.textContent = '';
    }
    void shell.offsetHeight;
    applyPosterBodyMaxHeight(outerBody, profile, {
      showTitle,
      titleEl: showTitle ? titleEl : null,
      layoutVariant: 'split',
    });
    void outerBody.offsetHeight;
  };

  const makeColumn = (colBody: HTMLElement): SplitColumnMeasurer => {
    const colOverflows = (): boolean => {
      void colBody.offsetHeight;
      const clientH = colBody.clientHeight;
      if (clientH >= 1) {
        return colBody.scrollHeight > clientH + FIT_EPSILON_PX;
      }
      const maxH =
        parseFloat(colBody.dataset.posterBodyMaxHeight || '') ||
        parseFloat(colBody.style.maxHeight);
      if (!Number.isFinite(maxH) || maxH <= 0) return true;
      return colBody.scrollHeight > maxH + FIT_EPSILON_PX;
    };
    return {
      contentFits: (nodes: HTMLElement[], showTitle: boolean): boolean => {
        if (nodes.length === 0) return true;
        setPageContext(showTitle);
        colBody.replaceChildren();
        for (const node of nodes) {
          colBody.appendChild(node.cloneNode(true));
        }
        return !colOverflows();
      },
      pageHtmlOverflows: (html: string, showTitle: boolean): boolean => {
        if (!html.trim()) return false;
        setPageContext(showTitle);
        colBody.innerHTML = html;
        return colOverflows();
      },
    };
  };

  return {
    shell,
    titleEl,
    left: makeColumn(leftBody),
    right: makeColumn(rightBody),
    setPageContext,
    destroy: () => {
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

function isExplainNotesSection(el: HTMLElement): boolean {
  return el.classList.contains('lyrics-explain-notes');
}

function mergeAdjacentSections(root: HTMLElement, sectionClass: string): void {
  let anchor: HTMLElement | null = null;
  for (const node of Array.from(root.children)) {
    if (!(node instanceof HTMLElement) || !node.classList.contains(sectionClass)) {
      anchor = null;
      continue;
    }
    // 划词笔记区保持独立，不与重点词汇/其它 vocabulary 区块合并（保留 force-next-page 与标题）
    if (sectionClass === 'lyrics-vocabulary' && isExplainNotesSection(node)) {
      anchor = null;
      continue;
    }
    if (!anchor) {
      anchor = node;
      continue;
    }
    if (sectionClass === 'lyrics-vocabulary' && isExplainNotesSection(anchor)) {
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

  // 划词笔记条目：保持整体，不拆分为 term/meaning/button 等子块
  // 否则会把一条笔记拆到不同页，造成视觉“截断/切行”。
  if (item.getAttribute('data-shufuri-explain-note') === '1') {
    return null;
  }

  // 中文语法条目不拆子块，避免标题/解释/例句各自带上项目符号
  if (item.classList.contains('lyrics-grammar-item--zh')) {
    return null;
  }

  const children = Array.from(item.children).filter(
    (n): n is Element =>
      n instanceof Element &&
      !n.classList.contains('shufuri-explain-note__delete') &&
      !n.classList.contains('shufuri-study-item__delete'),
  );
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
    // 分页拆条后每条只剩一行；标记组内/组间间距（minimal 等版式 CSS 消费）
    itemClone.dataset.studyPart = index < children.length - 1 ? 'continue' : 'end';
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

function pageBlocksForceNewPage(blocks: HTMLElement[]): boolean {
  return blocks.some(
    (b) =>
      b.getAttribute('data-lyrics-force-next-page') === '1' ||
      !!b.querySelector?.('[data-lyrics-force-next-page="1"]'),
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
    // 仅强制换页板块不并回上一页（避免破坏语义分组）；
    // 划词笔记整体允许合并到上一页（导出场景无需交互，合并安全）
    if (pageBlocksForceNewPage(last.blocks)) {
      break;
    }
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

  // 历史数据：划词笔记曾被写成 clip-body 的兄弟节点，分页会把整块 clip-body
  // 当成单一 atom → 全书挤进第 1 页。先把兄弟并回 clip-body 再展开。
  const clip = topKids.find(
    (k) => k.classList.contains('clip-body') || k.classList.contains('lyrics-notes-body'),
  );
  if (clip) {
    for (const kid of topKids) {
      if (kid !== clip) {
        clip.appendChild(kid);
      }
    }
    return clip;
  }

  if (topKids.length === 1) {
    const only = topKids[0]!;
    if (!only.classList.contains('lyrics-group')) {
      return only;
    }
  }
  // 多个并列 lyrics-group / section，或仅有单个 lyrics-group 时仍用 wrapper 保留全部兄弟节点
  return wrapper;
}

/**
 * 分栏版式：按原子类型分检（非按位置切分）。
 * 左栏 = 全部歌词组（.lyrics-group）；右栏 = 全部词解/语法段（.lyrics-vocabulary/.lyrics-grammar 及其 explode 子单元）。
 * 两栏各自保持原相对出现顺序，右栏无内容则为空。
 *
 * 注意：preparePaginationAtoms 已把 vocabulary/grammar 拆为 lyrics-pagination-unit，
 * 但 .lyrics 容器（包住全部 lyrics-group）本身是一个原子，需要展开为其子 .lyrics-group，
 * 否则会把一整段歌词当成一个不可拆原子 → 满页时静默放行截断（notebook 旧坑）。
 */
function splitAtomsByColumn(atoms: HTMLElement[]): { left: HTMLElement[]; right: HTMLElement[] } {
  const left: HTMLElement[] = [];
  const right: HTMLElement[] = [];
  const pushLeft = (atom: HTMLElement) => {
    if (atom.classList.contains('lyrics') || atom.classList.contains('lyrics-group--zh')) {
      // 展开歌词容器为单个 lyrics-group 原子（每首歌词组保持不可拆）
      const groups = Array.from(atom.children).filter(
        (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains('lyrics-group'),
      );
      if (groups.length > 0) {
        for (const g of groups) left.push(g);
        return;
      }
    }
    left.push(atom);
  };
  for (const atom of atoms) {
    if (atom.classList.contains('lyrics-group')) {
      left.push(atom);
    } else if (atom.classList.contains('lyrics')) {
      // .lyrics 容器：展开为子 lyrics-group
      const groups = Array.from(atom.children).filter(
        (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains('lyrics-group'),
      );
      if (groups.length > 0) {
        for (const g of groups) left.push(g);
      } else {
        left.push(atom);
      }
    } else if (
      atom.classList.contains('lyrics-vocabulary') ||
      atom.classList.contains('lyrics-grammar') ||
      atom.classList.contains('lyrics-pagination-unit')
    ) {
      right.push(atom);
    } else {
      // 其它原子（标题/空白/lyrics-group--zh 容器等）归入歌词侧的左栏，保持与原文顺序一致
      pushLeft(atom);
    }
  }
  return { left, right };
}

/** 将单栏兼容的 { contentFits, pageHtmlOverflows } 包装为 PosterMeasurer（split 列仅需这两个方法） */
function columnAsMeasurer(col: SplitColumnMeasurer): PosterMeasurer {
  return {
    contentFits: col.contentFits,
    pageHtmlOverflows: col.pageHtmlOverflows,
    pageOverflows: () => false,
    tuneCjkLineBreaksInPlace: () => 0,
    contentFitsInPlace: col.contentFits,
    dispose: () => {},
  };
}

function paginateSplitColumns(
  safeBodyHtml: string,
  title: string,
  profile: PosterLayoutProfile,
  doc: Document,
  artist: string | undefined,
  language: LyricsLanguage,
  lang: LangCode | undefined,
  titleMarkupHtml: string | undefined,
  renderOptions: PosterRenderOptions | undefined,
): PosterPageSlice[] {
  const wrapper = doc.createElement('div');
  wrapper.innerHTML = safeBodyHtml.trim();
  const bodyRoot = resolvePaginationBodyRoot(wrapper);
  normalizeBodyRoot(bodyRoot);

  let atoms = flattenAtoms(bodyRoot).filter((a) => !isSkippableAtom(a));
  atoms = repairLyricsGroupAtoms(atoms);
  atoms = preparePaginationAtoms(atoms);

  const { left, right } = splitAtomsByColumn(atoms);

  const splitMeasurer = createSplitPosterMeasurer(
    doc,
    profile,
    title,
    artist,
    1,
    language,
    lang,
    titleMarkupHtml,
    renderOptions ? { ...renderOptions, layoutVariant: 'split' } : { layoutVariant: 'split' },
  );

  try {
    // 左右栏各自独立贪心装箱 + 各自独立 verify/repair，互不干扰高度
    const leftPages = verifyAndRepairPages(
      flowAtomsIntoPages(left, columnAsMeasurer(splitMeasurer.left)),
      columnAsMeasurer(splitMeasurer.left),
    );
    const rightPages = verifyAndRepairPages(
      flowAtomsIntoPages(right, columnAsMeasurer(splitMeasurer.right)),
      columnAsMeasurer(splitMeasurer.right),
    );

    const pageCount = Math.max(leftPages.length, rightPages.length, 1);

    const slices: PosterPageSlice[] = [];
    for (let i = 0; i < pageCount; i += 1) {
      const leftBlocks = leftPages[i] ?? [];
      const rightBlocks = rightPages[i] ?? [];
      const leftEmitted = new Set<string>();
      const rightEmitted = new Set<string>();
      const leftHtml = leftBlocks.length ? joinPageBlocks(leftBlocks, leftEmitted) : '';
      const rightHtml = rightBlocks.length ? joinPageBlocks(rightBlocks, rightEmitted) : '';
      const splitHtml =
        `<div class="fv-split-root">` +
        `<div class="fv-split-col fv-body-h fv-split-col--left">${leftHtml}</div>` +
        `<div class="fv-split-col fv-body-h fv-split-col--right">${rightHtml}</div>` +
        `</div>`;
      slices.push({ html: splitHtml, spacingScale: 1 });
    }
    return slices.filter((slice) => pageHtmlHasContent(slice.html, doc));
  } finally {
    splitMeasurer.destroy();
  }
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

  // 分栏版式走独立的双栏分页路径（左右各自独立测量/分页，从根本上避免单栏误测截断）
  if (renderOptions?.layoutVariant === 'split') {
    return paginateSplitColumns(
      trimmed,
      title,
      profile,
      doc,
      artist,
      language,
      lang,
      titleMarkupHtml,
      renderOptions,
    );
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
