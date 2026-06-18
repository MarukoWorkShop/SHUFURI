import { escapeHtml } from '../utils/escapeHtml';
import { applyRubyMarkup } from '../utils/rubyMarkup';

const ANKI_RUBY_RE = /([^\[\s\]]+)\[([^\]]+)\]/g;

/** Anki 格式  切[せつ]ない → 可视化 ruby HTML */
export function ankiFuriganaToRubyHtml(text: string): string {
  let html = '';
  let last = 0;
  const re = new RegExp(ANKI_RUBY_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    html += escapeHtml(text.slice(last, m.index));
    html += `<ruby>${escapeHtml(m[1]!)}<rt>${escapeHtml(m[2]!)}</rt></ruby>`;
    last = m.index + m[0].length;
  }
  html += escapeHtml(text.slice(last));
  return html.trim();
}

export function hasAnkiFuriganaMarkup(text: string): boolean {
  return /([^\[\s\]]+)\[([^\]]+)\]/.test(text);
}

/** 例句展示：优先 Anki 格式，否则 {漢|かな} ruby */
export function lyricLineToDisplayHtml(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (hasAnkiFuriganaMarkup(trimmed)) {
    ANKI_RUBY_RE.lastIndex = 0;
    return ankiFuriganaToRubyHtml(trimmed);
  }
  if (trimmed.includes('{') && trimmed.includes('|')) {
    return applyRubyMarkup(trimmed);
  }
  return escapeHtml(trimmed);
}
