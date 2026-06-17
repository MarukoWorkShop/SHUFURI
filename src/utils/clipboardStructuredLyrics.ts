import type { LangCode } from '../services/appSettings';
import { cleanDoubaoPaste } from './cleanDoubaoPaste';
import {
  extractStructuredHeader,
  extractStructuredLang,
  isStructuredLyricsText,
} from './structuredLyricsParser';

export function prepareStructuredLyricsClipboardText(raw: string): string {
  return cleanDoubaoPaste(raw.trim());
}

/** 剪贴板内容是否为可排版的结构化歌词（与 preparePasteForLayout 同源判定） */
export function isStructuredLyricsClipboardText(raw: string): boolean {
  const trimmed = prepareStructuredLyricsClipboardText(raw);
  return trimmed.length > 0 && isStructuredLyricsText(trimmed);
}

export type StructuredLyricsCardFallbacks = {
  title?: string;
  artist?: string;
};

/** 从结构化歌词提取确认卡片展示用的歌名 / 歌手 */
export function getStructuredLyricsCardMeta(
  raw: string,
  fallbacks?: StructuredLyricsCardFallbacks,
): { title: string; artist: string; lang?: LangCode } | null {
  if (!isStructuredLyricsClipboardText(raw)) {
    return null;
  }
  const trimmed = prepareStructuredLyricsClipboardText(raw);
  const header = extractStructuredHeader(trimmed);
  const title =
    header.title?.trim() ||
    fallbacks?.title?.trim() ||
    '未知歌曲';
  const artist =
    header.artist?.trim() ||
    fallbacks?.artist?.trim() ||
    '';
  const lang = extractStructuredLang(trimmed);
  return { title, artist, lang };
}

/** 剪贴板内容哈希（前 200 字符），用于去重 */
export function clipboardContentHash(text: string): string {
  return text.trim().slice(0, 200);
}
