import { normalizeRubyMarkupText } from '../utils/rubyMarkup';

const RUBY_TOKEN_RE = /\{([^|\\{}]+)\|([^\\{}]+)\}/g;

function lastNonWhitespaceChar(text: string): string {
  for (let i = text.length - 1; i >= 0; i -= 1) {
    const ch = text[i]!;
    if (!/\s/.test(ch)) return ch;
  }
  return '';
}

/**
 * 将 {漢|かな} 转为 Anki 假名格式。
 * - 首个 ruby token 前加 leading space
 * - 连续 ruby（前一字符为 ]）前强制加 space，避免 Anki 漏判第二组假名
 */
export function rubyToAnkiFurigana(text: string): string {
  const normalized = normalizeRubyMarkupText(text);
  let out = '';
  let last = 0;
  const re = new RegExp(RUBY_TOKEN_RE.source, 'g');
  let m: RegExpExecArray | null;

  while ((m = re.exec(normalized)) !== null) {
    out += normalized.slice(last, m.index);
    const segment = `${m[1]}[${m[2]}]`;
    const prevChar = lastNonWhitespaceChar(out);
    const needsSpace = out.length === 0 || prevChar === ']';
    out += (needsSpace ? ' ' : '') + segment;
    last = m.index + m[0].length;
  }

  out += normalized.slice(last);
  return out;
}
