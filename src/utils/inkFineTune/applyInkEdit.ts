import { escapeHtml } from '../escapeHtml';

function parseBodyDoc(bodyHtml: string): { doc: Document; root: Element } | null {
  const doc = new DOMParser().parseFromString(
    `<div id="ink-edit-root">${bodyHtml}</div>`,
    'text/html',
  );
  const root = doc.getElementById('ink-edit-root');
  if (!root) return null;
  return { doc, root };
}

export function applyZhLineEdit(bodyHtml: string, groupIndex: number, newZh: string): string {
  const parsed = parseBodyDoc(bodyHtml);
  if (!parsed) return bodyHtml;

  const group = parsed.root.querySelector(`[data-ink-g="${groupIndex}"]`);
  const zhLine = group?.querySelector('.zh-line');
  if (!zhLine) return bodyHtml;

  zhLine.textContent = newZh.trim();
  return parsed.root.innerHTML;
}

export function applyRubyEdit(
  bodyHtml: string,
  groupIndex: number,
  rubyIndex: number,
  kanji: string,
  kana: string,
): string {
  const parsed = parseBodyDoc(bodyHtml);
  if (!parsed) return bodyHtml;

  const group = parsed.root.querySelector(`[data-ink-g="${groupIndex}"]`);
  const ruby = group?.querySelector(`.jp-line ruby[data-ink-r="${rubyIndex}"]`);
  if (!ruby) return bodyHtml;

  const k = kanji.trim();
  const ka = kana.trim();
  ruby.innerHTML = `${escapeHtml(k)}<rt>${escapeHtml(ka)}</rt>`;
  return parsed.root.innerHTML;
}
