/**
 * 歌词语法词解缓存 6 维结构哈希
 *
 * 哈希种子：
 *   sourceLanguage | targetLanguage | pedagogicalLevel | lineCount | firstLine | lastLine
 *
 * 设计原则：用结构维度替代全文哈希，同一首歌不同格式粘贴也能命中。
 */

/**
 * 单行归一化：trim + 折叠连续空格 + NFKC 统一全角/半角。
 */
function normalizeLine(line: string): string {
  return line
    .trim()
    .replace(/\s+/g, ' ') // 折叠连续空格（含全角空格 \u3000）
    .normalize('NFKC');    // 全角/半角/变体字统一
}

/**
 * 计算歌词 6 维结构指纹（SHA-256）。
 *
 * @param confirmedLyrics - 已确认的完整歌词纯文本
 * @param sourceLanguage  - 歌词源语言（如 jp），对应 activeTarget
 * @param targetLanguage  - 翻译/UI 目标语言（如 zh），对应 interfaceLanguage
 * @param pedagogicalLevel - 教学等级（beginner | intermediate | advanced）
 * @returns 64 位十六进制 SHA-256 哈希
 */
export async function computeLyricsHash(params: {
  confirmedLyrics: string;
  sourceLanguage: string;
  targetLanguage: string;
  pedagogicalLevel: string;
}): Promise<string> {
  // 切行，过滤空行
  const lines = params.confirmedLyrics
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const lineCount = lines.length;
  const firstLine = lineCount > 0 ? normalizeLine(lines[0]) : '';
  const lastLine = lineCount > 0 ? normalizeLine(lines[lineCount - 1]) : '';

  // 6 维种子
  const seed = [
    params.sourceLanguage,
    params.targetLanguage,
    params.pedagogicalLevel,
    String(lineCount),
    firstLine,
    lastLine,
  ].join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(seed);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
