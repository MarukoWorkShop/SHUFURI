import { parseStream } from '../codec/parseStream';
import type { StreamDocument } from '../codec/types';

// ---- 校验结果类型 ----

export type LyricsValidationResult =
  | { ok: true; document: StreamDocument }
  | {
      ok: false;
      reason: 'format_parse_failed';
      message: string;
      /** parse 失败时不存在 document */
      document?: undefined;
    }
  | {
      ok: false;
      reason: 'title_mismatch';
      message: string;
      returnedTitle: string;
      expectedTitle: string;
      document: StreamDocument;
    }
  | {
      ok: false;
      reason: 'too_few_lines';
      message: string;
      lineCount: number;
      document: StreamDocument;
    }
  | {
      ok: false;
      reason: 'no_lyrics';
      message: string;
      document: StreamDocument;
    };

export interface LyricsValidationOptions {
  expectedTitle: string;
  /** 最低要求的歌词行数（不含 H），默认 4 */
  minLyricLines?: number;
  /** 标题模糊匹配阈值 0-1，默认 0.6 */
  titleMatchThreshold?: number;
}

// ---- 主校验函数 ----

export function validateLyricsResult(
  raw: string,
  options: LyricsValidationOptions,
): LyricsValidationResult {
  const { expectedTitle, minLyricLines = 4, titleMatchThreshold = 0.6 } = options;

  // L1: 格式可解析
  let document: StreamDocument;
  try {
    document = parseStream(raw);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: 'format_parse_failed', message: `无法解析 AI 返回结果: ${msg}` };
  }

  // L2: 标题模糊匹配
  const returnedTitle = document.header.title;
  if (!fuzzyTitleMatch(returnedTitle, expectedTitle, titleMatchThreshold)) {
    return {
      ok: false,
      reason: 'title_mismatch',
      message: `AI 返回的歌词标题为「${returnedTitle}」，与输入「${expectedTitle}」不匹配`,
      returnedTitle,
      expectedTitle,
      document,
    };
  }

  // L3: 行数下限
  const lineCount = document.lyrics.length;
  if (lineCount === 0) {
    return { ok: false, reason: 'no_lyrics', message: 'AI 未返回任何歌词行', document };
  }
  if (lineCount < minLyricLines) {
    return {
      ok: false,
      reason: 'too_few_lines',
      message: `AI 仅返回了 ${lineCount} 行歌词（最少需要 ${minLyricLines} 行），可能不完整`,
      lineCount,
      document,
    };
  }

  // 全部通过
  return { ok: true, document };
}

// ---- 辅助: 标题模糊匹配 ----

export function fuzzyTitleMatch(
  returned: string,
  expected: string,
  threshold = 0.6,
): boolean {
  const n1 = normalizeTitle(returned);
  const n2 = normalizeTitle(expected);
  if (!n1 || !n2) return false;

  // 精确匹配
  if (n1 === n2) return true;

  // 包含匹配（"秋桜" 包含于 "秋樱" 或反之）
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // 编辑距离相似度
  const dist = levenshteinDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  return 1 - dist / maxLen >= threshold;
}

function normalizeTitle(s: string): string {
  return s
    .replace(/[（(][^）)]*[）)]/g, '') // 去全/半角括号内容
    .replace(/[《》「」『』""''\[\]【】]/g, '') // 去书名号和引号
    .replace(/[〜～~\-–—·・／/　 \t]/g, '') // 去空格和连接符
    .replace(/[!！?？,，.。;；:：、]/g, '') // 去标点
    .toLowerCase();
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // 单行数组滚动优化
  const prev = new Uint16Array(n + 1);
  const curr = new Uint16Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev.set(curr);
  }
  return curr[n];
}
