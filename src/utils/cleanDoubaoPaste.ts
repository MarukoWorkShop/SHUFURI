/**
 * 清理从豆包粘贴的污染文本，并定位 @0 记录流起点。
 */

import { stripMarkdownFences } from '../codec/stripStreamEnvelope';
import { normalizeStreamInput } from '../codec/repairStreamEnvelope';

const STREAM_OPEN_RE = /^@0\s*$/;
const STREAM_HEADER_RE = /^H\|/;

/**
 * 归一化豆包输出中常见的字符异化问题。
 *
 * 豆包在中文上下文中常误将流控字符输出为全角形式：
 * - 全角竖线 U+FF5C → 半角 |（splitStreamColumns 只认半角 |，全角会导致字段无法切分）
 * - 全角 at U+FF20 → 半角 @（@0/@9 标记匹配失败）
 * - 全角字母/数字 → 半角（H/L/V/G 标签、序号被全角化后 switch/match 全线失败）
 *
 * 统一做法：将 U+FF01-U+FF5E（全角 ASCII 可打印字符区）整体映射回半角。
 * 中日韩歌词内容均在 BMP 高位，不受影响。
 *
 * 同时剔除零宽字符（ZWSP/ZWNJ/ZWJ/BOM），它们会破坏行匹配和字段切分。
 */
function normalizeDoubaoCharacters(raw: string): string {
  let s = raw;
  // 全角 ASCII 可打印符 → 半角（U+FF01..U+FF5E → U+0021..U+007E，偏移 0xFEE0）
  // 涵盖：｜→| ＠→@ ０-９→0-9 Ａ-Ｚ→A-Z ａ-ｚ→a-z 等全部
  s = s.replace(/[\uFF01-\uFF5E]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
  // 零宽空格 U+200B、ZWNJ U+200C、ZWJ U+200D、BOM U+FEFF
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
  return s;
}

const PYTHON_TRACE_PATTERNS: RegExp[] = [
  /^import\s+\w+\b/,
  /^from\s+\w+\s+import\b/,
  /^print\s*\(/,
  /^>>>/,
  /^\.\.\./,
  /^In\s*\[\d+\]:/,
  /^Out\s*\[\d+\]:/,
  /⚠️\s*校验/,
  /校验失败/,
  /校验通过/,
  /^```\w*$/,
  /^Traceback\s/,
  /^File\s+"[^"]+\.py"/,
  /^SyntaxError/,
  /^def\s+\w+\s*\(/,
  /^if\s+__name__\s*==/,
];

function isPythonTrace(line: string): boolean {
  const stripped = line.trim();
  if (STREAM_OPEN_RE.test(stripped) || STREAM_HEADER_RE.test(stripped)) return false;
  return PYTHON_TRACE_PATTERNS.some((re) => re.test(stripped));
}

function findStreamStart(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i]!.trim();
    if (STREAM_OPEN_RE.test(t)) return i;
  }
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (STREAM_OPEN_RE.test(t) || STREAM_HEADER_RE.test(t)) return i;
  }
  return 0;
}

/** 去掉 Python 污染与 markdown 围栏，保留 @0…@9 记录流 */
export function cleanDoubaoPaste(raw: string): string {
  // 第一道防线：归一化豆包的全角/零宽字符，避免后续 split/match 全线失败
  let text = normalizeDoubaoCharacters(raw)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  if (!text) {
    console.log('[cleanDoubaoPaste] 归一化后为空');
    return '';
  }

  text = stripMarkdownFences(text);
  const lines = text.split('\n');
  const start = findStreamStart(lines);
  const tail = lines.slice(start);

  const cleaned = tail.filter((line) => !isPythonTrace(line)).join('\n').trim();
  return normalizeStreamInput(cleaned);
}
