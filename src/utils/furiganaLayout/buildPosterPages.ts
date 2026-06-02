import { normalizeLyricsBodyHtml } from '../../services/volcengineLyricsNotes';
import { paginateFuriganaBodyHtml } from './paginateFuriganaHtml';
import type { PosterLayoutProfile } from './types';

/** 根据正文 HTML 与排版配置生成分页（与 AI 生成解耦） */
export function buildPosterPagesFromBody(
  bodyHtml: string,
  title: string,
  layoutProfile: PosterLayoutProfile,
): string[] {
  const normalized = normalizeLyricsBodyHtml(bodyHtml);
  if (!normalized.trim()) {
    return [''];
  }
  return paginateFuriganaBodyHtml(
    normalized,
    title.trim() || '歌词笔记',
    layoutProfile,
  );
}
