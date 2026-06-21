import type { LyricLine } from '../codec/types';
import type { LangCode } from '../services/appSettings';
import { parseStream } from '../codec/parseStream';
import { resolveExampleRef } from '../codec/resolveExampleRef';
import { cleanDoubaoPaste } from '../utils/cleanDoubaoPaste';
import { DEFAULT_ARTIST } from '../utils/shufuriPoster/posterTitle';
import { buildAnkiBackHtml } from './buildAnkiBackHtml';
import { rubyToAnkiFurigana } from './rubyToAnkiFurigana';
import type { StudyCardDraft, StudyCardKind } from './types';

export type ExtractStudyCardsMeta = {
  bundleId: string;
  title?: string;
  artist?: string;
  lang?: LangCode;
};

const GRAMMAR_TITLE_SPLIT_RE = /^(.+?)\s*[（(]([^）)]+)[）)]\s*$/;

function buildFront(text: string, lang: LangCode): string {
  if (lang === 'jp' || lang === 'zh') return rubyToAnkiFurigana(text);
  return text.trim();
}

function buildTags(kind: StudyCardKind, songTitle: string): string {
  const safeTitle = songTitle.replace(/\s+/g, ' ').trim();
  return `shufuri ${safeTitle} ${kind}`;
}

function buildSourceLabel(artist: string | undefined, songTitle: string): string {
  const a = artist?.trim() || DEFAULT_ARTIST;
  return `${a}《${songTitle}》`;
}

function grammarTitleParts(title: string): { orig: string; zh?: string } {
  const trimmed = title.trim();
  const m = trimmed.match(GRAMMAR_TITLE_SPLIT_RE);
  return {
    orig: (m?.[1] ?? trimmed).trim(),
    zh: m?.[2]?.trim(),
  };
}

export function rawLyricsHasStudyCardSections(raw: string): boolean {
  const trimmed = cleanDoubaoPaste(raw.trim());
  for (const line of trimmed.split(/\r\n|\n|\r/)) {
    const t = line.trim();
    if (t.startsWith('V|') || t.startsWith('G|')) return true;
  }
  return false;
}

function safeLyricLineCitation(
  lyricLineNo: string,
  lyrics: LyricLine[],
): { primary?: string; translation?: string } {
  const ref = lyricLineNo.trim();
  if (!ref || !/^\d+$/.test(ref)) return {};
  const index = Number.parseInt(ref, 10);
  if (index < 1) return {};
  try {
    const ex = resolveExampleRef(ref, '', lyrics);
    return {
      primary: ex.primary?.trim() || undefined,
      translation: ex.translation?.trim() || undefined,
    };
  } catch {
    return {};
  }
}

export function extractStudyCardsFromRaw(raw: string, meta: ExtractStudyCardsMeta): StudyCardDraft[] {
  const trimmed = cleanDoubaoPaste(raw.trim());
  if (!rawLyricsHasStudyCardSections(trimmed)) {
    return [];
  }

  let document;
  try {
    document = parseStream(trimmed);
  } catch (err) {
    console.warn('[study-cards] parseStream failed:', err);
    return [];
  }

  const songTitle = meta.title?.trim() || document.header.title?.trim() || '歌词笔记';
  const artist = meta.artist?.trim() || document.header.artist?.trim() || undefined;
  const lang = meta.lang ?? document.header.lang;
  const sourceLabel = buildSourceLabel(artist, songTitle);
  const cards: StudyCardDraft[] = [];

  for (const row of document.vocab) {
    const term = row.term?.trim();
    if (!term) continue;

    const meaning = row.meaning?.trim() || term;
    let exOrig: string | undefined;
    let exTrans: string | undefined;
    let useRuby = lang === 'jp' || lang === 'zh';

    if (row.lyricLineNo) {
      const cited = safeLyricLineCitation(row.lyricLineNo, document.lyrics);
      exOrig = cited.primary;
      exTrans = cited.translation;
    }

    cards.push({
      bundleId: meta.bundleId,
      songTitle,
      artist,
      lang,
      kind: 'vocab',
      front: buildFront(term, lang),
      meaning,
      gloss: meaning,
      sourceLabel,
      lyricJaRaw: exOrig,
      lyricZh: exTrans,
      back: buildAnkiBackHtml({
        meaning,
        sourceLabel,
        lyricJa: exOrig,
        lyricZh: exTrans,
        useAnkiFurigana: useRuby && !!exOrig,
      }),
      tags: buildTags('vocab', songTitle),
      sourceRaw: term,
    });
  }

  for (const row of document.grammar) {
    const { orig, zh } = grammarTitleParts(row.label);
    if (!orig) continue;

    let exOrig: string | undefined;
    let exTrans: string | undefined;
    const useRuby = lang === 'jp' || lang === 'zh';

    if (row.lyricLineNo) {
      const cited = safeLyricLineCitation(row.lyricLineNo, document.lyrics);
      exOrig = cited.primary;
      exTrans = cited.translation;
    }

    const meaning = row.detail?.trim() || zh || orig;

    cards.push({
      bundleId: meta.bundleId,
      songTitle,
      artist,
      lang,
      kind: 'grammar',
      front: buildFront(orig, lang),
      meaning,
      gloss: zh,
      sourceLabel,
      lyricJaRaw: exOrig,
      lyricZh: exTrans,
      back: buildAnkiBackHtml({
        meaning,
        sourceLabel,
        lyricJa: exOrig,
        lyricZh: exTrans,
        useAnkiFurigana: useRuby && !!exOrig,
        includeSourceAttribution: false,
      }),
      tags: buildTags('grammar', songTitle),
      sourceRaw: row.label,
    });
  }

  return cards;
}
