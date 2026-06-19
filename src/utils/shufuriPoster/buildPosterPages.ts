import { normalizeLyricsBodyHtml } from '../../services/lyricsHtml';
import { resolvePosterPipelineLang } from './inferPosterLang';
import { paginateShufuriPosterBodyHtml } from './paginateShufuriPosterHtml';
import type { PosterLayoutProfile, PosterPageSlice, PosterRenderOptions } from './types';
import type { LyricsLanguage, LangCode } from '../../services/appSettings';

/** 根据正文 HTML 与排版配置生成分页（与 AI 生成解耦） */
export function buildPosterPagesFromBody(
  bodyHtml: string,
  title: string,
  layoutProfile: PosterLayoutProfile,
  artist?: string,
  language: LyricsLanguage = 'jp',
  lang?: LangCode,
  titleMarkupHtml?: string,
  renderOptions?: PosterRenderOptions,
): PosterPageSlice[] {
  const normalized = normalizeLyricsBodyHtml(bodyHtml);
  if (!normalized.trim()) {
    return [{ html: '', spacingScale: 1 }];
  }
  const pipelineLang = resolvePosterPipelineLang(lang, normalized, language);
  return paginateShufuriPosterBodyHtml(
    normalized,
    title,
    layoutProfile,
    document,
    artist,
    language,
    pipelineLang,
    titleMarkupHtml,
    renderOptions,
  );
}

/** 仅取 HTML 字符串（导出/存储兼容） */
export function posterPageHtmls(slices: PosterPageSlice[]): string[] {
  return slices.map((s) => s.html);
}
