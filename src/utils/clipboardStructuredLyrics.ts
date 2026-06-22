import type { LangCode } from '../services/appSettings';
import { cleanDoubaoPaste } from './cleanDoubaoPaste';
import { isLegacyStructuredLyricsText, isStreamCodecText } from '../codec';
import { parseStream } from '../codec/parseStream';
import { extractStreamHeader, extractStreamLang } from '../codec/parseStream';

export function prepareStructuredLyricsClipboardText(raw: string): string {
  return cleanDoubaoPaste(raw.trim());
}

/** 剪贴板内容是否为可排版的记录流（归一化后须能完整解析） */
export function isStructuredLyricsClipboardText(raw: string): boolean {
  const trimmed = prepareStructuredLyricsClipboardText(raw);
  if (!trimmed.length) return false;
  if (isLegacyStructuredLyricsText(trimmed)) return false;
  if (!isStreamCodecText(trimmed)) return false;
  try {
    parseStream(trimmed);
    return true;
  } catch {
    return false;
  }
}

export type StructuredLyricsCardFallbacks = {
  title?: string;
  artist?: string;
};

/** 从记录流提取确认卡片展示用的歌名 / 歌手 */
export function getStructuredLyricsCardMeta(
  raw: string,
  fallbacks?: StructuredLyricsCardFallbacks,
): { title: string; artist: string; lang?: LangCode } | null {
  if (!isStructuredLyricsClipboardText(raw)) {
    return null;
  }
  const trimmed = prepareStructuredLyricsClipboardText(raw);
  const header = extractStreamHeader(trimmed);
  const title =
    header.title?.trim() ||
    fallbacks?.title?.trim() ||
    '未知歌曲';
  const artist =
    header.artist?.trim() ||
    fallbacks?.artist?.trim() ||
    '';
  const lang = extractStreamLang(trimmed);
  return { title, artist, lang };
}

/** 剪贴板内容哈希（前 200 字符），用于去重 */
export function clipboardContentHash(text: string): string {
  return text.trim().slice(0, 200);
}
