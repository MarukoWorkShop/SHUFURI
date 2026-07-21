import type { LangCode } from '../../services/appSettings';
import { escapeHtml } from '../escapeHtml.ts';
import {
  resolveTitleFieldSerifOverride,
  titleSerifClassName,
} from './titleSerifScript.ts';

export const DEFAULT_ARTIST = '佚名';
/** 预览区歌名缺失时的占位文案（浅灰显示，非报错） */
export const PLACEHOLDER_TITLE = '歌名待填';

export function normalizeArtistName(artist?: string | null): string | undefined {
  const a = artist?.trim();
  if (!a || a === 'N/A') {
    return undefined;
  }
  return a;
}

export function resolveDisplayArtist(artist?: string | null): string {
  return normalizeArtistName(artist) ?? DEFAULT_ARTIST;
}

/** 海报 / 编辑区展示用歌名（空则占位，不用「歌词笔记」） */
export function resolveDisplayTitle(title?: string | null): string {
  return title?.trim() || PLACEHOLDER_TITLE;
}

/** 导出文件名、保存记录等用 */
export function resolveExportTitle(title?: string | null): string {
  const t = title?.trim();
  if (!t || t === PLACEHOLDER_TITLE) {
    return '歌词笔记';
  }
  return t;
}

export function isTitlePlaceholder(title?: string | null): boolean {
  const t = title?.trim();
  return !t || t === PLACEHOLDER_TITLE;
}

export function isArtistPlaceholder(artist?: string | null): boolean {
  return !normalizeArtistName(artist);
}

function joinTitleClasses(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function getPosterTitleNameClass(
  title?: string | null,
  lang: LangCode = 'jp',
): string {
  const display = resolveDisplayTitle(title);
  const serif = isTitlePlaceholder(title)
    ? ''
    : titleSerifClassName(resolveTitleFieldSerifOverride(lang, display));
  return joinTitleClasses(
    'fv-title-name',
    isTitlePlaceholder(title) && 'fv-title-name--placeholder',
    serif,
  );
}

export function getPosterTitleArtistClass(
  artist?: string | null,
  lang: LangCode = 'jp',
): string {
  const display = resolveDisplayArtist(artist);
  const serif = isArtistPlaceholder(artist)
    ? ''
    : titleSerifClassName(resolveTitleFieldSerifOverride(lang, display));
  return joinTitleClasses(
    'fv-title-artist',
    isArtistPlaceholder(artist) && 'fv-title-artist--placeholder',
    serif,
  );
}

export function buildPosterTitleInnerHtml(
  title: string,
  artist?: string | null,
  lang: LangCode = 'jp',
): string {
  const t = escapeHtml(resolveDisplayTitle(title));
  const a = escapeHtml(resolveDisplayArtist(artist));
  return `<span class="${getPosterTitleNameClass(title, lang)}">${t}</span><span class="${getPosterTitleArtistClass(artist, lang)}">${a}</span>`;
}

export function applyPosterTitleElement(
  h1: HTMLElement,
  title: string,
  artist?: string | null,
  lang: LangCode = 'jp',
): void {
  h1.innerHTML = buildPosterTitleInnerHtml(title, artist, lang);
}

/** 对已有歌名 markup（微调 HTML）按文案补打衬线 class */
export function stampPosterTitleSerifClasses(h1: HTMLElement, lang: LangCode): void {
  const nameEl = h1.querySelector('.fv-title-name');
  const artistEl = h1.querySelector('.fv-title-artist');
  if (nameEl) {
    const text = nameEl.textContent ?? '';
    nameEl.className = getPosterTitleNameClass(
      isTitlePlaceholder(text) ? '' : text,
      lang,
    );
  }
  if (artistEl) {
    const text = artistEl.textContent ?? '';
    artistEl.className = getPosterTitleArtistClass(
      isArtistPlaceholder(text) ? null : text,
      lang,
    );
  }
}

/** 对 titleMarkupHtml 字符串补打衬线 class（浏览器 DOM） */
export function stampTitleMarkupSerifHtml(
  html: string,
  lang: LangCode,
): string {
  if (typeof document === 'undefined' || !html.trim()) return html;
  const wrap = document.createElement('h1');
  wrap.innerHTML = html;
  stampPosterTitleSerifClasses(wrap, lang);
  return wrap.innerHTML;
}

export function readPosterTitleFromElement(h1: HTMLElement): { title: string; artist: string } {
  const nameEl = h1.querySelector('.fv-title-name');
  const artistEl = h1.querySelector('.fv-title-artist');
  if (nameEl && artistEl) {
    const rawTitle = nameEl.textContent?.trim() || '';
    const rawArtist = artistEl.textContent?.trim() || '';
    return {
      title: isTitlePlaceholder(rawTitle) ? '' : rawTitle,
      artist: isArtistPlaceholder(rawArtist) ? '' : rawArtist,
    };
  }
  const fallback = h1.textContent?.trim() || '';
  return {
    title: isTitlePlaceholder(fallback) ? '' : fallback,
    artist: '',
  };
}
