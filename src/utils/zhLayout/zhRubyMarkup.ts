import { escapeHtml } from '../escapeHtml';
import { normalizeRubyMarkupText } from '../rubyMarkup';

const RUBY_TOKEN_RE = /\{([^|\\{}]+)\|([^\\{}]+)\}/g;

/** CJK 统一汉字 + 扩展 A（含繁体常用区） */
function isHanzi(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf);
}

function splitPinyinSyllables(reading: string): string[] {
  return reading.trim().split(/\s+/).filter(Boolean);
}

/** 为 N 个汉字分配 N 个读音（拼音音节或注音字符） */
function assignReadings(hanziCount: number, reading: string): string[] {
  if (hanziCount <= 0) return [];

  const trimmed = reading.trim();
  const syllables = splitPinyinSyllables(trimmed);

  if (syllables.length === hanziCount) return syllables;

  const compact = trimmed.replace(/\s+/g, '');
  const compactChars = [...compact];
  if (compactChars.length === hanziCount) return compactChars;

  if (syllables.length > hanziCount) {
    return syllables.slice(0, hanziCount);
  }

  if (syllables.length > 0 && syllables.length < hanziCount) {
    return Array.from({ length: hanziCount }, (_, i) => syllables[i] ?? '');
  }

  return Array.from({ length: hanziCount }, () => trimmed);
}

/** 字距挂在外层 slot，避免 WebKit 在 ruby 上使用 margin/inline-block 导致 rt 左移一格 */
export const ZH_CHAR_SLOT_CLASS = 'zh-char-slot';

function singleRuby(base: string, reading: string): string {
  const ruby = `<ruby>${escapeHtml(base)}<rt>${escapeHtml(reading)}</rt></ruby>`;
  return `<span class="${ZH_CHAR_SLOT_CLASS}">${ruby}</span>`;
}

/** 将多字 {词|读音} 拆为单字 <ruby>，避免 WebKit 整词 rt 拉伸错位 */
function expandToAtomicRubies(base: string, reading: string): string {
  const chars = [...base];
  if (chars.length <= 1) {
    return singleRuby(base, reading);
  }

  const hanziIndices: number[] = [];
  chars.forEach((ch, i) => {
    if (isHanzi(ch)) hanziIndices.push(i);
  });

  if (hanziIndices.length === 0) {
    return escapeHtml(base);
  }

  const readings = assignReadings(hanziIndices.length, reading);
  let ri = 0;

  return chars
    .map((ch) => {
      if (!isHanzi(ch)) return escapeHtml(ch);
      const rt = readings[ri++] ?? '';
      return singleRuby(ch, rt);
    })
    .join('');
}

/**
 * 中文管线专用：{汉字|拼音} → 单字 <ruby> 链；非注音片段 escape。
 * 不修改 applyRubyMarkup，日语文本不受影响。
 */
export function applyZhRubyMarkup(text: string): string {
  const normalized = normalizeRubyMarkupText(text);
  let out = '';
  let last = 0;
  const re = new RegExp(RUBY_TOKEN_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized)) !== null) {
    out += escapeHtml(normalized.slice(last, m.index));
    out += expandToAtomicRubies(m[1]!, m[2]!);
    last = m.index + m[0].length;
  }
  out += escapeHtml(normalized.slice(last));
  return out;
}

/** @internal */
export function expandZhRubyForTest(base: string, reading: string): string {
  return expandToAtomicRubies(base, reading);
}
