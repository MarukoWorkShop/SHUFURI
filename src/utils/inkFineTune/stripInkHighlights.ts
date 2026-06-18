function unwrapElement(el: HTMLElement): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el);
  }
  parent.removeChild(el);
}

const LEGACY_WRAPPER_SELECTORS = [
  '[data-ink-hl="tint"]',
  'mark.ink-tint',
  'span.ink-highlight--plain',
  'span.ink-highlight',
] as const;

const MARK_WRAPPER_SELECTORS = ['[data-ink-mark="1"]'] as const;

const INK_MARKERS = [
  'ink-highlight',
  'data-ink-hl',
  'ink-tint',
  'ink-highlight--plain',
  'data-ink-mark',
  'ink-mark',
] as const;

/** 移除旧版笔刷与马克笔 markup，恢复纯文本结构 */
export function stripLegacyInkHighlightsFromHtml(html: string): string {
  if (!INK_MARKERS.some((m) => html.includes(m))) {
    return html;
  }

  const doc = new DOMParser().parseFromString(`<div id="strip-root">${html}</div>`, 'text/html');
  const root = doc.getElementById('strip-root');
  if (!root) return html;

  for (const sel of LEGACY_WRAPPER_SELECTORS) {
    const wrappers = Array.from(root.querySelectorAll(sel));
    for (const wrapper of wrappers) {
      if (!wrapper.querySelector('ruby')) continue;
      unwrapElement(wrapper as HTMLElement);
    }
  }

  for (const sel of [...LEGACY_WRAPPER_SELECTORS, ...MARK_WRAPPER_SELECTORS]) {
    root.querySelectorAll(sel).forEach((el) => {
      unwrapElement(el as HTMLElement);
    });
  }

  root.querySelectorAll('ruby, rt').forEach((el) => {
    el.classList.remove(
      'ink-highlight',
      'ink-highlight--ko',
      'ink-highlight--plain',
      'ink-highlight--fade-out',
      'ink-mark',
    );
    el.removeAttribute('data-ink-hl');
    if (el instanceof HTMLElement) {
      el.style.removeProperty('color');
      el.style.removeProperty('-webkit-text-fill-color');
      el.style.removeProperty('background-image');
      el.style.removeProperty('background');
    }
  });

  return root.innerHTML;
}

/** @deprecated 使用 stripLegacyInkHighlightsFromHtml */
export const stripInkHighlightsFromHtml = stripLegacyInkHighlightsFromHtml;
