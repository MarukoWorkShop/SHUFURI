import { normalizeLyricsBodyHtml } from '../services/lyricsHtml';
import { annotateInkEditTargets } from './inkFineTune/annotateInkEditTargets';
import { stripLegacyInkHighlightsFromHtml } from './inkFineTune/stripInkHighlights';
import { wrapUncoveredKanjiAsRuby } from './inkFineTune/wrapUncoveredKanjiAsRuby';

export function prepareBodyHtmlForPreview(rawBodyHtml: string): string {
  return annotateInkEditTargets(
    wrapUncoveredKanjiAsRuby(
      normalizeLyricsBodyHtml(stripLegacyInkHighlightsFromHtml(rawBodyHtml)),
    ),
  );
}

export function prepareTitleMarkupHtml(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  return stripLegacyInkHighlightsFromHtml(raw);
}

/** 桥接用：解析 rawText → bodyHtml */
export async function prepareBridgedRawText(rawText: string): Promise<string> {
  const { preparePasteForLayout } = await import('../services/lyricsHtml');
  const parsed = preparePasteForLayout(rawText);
  return annotateInkEditTargets(
    wrapUncoveredKanjiAsRuby(normalizeLyricsBodyHtml(parsed.bodyHtml)),
  );
}
