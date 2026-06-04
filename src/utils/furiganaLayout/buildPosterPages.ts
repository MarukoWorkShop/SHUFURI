import { normalizeLyricsBodyHtml } from '../../services/lyricsHtml';
import { paginateFuriganaBodyHtml } from './paginateFuriganaHtml';
import type { PosterLayoutProfile, PosterPageSlice } from './types';

/** 根据正文 HTML 与排版配置生成分页（与 AI 生成解耦） */
export function buildPosterPagesFromBody(
  bodyHtml: string,
  title: string,
  layoutProfile: PosterLayoutProfile,
  artist?: string,
): PosterPageSlice[] {
  const normalized = normalizeLyricsBodyHtml(bodyHtml);
  if (!normalized.trim()) {
    return [{ html: '', spacingScale: 1 }];
  }
  return paginateFuriganaBodyHtml(normalized, title, layoutProfile, document, artist);
}

/** 仅取 HTML 字符串（导出/存储兼容） */
export function posterPageHtmls(slices: PosterPageSlice[]): string[] {
  return slices.map((s) => s.html);
}
