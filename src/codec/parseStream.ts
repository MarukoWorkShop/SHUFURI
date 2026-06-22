import type { LangCode } from '../services/appSettings';
import { splitStreamColumns } from './splitStreamColumns';
import { normalizeCodecRubyFields } from './normalizeCodecRuby';
import { normalizeStreamInput } from './repairStreamEnvelope';
import type { GrammarRow, LyricLine, StreamDocument, StreamHeader, StreamLang, VocabRow } from './types';

const VALID_LANGS = new Set<StreamLang>(['jp', 'ko', 'en', 'zh']);

function parseHeader(fields: string[]): StreamHeader {
  const [, artist = '', title = '', langRaw = ''] = fields;
  const lang = langRaw.trim().toLowerCase() as StreamLang;
  if (!VALID_LANGS.has(lang)) {
    throw new Error(`H 行语言码无效：${langRaw}`);
  }
  return { artist: artist.trim(), title: title.trim(), lang };
}

function parseLyric(fields: string[]): LyricLine {
  const [, indexRaw = '', primary = '', gloss = ''] = normalizeCodecRubyFields(fields);
  const index = Number.parseInt(indexRaw, 10);
  if (!Number.isFinite(index) || index < 1) {
    throw new Error(`L 行序号无效：${indexRaw}`);
  }
  return { index, primary: primary.trim(), gloss: gloss.trim() };
}

function parseVocab(fields: string[]): VocabRow {
  const normalized = normalizeCodecRubyFields(fields);
  const [, seqRaw = '', term = '', meaning = ''] = normalized;
  let lyricLineNo = '';
  let pedagogicalExample = '';
  let pedagogicalTranslation = '';

  if (normalized.length >= 7) {
    lyricLineNo = normalized[4]?.trim() ?? '';
    pedagogicalExample = normalized[5]?.trim() ?? '';
    pedagogicalTranslation = normalized[6]?.trim() ?? '';
  } else {
    const legacyRef = normalized[4]?.trim() ?? '';
    const legacyTrans = normalized[5]?.trim() ?? '';
    if (/^\d+$/.test(legacyRef)) {
      lyricLineNo = legacyRef;
      pedagogicalTranslation = legacyTrans;
    } else {
      pedagogicalExample = legacyRef;
      pedagogicalTranslation = legacyTrans;
    }
  }

  const seq = Number.parseInt(seqRaw, 10);
  if (!Number.isFinite(seq) || seq < 1) {
    throw new Error(`V 行序号无效：${seqRaw}`);
  }
  return {
    seq,
    term: term.trim(),
    meaning: meaning.trim(),
    lyricLineNo,
    pedagogicalExample,
    pedagogicalTranslation,
  };
}

function parseGrammar(fields: string[]): GrammarRow {
  const normalized = normalizeCodecRubyFields(fields);
  const [, seqRaw = '', label = '', detail = ''] = normalized;
  let lyricLineNo = '';
  let pedagogicalExample = '';
  let pedagogicalTranslation = '';

  if (normalized.length >= 7) {
    lyricLineNo = normalized[4]?.trim() ?? '';
    pedagogicalExample = normalized[5]?.trim() ?? '';
    pedagogicalTranslation = normalized[6]?.trim() ?? '';
  } else {
    const legacyRef = normalized[4]?.trim() ?? '';
    const legacyTrans = normalized[5]?.trim() ?? '';
    if (/^\d+$/.test(legacyRef)) {
      lyricLineNo = legacyRef;
      pedagogicalTranslation = legacyTrans;
    } else {
      pedagogicalExample = legacyRef;
      pedagogicalTranslation = legacyTrans;
    }
  }

  const seq = Number.parseInt(seqRaw, 10);
  if (!Number.isFinite(seq) || seq < 1) {
    throw new Error(`G 行序号无效：${seqRaw}`);
  }
  return {
    seq,
    label: label.trim(),
    detail: detail.trim(),
    lyricLineNo,
    pedagogicalExample,
    pedagogicalTranslation,
  };
}

export function parseStream(raw: string): StreamDocument {
  const text = normalizeStreamInput(raw.trim());
  if (!text) {
    throw new Error('空文本');
  }

  const lines = text.split(/\r\n|\n|\r/);
  let i = 0;
  let sawOpen = false;
  let closed = false;

  let header: StreamHeader | undefined;
  const lyrics: LyricLine[] = [];
  const vocab: VocabRow[] = [];
  const grammar: GrammarRow[] = [];

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
    if (/^@\d+$/.test(line)) {
      continue;
    }

    const fields = splitStreamColumns(line);
    const tag = fields[0]?.trim();
    if (!tag) continue;

    switch (tag) {
      case 'H': {
        if (header) throw new Error('重复的 H 行');
        header = parseHeader(fields);
        break;
      }
      case 'L':
        lyrics.push(parseLyric(fields));
        break;
      case 'V':
        vocab.push(parseVocab(fields));
        break;
      case 'G':
        grammar.push(parseGrammar(fields));
        break;
      default:
        throw new Error(`未知行类型：${tag}`);
    }
  }

  if (!sawOpen && !header && lines.some((l) => /^H\|/.test(l.trim()))) {
    sawOpen = true;
  }
  if (!header) {
    throw new Error('缺少 H 行（歌手|歌名|语言）');
  }
  if (!closed) {
    throw new Error('流未闭合：缺少 @9');
  }

  return { header, lyrics, vocab, grammar, closed };
}

export function extractStreamHeader(raw: string): { artist?: string; title?: string } {
  try {
    const doc = parseStream(raw);
    return { artist: doc.header.artist, title: doc.header.title };
  } catch {
    const text = normalizeStreamInput(raw.trim());
    for (const line of text.split(/\r\n|\n|\r/)) {
      const t = line.trim();
      if (!t.startsWith('H|')) continue;
      const fields = splitStreamColumns(t);
      return { artist: fields[1]?.trim(), title: fields[2]?.trim() };
    }
    return {};
  }
}

export function extractStreamLang(raw: string): LangCode | undefined {
  try {
    return parseStream(raw).header.lang;
  } catch {
    const text = normalizeStreamInput(raw.trim());
    for (const line of text.split(/\r\n|\n|\r/)) {
      const t = line.trim();
      if (!t.startsWith('H|')) continue;
      const lang = splitStreamColumns(t)[3]?.trim().toLowerCase();
      if (lang === 'jp' || lang === 'ko' || lang === 'en' || lang === 'zh') return lang;
    }
    return undefined;
  }
}
