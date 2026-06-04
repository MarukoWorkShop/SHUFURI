/** 歌词 HTML 本地归一化与校验（无 AI 依赖） */

import { cleanDoubaoPaste } from '../utils/cleanDoubaoPaste';
import {
  isStructuredLyricsText,
  isStructuredMarkerLine,
  parseStructuredLyricsText,
  extractStructuredHeader,
} from '../utils/structuredLyricsParser';
import {
  DEFAULT_ARTIST,
  normalizeArtistName,
  PLACEHOLDER_TITLE,
} from '../utils/furiganaLayout/posterTitle';

export type PreparedPasteForLayout = {
  bodyHtml: string;
  title?: string;
  artist?: string;
};

/** 将粘贴内容（结构化文本或 HTML）转为可排版 bodyHtml */
export function preparePasteForLayout(raw: string): PreparedPasteForLayout {
  const trimmed = cleanDoubaoPaste(raw.trim());
  if (!trimmed) {
    throw new Error('粘贴内容为空');
  }

  if (isStructuredLyricsText(trimmed)) {
    return parseStructuredLyricsText(trimmed);
  }

  if (isValidLyricsHtml(trimmed)) {
    return { bodyHtml: sanitizePastedHtml(trimmed) };
  }

  throw new Error('内容需为 Shufu 结构化文本（===LYRICS===）或 HTML 片段');
}

/** 从粘贴内容提取歌名与歌手（优先结构化头部行，再回退《》解析） */
export function extractMetaFromPaste(raw: string): { title?: string; artist?: string } {
  const trimmed = cleanDoubaoPaste(raw.trim());
  if (isStructuredLyricsText(trimmed)) {
    const header = extractStructuredHeader(trimmed);
    if (header.title || header.artist) {
      return {
        ...(header.title ? { title: header.title } : {}),
        ...(header.artist ? { artist: header.artist } : {}),
      };
    }
  }
  const title = extractSongTitleFromLyricsRaw(trimmed);
  const artist = extractArtistFromLyricsRaw(trimmed);
  return {
    ...(title ? { title } : {}),
    ...(artist ? { artist } : {}),
  };
}

/** 粘贴内容是否可进入排版（有结构化歌词即可，歌名可后续占位） */
export function isPasteReadyForLayout(raw: string, _manualTitle?: string): boolean {
  const trimmed = cleanDoubaoPaste(raw.trim());
  if (!trimmed) {
    return false;
  }
  return isStructuredLyricsText(trimmed) || isValidLyricsHtml(trimmed);
}

/** 从用户粘贴的歌词中识别《》书名号或 # / 头部行的歌曲标题 */
export function extractSongTitleFromLyricsRaw(raw: string): string | null {
  const normalized = cleanDoubaoPaste(raw.replace(/\r\n/g, '\n'));
  const header = extractStructuredHeader(normalized);
  if (header.title) {
    return header.title;
  }

  const m = normalized.match(/《([^》\n]+)》/);
  const t1 = m?.[1]?.trim();
  if (t1 && t1.length > 0) {
    return t1;
  }

  const lines = normalized.split('\n');
  for (const line of lines) {
    const s = line.trim();
    if (!s || isStructuredMarkerLine(s)) {
      continue;
    }
    // 仅认 # 开头的标题行，避免把 ===BEGIN=== 等误判为歌名
    if (!/^#\s+/.test(s)) {
      continue;
    }
    const hash = s.replace(/^#+\s*/, '').trim();
    if (!hash || isStructuredMarkerLine(hash)) {
      continue;
    }
    const beforeParen = hash.split(/[（(《]/)[0]?.trim();
    if (beforeParen && beforeParen.length > 0 && beforeParen.length <= 80) {
      return beforeParen;
    }
  }
  return null;
}

/** 排版用歌名：均可缺省，由预览区占位显示 */
export function resolveLayoutTitle(
  manualTitle: string,
  parsedTitle?: string,
  metaTitle?: string,
): string {
  for (const candidate of [manualTitle, parsedTitle, metaTitle]) {
    const t = candidate?.trim();
    if (t && !isStructuredMarkerLine(t) && t !== PLACEHOLDER_TITLE) {
      return t;
    }
  }
  return '';
}

/** 排版用歌手：可缺省，预览区以「佚名」占位显示 */
export function resolveLayoutArtist(
  manualArtist: string,
  parsedArtist?: string,
  metaArtist?: string,
): string {
  for (const candidate of [manualArtist, parsedArtist, metaArtist]) {
    const a = normalizeArtistName(candidate);
    if (a && a !== DEFAULT_ARTIST) {
      return a;
    }
  }
  return '';
}

/** 从结构化粘贴文本的 # 歌手《歌名》 或 歌手《歌名》 行提取歌手 */
export function extractArtistFromLyricsRaw(raw: string): string | null {
  const normalized = cleanDoubaoPaste(raw.replace(/\r\n/g, '\n'));
  const header = extractStructuredHeader(normalized);
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
  /(?:class\s*=\s*["'][^"']*\b(?:jp-line|lyrics-group|lyrics-vocabulary|lyrics-grammar|clip-body)\b|<ruby\b)/i;

/** 轻量校验：非空 HTML 且含歌词相关标记 */
export function isValidLyricsHtml(html: string): boolean {
  const t = html.trim();
  if (!t || !t.includes('<')) return false;
  return LYRICS_HTML_MARKERS.test(t);
}

/** 补全词汇/语法板块的分页标记（打开旧歌词库记录时也会用到） */
export function normalizeLyricsBodyHtml(html: string): string {
  return ensureSectionPageBreakAttrs(html.trim());
}
