import { normalizeStreamInput } from '../codec/repairStreamEnvelope';
import { parseStream } from '../codec/parseStream';
import { stripRubyPlain } from '../codec/validatePedagogicalExamples';
import type { LangCode } from '../services/appSettings';
import {
  getStructuredLyricsCardMeta,
  isStructuredLyricsClipboardText,
  prepareStructuredLyricsClipboardText,
} from './clipboardStructuredLyrics';

/** 是否为仅含 H+L（无 V/G）的歌词流 —— Step1 确认态 */
export function isLyricsOnlyStream(raw: string): boolean {
  if (!isStructuredLyricsClipboardText(raw)) return false;
  try {
    const doc = parseStream(prepareStructuredLyricsClipboardText(raw));
    return doc.vocab.length === 0 && doc.grammar.length === 0 && doc.lyrics.length > 0;
  } catch {
    return false;
  }
}

/** 是否已含学习材料（V 或 G）—— 可直接走旧确认卡排版 */
export function isStudyEnrichedStream(raw: string): boolean {
  if (!isStructuredLyricsClipboardText(raw)) return false;
  try {
    const doc = parseStream(prepareStructuredLyricsClipboardText(raw));
    return doc.vocab.length > 0 || doc.grammar.length > 0;
  } catch {
    return false;
  }
}

export type LyricPreviewLine = {
  index: number;
  text: string;
  gloss: string;
};

export type LyricConfirmPreview = {
  title: string;
  artist: string;
  lang?: LangCode;
  lineCount: number;
  lines: LyricPreviewLine[];
  /** 清洗后的完整记录流，供确认后排版 / 合并使用 */
  cleanedStream: string;
};

/** 从记录流提取确认页预览数据；非结构化文本返回 null */
export function getLyricConfirmPreview(
  raw: string,
  fallbacks?: { title?: string; artist?: string },
): LyricConfirmPreview | null {
  const meta = getStructuredLyricsCardMeta(raw, fallbacks);
  if (!meta) return null;
  const cleaned = prepareStructuredLyricsClipboardText(raw);
  try {
    const doc = parseStream(cleaned);
    const lines = doc.lyrics
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((l) => ({
        index: l.index,
        text: stripRubyPlain(l.primary).trim() || l.primary.trim(),
        gloss: l.gloss.trim(),
      }));
    return {
      title: meta.title,
      artist: meta.artist,
      lang: meta.lang,
      lineCount: lines.length,
      lines,
      cleanedStream: normalizeStreamInput(cleaned),
    };
  } catch {
    return null;
  }
}
