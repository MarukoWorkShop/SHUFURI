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

export function applyGlossLineEdit(bodyHtml: string, groupIndex: number, newGloss: string): string {
  return applyZhLineEdit(bodyHtml, groupIndex, newGloss);
}

export function applyZhLineEdit(bodyHtml: string, groupIndex: number, newZh: string): string {
  const parsed = parseBodyDoc(bodyHtml);
  if (!parsed) return bodyHtml;

  const group = parsed.root.querySelector(`[data-ink-g="${groupIndex}"]`);
  const zhLine = group?.querySelector('.zh-line') ?? group?.querySelector('.gloss-line');
  if (!zhLine) return bodyHtml;

  zhLine.textContent = newZh.trim();
  return parsed.root.innerHTML;
}

export function applyKoLineEdit(bodyHtml: string, groupIndex: number, newKo: string): string {
  const parsed = parseBodyDoc(bodyHtml);
  if (!parsed) return bodyHtml;

  const group = parsed.root.querySelector(`[data-ink-g="${groupIndex}"]`);
  const koLine = group?.querySelector('.ko-line');
  if (!koLine) return bodyHtml;

  koLine.textContent = newKo.trim();
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
  const ruby = group?.querySelector(
    `.jp-line ruby[data-ink-r="${rubyIndex}"], .cn-line ruby[data-ink-r="${rubyIndex}"]`,
  );
  if (!ruby) return bodyHtml;

  const k = kanji.trim();
  const ka = kana.trim();
  ruby.innerHTML = `${escapeHtml(k)}<rt>${escapeHtml(ka)}</rt>`;
  if (ka) {
    ruby.removeAttribute('data-ink-empty-rt');
  } else {
    ruby.setAttribute('data-ink-empty-rt', '1');
  }
  return parsed.root.innerHTML;
}

/** 取消注音：将 ruby 元素替换为纯文本节点（不含 rt），方案 A 可逆。 */
export function applyRemoveRuby(
  bodyHtml: string,
  groupIndex: number,
  rubyIndex: number,
): string {
  const parsed = parseBodyDoc(bodyHtml);
  if (!parsed) return bodyHtml;

  const group = parsed.root.querySelector(`[data-ink-g="${groupIndex}"]`);
  const ruby = group?.querySelector(
    `.jp-line ruby[data-ink-r="${rubyIndex}"], .cn-line ruby[data-ink-r="${rubyIndex}"]`,
  );
  if (!ruby) return bodyHtml;

  // 提取 ruby 内部文本（不含 rt 内容）
  const text = Array.from(ruby.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE || (n.nodeName !== 'RT' && n.nodeName !== 'RP'))
    .map((n) => n.textContent ?? '')
    .join('');
  const textNode = parsed.doc.createTextNode(text);
  ruby.replaceWith(textNode);
  return parsed.root.innerHTML;
}

/** 整行日文编辑：替换整行 .jp-line 内容，由调用方重跑 sanitize+wrap 重建注音。 */
export function applyJpLineEdit(bodyHtml: string, groupIndex: number, newJp: string): string {
  const parsed = parseBodyDoc(bodyHtml);
  if (!parsed) return bodyHtml;

  const group = parsed.root.querySelector(`[data-ink-g="${groupIndex}"]`);
  const jpLine = group?.querySelector('.jp-line');
  if (!jpLine) return bodyHtml;

  jpLine.innerHTML = newJp.trim();
  return parsed.root.innerHTML;
}
