import type { LangCode } from './appSettings';
import {
  normalizeGrammarSearchTerm,
  textContainsGrammarTerm,
  type GrammarExampleItem,
} from '../codec/prompt/buildMicroscopePrompt';
import { listStudyCards } from './studyCardsStore';
import type { StudyCard } from '../studyCards/types';

/** 去掉 ruby / Anki 花括号，便于匹配与展示 */
function stripRubyMarkup(s: string): string {
  return s
    .replace(/\{([^|}\n]+)\|[^}\n]+\}/g, '$1')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function cardAboutTerm(card: StudyCard, needle: string, rawTerm: string): boolean {
  const front = normalizeGrammarSearchTerm(card.front);
  const tags = card.tags.toLowerCase();
  return (
    front === needle ||
    front.includes(needle) ||
    tags.includes(needle) ||
    tags.includes(rawTerm.toLowerCase())
  );
}

/**
 * 仅当「展示用例句正文」含语法形时才采纳。
 * 禁止用释义/标签里偶然出现的「で」把无关歌词捞进来。
 */
function cardToExample(card: StudyCard, term: string): GrammarExampleItem | null {
  const needle = normalizeGrammarSearchTerm(term);
  const lyric = stripRubyMarkup(card.lyricJaRaw || '');
  if (lyric && textContainsGrammarTerm(lyric, term)) {
    return finishExample(card, lyric);
  }

  // front 仅当看起来是完整例句（明显长于语法键）且含该形
  const front = stripRubyMarkup(card.front || '');
  if (
    front &&
    front.length > needle.length + 2 &&
    textContainsGrammarTerm(front, term)
  ) {
    return finishExample(card, front);
  }
  return null;
}

function finishExample(card: StudyCard, text: string): GrammarExampleItem {
  const source =
    card.sourceLabel?.trim() ||
    (card.artist
      ? `${card.artist}《${card.songTitle}》`
      : `《${card.songTitle}》`);
  const zh = (card.lyricZh || card.gloss || card.meaning || '').trim();
  return { source, text, zh: zh || '（学习卡未附中文）', via: 'local' };
}

/**
 * 从本地学习卡库检索含该语法键的例句（优先同语种 grammar 卡）。
 * 硬条件：例句正文必须包含语法表面形。
 */
export async function findGrammarExamplesFromStudyCards(opts: {
  lang: LangCode | undefined;
  term: string;
  excludeText?: string;
  limit?: number;
}): Promise<GrammarExampleItem[]> {
  const limit = opts.limit ?? 3;
  const needle = normalizeGrammarSearchTerm(opts.term);
  if (!needle || needle === '—' || needle === '-') return [];

  const cards = await listStudyCards();
  const exclude = (opts.excludeText || '').replace(/\s+/g, '');

  const scored: { score: number; item: GrammarExampleItem; card: StudyCard }[] = [];
  for (const card of cards) {
    if (opts.lang && card.lang !== opts.lang) continue;
    const item = cardToExample(card, opts.term);
    if (!item) continue;
    if (exclude && item.text.replace(/\s+/g, '') === exclude) continue;

    let score = 0;
    if (card.kind === 'grammar') score += 4;
    if (card.lyricJaRaw) score += 3;
    if (cardAboutTerm(card, needle, opts.term)) score += 2;
    if (normalizeGrammarSearchTerm(card.front) === needle) score += 2;
    scored.push({ score, item, card });
  }

  scored.sort((a, b) => b.score - a.score || b.card.createdAt - a.card.createdAt);

  const out: GrammarExampleItem[] = [];
  const seen = new Set<string>();
  for (const { item } of scored) {
    const key = item.text.replace(/\s+/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}
