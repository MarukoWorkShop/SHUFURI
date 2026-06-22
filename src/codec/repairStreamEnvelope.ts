import { trimToStreamStart } from './stripStreamEnvelope';

const RECORD_LINE_RE = /^(H|L|V|G)\|/;
const SECTION_MARKER_RE = /^@\d+$/;
const STREAM_CLOSE_RE = /^@9(?:\||$)/;

/** 丢弃 @9 闭合行之后的 AI 说明文字（通义/豆包偶发） */
export function truncateAfterStreamClose(text: string): string {
  const lines = text.split(/\r\n|\n|\r/);
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (STREAM_CLOSE_RE.test(t)) {
      return lines.slice(0, i + 1).join('\n').trim();
    }
  }
  return text.trim();
}

/**
 * 保守补全缺失的 @9：仅当已有 H + L，且末行是 L/V/G 记录（无 AI 说明尾缀）。
 * 豆包已带 @9 时为 no-op；不会在 @1/@2 段标记或半截说明文字后误补。
 */
export function autoAppendStreamCloseIfNeeded(text: string): string {
  if (/(^|\n)@9(?:\||\s*$)/m.test(text)) {
    return text;
  }

  const lines = text.split(/\r\n|\n|\r/);
  let hasH = false;
  let hasL = false;
  let lastRecord = '';

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;

    if (RECORD_LINE_RE.test(t)) {
      if (t.startsWith('H|')) hasH = true;
      if (t.startsWith('L|')) hasL = true;
      lastRecord = t;
      continue;
    }

    if (SECTION_MARKER_RE.test(t)) {
      continue;
    }

    // 非记录行（说明文字、markdown 等）→ 不自动补全，避免污染豆包截断流
    return text;
  }

  if (!hasH || !hasL) return text;
  if (!/^(L|V|G)\|/.test(lastRecord)) return text;

  return `${text.trimEnd()}\n@9`;
}

/** 定位记录流起点 → 截断 @9 后噪音 → 必要时补 @9 */
export function normalizeStreamInput(raw: string): string {
  let s = trimToStreamStart(raw.trim());
  if (!s) return '';
  s = truncateAfterStreamClose(s);
  s = autoAppendStreamCloseIfNeeded(s);
  return s;
}
