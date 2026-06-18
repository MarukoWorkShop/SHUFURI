import { DEFAULT_ARTIST } from '../utils/shufuriPoster/posterTitle';
import type { StudyCard, StudyCardDetail } from './types';

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  return doc.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function parseLegacyBackHtml(back: string): Partial<StudyCardDetail> {
  const meaningMatch = back.match(/<span[^>]*>([^<]*)<\/span>/i);
  const sourceMatch = back.match(/📍\s*([^<]+)/);
  const parts = stripHtml(back.replace(/<br\s*\/?>/gi, '\n')).split('\n').map((s) => s.trim()).filter(Boolean);
  const meaning = meaningMatch?.[1]?.trim() || parts[0] || '';
  const sourceLabel = sourceMatch?.[1]?.trim() || '';
  const rest = parts.slice(1).filter((p) => !p.startsWith('📍'));
  return {
    meaning,
    sourceLabel,
    lyricJaRaw: rest[0],
    lyricZh: rest[1],
  };
}

export function resolveStudyCardDetail(card: StudyCard): StudyCardDetail {
  const sourceLabel =
    card.sourceLabel?.trim() ||
    `${card.artist?.trim() || DEFAULT_ARTIST}《${card.songTitle}》`;

  if (card.meaning?.trim()) {
    return {
      meaning: card.meaning.trim(),
      gloss: card.gloss?.trim() || undefined,
      sourceLabel,
      lyricJaRaw: card.lyricJaRaw?.trim() || undefined,
      lyricZh: card.lyricZh?.trim() || undefined,
    };
  }

  const legacy = parseLegacyBackHtml(card.back);
  return {
    meaning: legacy.meaning || card.sourceRaw,
    gloss: card.gloss?.trim() || undefined,
    sourceLabel: legacy.sourceLabel || sourceLabel,
    lyricJaRaw: legacy.lyricJaRaw,
    lyricZh: legacy.lyricZh,
  };
}

/** 词汇出典行：歌词原句 —— 歌曲名（语法卡请直接展示例句，勿用此函数） */
export function buildSourceCitationPlain(detail: StudyCardDetail): string {
  const song = detail.sourceLabel.trim();
  const lyric = detail.lyricJaRaw?.trim() || detail.lyricZh?.trim();
  if (!lyric) return song;
  return `${lyric} —— ${song}`;
}
