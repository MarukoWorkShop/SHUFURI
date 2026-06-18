/** 歌词 HTML 本地归一化与校验（无 AI 依赖） */

import { cleanDoubaoPaste } from '../utils/cleanDoubaoPaste';
import { compileDocument, isLegacyStructuredLyricsText, isStreamCodecText } from '../codec';
import { extractStreamHeader } from '../codec/parseStream';
import {
  DEFAULT_ARTIST,
  normalizeArtistName,
} from '../utils/shufuriPoster/posterTitle';

import type { LangCode } from './appSettings';
import { getAppSettings } from './appSettings';

export type PreparedPasteForLayout = {
  bodyHtml: string;
  title?: string;
  artist?: string;
  lang?: LangCode;
};

/** 将粘贴内容（记录流或 HTML）转为可排版 bodyHtml */
export function preparePasteForLayout(raw: string): PreparedPasteForLayout {
  const trimmed = cleanDoubaoPaste(raw.trim());
  if (!trimmed) {
    throw new Error('粘贴内容为空');
  }

  if (isLegacyStructuredLyricsText(trimmed)) {
    throw new Error('旧版 ===BEGIN=== 格式已停用，请重新复制 AI 口令并粘贴新记录流（@0 … @9）');
  }

  if (isStreamCodecText(trimmed)) {
    const settings = getAppSettings();
    return compileDocument(trimmed, { interfaceLanguage: settings.interfaceLanguage });
  }

  if (isValidLyricsHtml(trimmed)) {
    return { bodyHtml: sanitizePastedHtml(trimmed) };
  }

  throw new Error('内容需为记录流（@0 … @9）或 HTML 片段');
}

/** 从 H 行或旧式 # 歌手《歌名》 提取歌手 */
export function extractArtistFromLyricsRaw(raw: string): string | null {
  const normalized = cleanDoubaoPaste(raw.replace(/\r\n/g, '\n'));
  const header = extractStreamHeader(normalized);
  if (header.artist && header.artist !== DEFAULT_ARTIST) {
    return header.artist;
  }
  const hash = normalized.match(/^#\s*(.+?)《[^》\n]+》/m);
  if (hash) {
    return normalizeArtistName(hash[1]!.trim()) ?? null;
  }
  const plain = normalized.match(/^(.+?)《[^》\n]+》\s*$/m);
  if (plain) {
    return normalizeArtistName(plain[1]!.trim()) ?? null;
  }
  return null;
}

function stripMarkdownHtmlFences(text: string): string {
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:html|HTML|xml)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }
  return t;
}

function ensureSectionPageBreakAttrs(html: string): string {
  let s = html.replace(
    /<div(\s+[^>]*class="[^"]*\blyrics-vocabulary\b[^"]*"[^>]*)>/gi,
    (full, attrs: string) => {
      if (/data-lyrics-force-next-page/i.test(attrs)) return full;
      return `<div${attrs} data-lyrics-force-next-page="1">`;
    },
  );
  s = s.replace(
    /<div(\s+[^>]*class="[^"]*\blyrics-grammar\b[^"]*"[^>]*)>/gi,
    (full, attrs: string) => {
      if (/data-lyrics-force-next-page/i.test(attrs)) return full;
      return `<div${attrs} data-lyrics-force-next-page="1">`;
    },
  );
  return s;
}

function wrapClipBody(html: string): string {
  const inner = html.trim();
  if (!inner) return '<div class="clip-body lyrics-notes-body"></div>';
  if (/class\s*=\s*["'][^"']*clip-body/i.test(inner)) {
    return ensureSectionPageBreakAttrs(inner);
  }
  return ensureSectionPageBreakAttrs(`<div class="clip-body lyrics-notes-body">${inner}</div>`);
}

/** 去除 markdown 围栏并补全 clip-body 包裹 */
export function sanitizePastedHtml(html: string): string {
  return wrapClipBody(stripMarkdownHtmlFences(html));
}

const LYRICS_HTML_MARKERS =
  /(?:class\s*=\s*["'][^"']*\b(?:jp-line|ko-line|cn-line|lyrics-group|lyrics-vocabulary|lyrics-grammar|clip-body)\b|<ruby\b)/i;

/** 轻量校验：非空 HTML 且含歌词相关标记 */
export function isValidLyricsHtml(html: string): boolean {
  const t = html.trim();
  if (!t || !t.includes('<')) return false;
  return LYRICS_HTML_MARKERS.test(t);
}

/** 补全词汇/语法板块的分页标记，并确保 clip-body 包裹（分页器需单一根或 clip-body） */
export function normalizeLyricsBodyHtml(html: string): string {
  return wrapClipBody(ensureSectionPageBreakAttrs(html.trim()));
}
