import { compileStreamDocument } from './roleCompiler';
import { parseStream } from './parseStream';
import { normalizeStreamInput } from './repairStreamEnvelope';
import { splitStreamColumns } from './splitStreamColumns';
import { normalizeCodecRubyFields } from './normalizeCodecRuby';
import { warnPedagogicalLyricCopies } from './validatePedagogicalExamples';
import type {
  CompileOptions,
  ParsedStreamLyrics,
  StreamDocument,
} from './types';

/**
 * 宽松模式解析：逐行跳过无法解析的 L/V/G 行（纯哼唱/拟声词段落常触发）。
 * H 行和 @0/@9 必须存在，否则仍抛异常。
 */
function parseStreamLenient(raw: string): StreamDocument {
  const text = normalizeStreamInput(raw.trim());
  if (!text) throw new Error('空文本');

  const lines = text.split(/\r\n|\n|\r/);
  let i = 0;
  let sawOpen = false;
  let closed = false;

  let header: StreamDocument['header'] | undefined;
  const lyrics: StreamDocument['lyrics'] = [];
  const vocab: StreamDocument['vocab'] = [];
  const grammar: StreamDocument['grammar'] = [];

  while (i < lines.length) {
    const line = lines[i]!.trim();
    i += 1;
    if (!line) continue;

    if (line === '@0') {
      sawOpen = true;
      continue;
    }
    if (line === '@9' || line.startsWith('@9|')) {
      closed = true;
      break;
    }
    if (/^@\d+$/.test(line)) continue;

    const fields = splitStreamColumns(line);
    const tag = fields[0]?.trim();
    if (!tag) continue;

    try {
      switch (tag) {
        case 'H': {
          if (header) throw new Error('重复的 H 行');
          // 复用 parseHeader 逻辑
          const [, artist = '', title = '', langRaw = ''] = fields;
          const lang = langRaw.trim().toLowerCase() as StreamDocument['header']['lang'];
          const validLangs = new Set(['jp', 'ko', 'en', 'zh']);
          if (!validLangs.has(lang)) throw new Error(`H 行语言码无效：${langRaw}`);
          header = { artist: artist.trim(), title: title.trim(), lang };
          break;
        }
        case 'L': {
          const [, indexRaw = '', primary = '', gloss = ''] = normalizeCodecRubyFields(fields);
          const index = Number.parseInt(indexRaw, 10);
          if (!Number.isFinite(index) || index < 1) throw new Error(`L 行序号无效：${indexRaw}`);
          lyrics.push({ index, primary: primary.trim(), gloss: gloss.trim() });
          break;
        }
        case 'V':
        case 'G':
          // V/G 行出错也跳过（词汇/语法行偶尔也有格式问题）
          break;
        default:
          throw new Error(`未知行类型：${tag}`);
      }
    } catch {
      // 跳过有问题的行（纯哼唱段落、格式偏差等）
      console.warn(`[compileDocument] 宽松模式跳过异常行: ${line.slice(0, 80)}`);
    }
  }

  if (!sawOpen && !header && lines.some((l) => /^H\|/.test(l.trim()))) sawOpen = true;
  if (!header) throw new Error('缺少 H 行（歌手|歌名|语言）');
  if (!closed) throw new Error('流未闭合：缺少 @9');

  return { header, lyrics, vocab, grammar, closed };
}

export function compileDocument(raw: string, opts?: CompileOptions): ParsedStreamLyrics {
  let document: StreamDocument;
  let lenient = false;

  try {
    document = parseStream(raw);
  } catch (firstErr) {
    // 首次失败 → 尝试宽松模式（跳过有问题的 L 行）
    try {
      document = parseStreamLenient(raw);
      lenient = true;
      console.warn(
        `[compileDocument] 严格模式失败，已切换宽松模式（跳过异常行）。原始错误:`,
        firstErr instanceof Error ? firstErr.message : firstErr,
      );
    } catch {
      // 宽松模式也失败 → 抛出原始异常
      throw firstErr;
    }
  }

  warnPedagogicalLyricCopies(document);
  const bodyHtml = compileStreamDocument(document, opts);
  return {
    bodyHtml,
    title: document.header.title,
    artist: document.header.artist,
    lang: document.header.lang,
    document,
    lenient,
  };
}

export function normalizeStreamText(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}
