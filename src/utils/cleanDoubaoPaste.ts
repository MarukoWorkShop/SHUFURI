/**
 * 清理从豆包粘贴的污染文本，并定位 @0 记录流起点。
 */

import { stripMarkdownFences, trimToStreamStart } from '../codec/stripStreamEnvelope';

const STREAM_OPEN_RE = /^@0\s*$/;
const STREAM_HEADER_RE = /^H\|/;

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
  let text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return '';

  text = stripMarkdownFences(text);
  const lines = text.split('\n');
  const start = findStreamStart(lines);
  const tail = lines.slice(start);

  const cleaned = tail.filter((line) => !isPythonTrace(line)).join('\n').trim();
  return trimToStreamStart(cleaned);
}
