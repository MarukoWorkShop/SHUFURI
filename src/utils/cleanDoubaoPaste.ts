/**
 * 清理从豆包粘贴的污染文本。
 *
 * 手机端豆包输出的结构化歌词文本可能被错误添加 Python 代码前缀
 *（如 "import re"、代码块围栏、校验输出痕迹等），导致粘贴后
 * 格式无法匹配。本模块在粘贴入口处自动清洗，对用户透明。
 */

import { normalizeStructuredLyricsText } from './structuredLyricsParser';

const BEGIN_MARKER = '===BEGIN===';
const END_MARKER = '===END===';

const STANDALONE_BEGIN_RE = /^===BEGIN===\s*$/i;
const STANDALONE_LYRICS_RE = /^===LYRICS===\s*$/i;
const STANDALONE_SECTION_RE = /^===(?:BEGIN|LYRICS|VOCAB|GRAMMAR)===\s*$/i;
const STANDALONE_END_RE = /^===END===\s*$/i;
const BLOCK_DELIMITER_RE = /^---(?:PAIR|WORD|POINT|END)(?:---|===)\s*$/i;
const TITLE_LINE_RE = /^(?:#\s*)?.+《[^》\n]+》\s*$/;

// ── 豆包校验输出常见痕迹 ──────────────────────────────
const PYTHON_TRACE_PATTERNS: RegExp[] = [
  /^import\s+\w+\b/,
  /^from\s+\w+\s+import\b/,
  /^print\s*\(/,
  /^>>>/,
  /^\.\.\./,
  /^In\s*\[\d+\]:/,
  /^Out\s*\[\d+\]:/,
  /⚠️\s*校验失败/,
  /⚠️\s*校验/,
  /校验失败/,
  /校验通过/,
  /检测到.*错误/,
  /未通过.*校验/,
  /^```\w*$/,
  /^Traceback\s/,
  /^File\s+"[^"]+\.py"/,
  /^\s*\^+$/,
  /^SyntaxError/,
  /^TypeError/,
  /^ValueError/,
  /^def\s+\w+\s*\(/,
  /^class\s+\w+/,
  /^@\w+/,
  /^if\s+__name__\s*==/,
  /^#.*$/,
  /^\w+\s*=\s*"""/,
  /^\s*"""\s*$/,
  /^\w+\s*=\s*\[/,
  /^\s*\]\s*$/,
  /^\s*\)\s*$/,
];

const TRACE_SENTENCES = [
  '以下是处理后的',
  '处理结果如下',
  '校验输出',
  '执行结果',
  '输出内容',
  '导入成功',
  '运行成功',
  '已校验',
];

function isPythonTrace(line: string): boolean {
  const stripped = line.trim();
  // Shufu 标准头部行以 # 开头，不可当作 Python 注释剔除
  if (TITLE_LINE_RE.test(stripped)) {
    return false;
  }
  return PYTHON_TRACE_PATTERNS.some((re) => re.test(stripped));
}

function isTraceSentence(line: string): boolean {
  return TRACE_SENTENCES.some((s) => line.includes(s));
}

/** 是否含独立成行（非 print 字符串内）的结构化区段标记 */
function hasStandaloneStructuredMarkers(text: string): boolean {
  return text.split('\n').some((line) => {
    const s = line.trim();
    return STANDALONE_BEGIN_RE.test(s) || STANDALONE_LYRICS_RE.test(s);
  });
}

/**
 * 定位有效结构化正文起点。
 * 优先取最后一个含 LYRICS+PAIR 的 ===BEGIN===（豆包常在 Python 代码后再附完整块）；
 * 否则回退到首个 BEGIN / LYRICS 行。
 */
function findStructuredContentStart(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!STANDALONE_BEGIN_RE.test(lines[i]!.trim())) {
      continue;
    }
    const tail = lines.slice(i).join('\n');
    if (/===LYRICS===/i.test(tail) && /---PAIR---/i.test(tail)) {
      return i;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i]!.trim();
    if (STANDALONE_BEGIN_RE.test(stripped) || STANDALONE_LYRICS_RE.test(stripped)) {
      return i;
    }
  }
  return -1;
}

function removeCodeFences(text: string): string {
  let t = text.trim();
  t = t.replace(/^```(?:\w+)?\s*/i, '');
  t = t.replace(/```\s*$/i, '');
  return t;
}

export function cleanDoubaoPaste(raw: string): string {
  let text = normalizeStructuredLyricsText(raw.trim());
  if (!text) return text;

  if (!hasStandaloneStructuredMarkers(text)) {
    return text;
  }

  text = removeCodeFences(text);

  const lines = text.split('\n');
  const startIdx = findStructuredContentStart(lines);
  if (startIdx >= 0) {
    const firstLine = lines[startIdx]!.trim();
    if (STANDALONE_BEGIN_RE.test(firstLine)) {
      text = lines.slice(startIdx).join('\n');
    } else if (STANDALONE_LYRICS_RE.test(firstLine)) {
      const headerLines = lines
        .slice(0, startIdx)
        .map((l) => l.trim())
        .filter((l) => l && TITLE_LINE_RE.test(l));
      text = [BEGIN_MARKER, ...headerLines, ...lines.slice(startIdx)].join('\n');
    }
  }

  const allLines = text.split('\n');
  const cleaned: string[] = [];
  let inSection = false;

  for (const line of allLines) {
    const stripped = line.trim();

    if (STANDALONE_SECTION_RE.test(stripped)) {
      inSection = true;
      cleaned.push(line);
      continue;
    }
    if (STANDALONE_END_RE.test(stripped)) {
      inSection = false;
      cleaned.push(line);
      continue;
    }

    if (BLOCK_DELIMITER_RE.test(stripped)) {
      cleaned.push(line.replace(/---END===/i, '---END---'));
      continue;
    }

    if (!inSection) {
      if (TITLE_LINE_RE.test(stripped)) {
        cleaned.push(line);
      }
      continue;
    }

    if (isPythonTrace(stripped) || isTraceSentence(stripped)) {
      continue;
    }

    cleaned.push(line);
  }

  text = cleaned.join('\n');
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  if (!/===END===\s*$/im.test(text)) {
    const endMarkerMatch = text.match(/===(?:BEGIN|LYRICS|VOCAB|GRAMMAR)===/gi);
    if (endMarkerMatch) {
      text = text.replace(/\n{2,}$/, '\n');
      text += '\n' + END_MARKER;
    }
  }

  return text;
}
