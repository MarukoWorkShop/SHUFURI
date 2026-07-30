/**
 * 歌词语法词解缓存 4 维内容指纹
 *
 * 哈希种子：
 *   sourceLanguage | targetLanguage | pedagogicalLevel | SHA-256(normalizedBody)
 *
 * 设计原则：对歌词全文做激进去噪后取内容指纹，同一首歌不同格式粘贴也能命中。
 * 去噪规则：去注音 {漢字:かな} / {Hanzi:pinyin}、去 LRC 时间戳、折叠空行、NFKC 归一。
 */

/**
 * 去注音标记：{漢字:かな} → 漢字，{Hanzi:pinyin} → Hanzi
 * 支持嵌套（{abc{def:ghi}:jkl}），递归清理。
 */
function stripRubyAnnotations(text: string): string {
  let prev = text;
  for (;;) {
    // 匹配最内层的 {非:非} 注音对（value 中不含 {，key 中不含 :{,}）
    const next = prev.replace(/\{([^{}:]+):([^{}]+)\}/g, '$1');
    if (next === prev) break;
    prev = next;
  }
  return prev;
}

/**
 * 去 LRC 时间戳：[00:12.34]、[01:23.4]、[00:12:34] 等变体
 */
function stripLrcTimestamps(text: string): string {
  return text.replace(/\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/g, '');
}

/**
 * 歌词正文激进去噪，保留纯歌词核心文本。
 */
function normalizeLyricsBody(body: string): string {
  return body
    .split(/\r?\n/)
    .map((line) => {
      let l = line.trim();
      l = stripLrcTimestamps(l);
      l = stripRubyAnnotations(l);
      return l.trim();
    })
    .filter((l) => l.length > 0)       // 去除空行
    .join('\n')
    .normalize('NFKC');                 // 全角/半角/变体字统一
}

/**
 * 计算歌词 4 维内容指纹（外层 SHA-256 包裹内层 body SHA-256）。
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
  const normalizedBody = normalizeLyricsBody(params.confirmedLyrics);

  // 先对去噪后的正文做 SHA-256，得到稳定的内容指纹
  const bodyEncoder = new TextEncoder();
  const bodyData = bodyEncoder.encode(normalizedBody);
  const bodyHashBuffer = await crypto.subtle.digest('SHA-256', bodyData);
  const bodyHash = Array.from(new Uint8Array(bodyHashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // 4 维种子
  const seed = [
    params.sourceLanguage,
    params.targetLanguage,
    params.pedagogicalLevel,
    bodyHash,
  ].join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(seed);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
