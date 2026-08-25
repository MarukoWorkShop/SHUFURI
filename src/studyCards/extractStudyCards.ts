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

/**
 * 内容级语言检测兜底（独立于拨轮/header 声明）。
 *
 * 规则（按优先级，从高特异性到低特异性）：
 *   1. 含谚文 ([\uAC00-\uD7A3] 等)        → 'ko'   （谚文极特殊，最高优先级）
 *   2. 含平/片假名 ([\u3040-\u30FF])      → 'jp'   （假名是日语独有特征）
 *   3. 仅拉丁字母，无 CJK/Kana            → 'en'
 *   4. 仅汉字，无假名/谚文/拉丁           → 'zh'
 *
 * 返回 null 表示「文本特征不足以判定」，此时调用方应使用声明值。
 */
function detectLangFromContent(text: string): LangCode | null {
  const hasHangul = /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/.test(text);
  const hasKana = /[\u3040-\u309F\u30A0-\u30FF]/.test(text);
  const hasHan = /[\u4E00-\u9FFF\u3400-\u4DBF]/.test(text);
  const hasLatin = /[A-Za-z]/.test(text);

  if (hasHangul) return 'ko';
  if (hasKana) return 'jp';
  // 仅拉丁字母（无汉字/假名/谚文）→ 英语
  if (hasLatin && !hasHan && !hasKana && !hasHangul) return 'en';
  // 纯汉字（无假名/谚文/拉丁）→ 中文
  if (hasHan && !hasKana && !hasHangul && !hasLatin) return 'zh';
  // 混合情况（汉字+拉丁：如 "你好 hello"）无法仅凭字符断定 → null
  return null;
}

/**
 * 语言推断修正（兜底机制）：
 *
 * 当「声明语言」与「内容特征语言」冲突时，以内容特征为准——
 * 避免拨轮选择日文导致中文歌《月亮代表我的心》被误标为 jp 等跨语言污染。
 *
 * 冲突判定：detectLangFromContent(raw) 非空 且 ≠ declared。
 * 例外：declared 本身与内容一致时不触发。
 */
function correctInferredLang(raw: string, declared: LangCode | undefined): LangCode | undefined {
  if (!declared) return undefined;
  const detected = detectLangFromContent(raw);
  if (detected && detected !== declared) {
    console.warn(
      `[study-cards] lang corrected: ${declared} -> ${detected} ` +
      `(content-based detection on raw lyrics)`,
    );
    return detected;
  }
  return declared;
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
  const rawLang = meta.lang ?? document.header.lang;
  const corrected = correctInferredLang(trimmed, rawLang);
  // 兜底：声明缺失且内容无法判定时，回退到内容检测或默认日语，避免 lang 为 undefined 污染卡片。
  const lang: LangCode = corrected ?? detectLangFromContent(trimmed) ?? 'jp';
  const sourceLabel = buildSourceLabel(artist, songTitle);
  const cards: StudyCardDraft[] = [];
  // 本次解析为一次"相遇"，所有析出的卡共享同一时间戳（作为新 occurrence 的 encounteredAt）。
  const now = Date.now();

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
      encounteredAt: now,
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
      encounteredAt: now,
    });
  }

  return cards;
}
