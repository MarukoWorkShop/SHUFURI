import { escapeHtml } from '../escapeHtml.ts';

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

export function buildPosterTitleInnerHtml(title: string, artist?: string | null): string {
  const titleClass = isTitlePlaceholder(title)
    ? 'fv-title-name fv-title-name--placeholder'
    : 'fv-title-name';
  const artistClass = isArtistPlaceholder(artist)
    ? 'fv-title-artist fv-title-artist--placeholder'
    : 'fv-title-artist';
  const t = escapeHtml(resolveDisplayTitle(title));
  const a = escapeHtml(resolveDisplayArtist(artist));
  return `<span class="${titleClass}">${t}</span><span class="${artistClass}">${a}</span>`;
}

export function applyPosterTitleElement(
  h1: HTMLElement,
  title: string,
  artist?: string | null,
): void {
  h1.innerHTML = buildPosterTitleInnerHtml(title, artist);
}

export function getPosterTitleNameClass(title?: string | null): string {
  return isTitlePlaceholder(title)
    ? 'fv-title-name fv-title-name--placeholder'
    : 'fv-title-name';
}

export function getPosterTitleArtistClass(artist?: string | null): string {
  return isArtistPlaceholder(artist)
    ? 'fv-title-artist fv-title-artist--placeholder'
    : 'fv-title-artist';
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
