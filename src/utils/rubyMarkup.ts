import { escapeHtml } from './escapeHtml';

const RUBY_TOKEN_RE = /\{([^|\\{}]+)\|([^\\{}]+)\}/g;

/** 全角花括号 → 半角，便于统一匹配 */
function normalizeRubyBrackets(text: string): string {
  return text.replace(/\uFF5B/g, '{').replace(/\uFF5D/g, '}');
}

/**
 * 修复 AI 常见笔误：汉字后直接接 {读音} 却缺少管道符。
 * 例：{過|か}去{こ} → {過|か}{去|こ}；過去{かこ} → {過去|かこ}
 */
function repairShorthandRubyMarkup(text: string): string {
  const re = /([\u4e00-\u9fff々〆ヵヶ]+)\{([^|\\{}]+)\}/g;
  return text.replace(re, '{$1|$2}');
}

function normalizeRubyInput(text: string): string {
  return repairShorthandRubyMarkup(normalizeRubyBrackets(text));
}

/** 将 {基字|读音} 转为 <ruby>，其余文本 escape；未标注汉字原样保留 */
export function applyRubyMarkup(text: string): string {
  const normalized = normalizeRubyInput(text);
  let out = '';
  let last = 0;
  const re = new RegExp(RUBY_TOKEN_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized)) !== null) {
    out += escapeHtml(normalized.slice(last, m.index));
    out += `<ruby>${escapeHtml(m[1]!)}<rt>${escapeHtml(m[2]!)}</rt></ruby>`;
    last = m.index + m[0].length;
  }
  out += escapeHtml(normalized.slice(last));
  return out;
}

/** @internal 供测试：规范化后的 {Kanji|Kana} 文本 */
export function normalizeRubyMarkupText(text: string): string {
  return normalizeRubyInput(text);
}
