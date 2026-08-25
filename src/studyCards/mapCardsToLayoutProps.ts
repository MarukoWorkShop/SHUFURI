import type { CardOccurrence, StudyCard } from './types';

/** 单条打印词目（不对称双栏镜像排版）。 */
export type StudyCardBookEntry = {
  id: string;
  /** 主文本：卡片正面（含假名注音）。 */
  front: string;
  /** 翻译/释义（meaning 字段）。 */
  meaning?: string;
  /** 正面中文提示（词汇 MEANING 或语法标题释义）。 */
  gloss?: string;
  kind: StudyCard['kind'];
  lang: StudyCard['lang'];
  /**
   * 出典歌词原文（取 occurrences[0].lyricJaRaw 或 card.lyricJaRaw）。
   * 显示为主文本，出处歌名用极小灰色字缀在后面。
   */
  lyricQuote?: string;
  /** 出典歌词中文翻译（lyricZh）。 */
  lyricQuoteZh?: string;
  /** 出处歌名（用于出典行的灰色小字标注）。 */
  sourceSongLabel?: string;
  /** 相遇次数。 */
  encounterCount: number;
  /** 初次遇到的出处（occurrences[0]）。 */
  firstSeen: CardOccurrence | null;
  /** 最近一次遇到的出处（occurrences 末条）。 */
  lastSeen: CardOccurrence | null;
  /**
   * 展示用 Notes：仅 occurrences[0] 与末条。
   * 当 encounterCount > 2 时，中间插入计数字符串 `(+ N songs)`。
   * 空数组表示无需展示 Notes。
   *
   * ⚠️ notes 包含歌名/歌手/原文/译文完整轨迹，用于"出典"语义区。
   * 若仅需纯译文（不含歌名），请用 translationLines。
   */
  notes: string[];
  /**
   * 纯译文行（仅 lyricZh，不含歌名/歌手/日文原文）。
   * 用于打印视图「译文」标签区，避免把引用歌名误作翻译内容。
   */
  translationLines: string[];
};

/** 打印词典整体 Props（传给 StudyCardsPrintBook）。 */
export type StudyCardBookLayout = {
  title: string;
  entries: StudyCardBookEntry[];
};

/**
 * 按歌名分组的词条组（同一首歌的词条不可跨页截断）。
 * 使用 fieldset/legend 语义化包裹，浏览器原生支持 page-break-inside: avoid。
 */
export type StudyCardBookGroup = {
  /** 分组键：歌手《歌名》或《歌名》 */
  key: string;
  /** 该歌名下的所有词条 */
  entries: StudyCardBookEntry[];
};

/** 带分组的打印词典布局。 */
export type StudyCardBookGroupedLayout = {
  title: string;
  /** 按歌名分组的词条数组（每组内部保持原顺序） */
  groups: StudyCardBookGroup[];
};

/**
 * 将单次 occurrence 格式化为"出典来源行"。
 * 格式：歌手《歌名》— 例句原文 / 例句译文
 */
function occurrenceToNoteLine(oc: CardOccurrence): string {
  const artist = oc.artist?.trim();
  const source = artist ? `${artist}《${oc.songTitle}》` : `《${oc.songTitle}》`;
  const exampleParts: string[] = [];
  if (oc.lyricJaRaw?.trim()) exampleParts.push(oc.lyricJaRaw.trim());
  if (oc.lyricZh?.trim()) exampleParts.push(oc.lyricZh.trim());
  const example = exampleParts.length ? ` — ${exampleParts.join(' / ')}` : '';
  return `${source}${example}`;
}

/**
 * 从 occurrence 中提取纯译文行（仅 lyricZh，不含歌名/歌手/原文）。
 * 用于打印视图「译文」区，避免把歌名当作翻译内容显示。
 */
function occurrenceToTranslationLines(oc: CardOccurrence): string[] {
  const lines: string[] = [];
  // 优先取 lyricZh（例句中文翻译）
  if (oc.lyricZh?.trim()) lines.push(oc.lyricZh.trim());
  return lines;
}

/**
 * 数据适配器：将 StudyCard[] 映射为打印词典所需的 Props 结构。
 *
 * 完整包含词卡信息：
 *  - front → 主文本
 *  - meaning → 翻译/释义
 *  - gloss → 中文提示（词汇含义或语法标题）
 *  - sourceLabel → 出典
 *  - occurrences → Notes：只展示 [0] 与末条；encounterCount > 2 时中间插 (+ N songs)
 *
 * 纯函数，不修改入参。
 */
export function mapCardsToLayoutProps(cards: StudyCard[]): StudyCardBookLayout {
  console.error('[mapCardsToLayoutProps] input cards.length =', cards.length);
  const entries: StudyCardBookEntry[] = cards.map((card) => {
    const count = card.encounterCount ?? 1;
    const occ = card.occurrences ?? [];
    const firstSeen = occ.length ? occ[0]! : null;
    const lastSeen = occ.length ? occ[occ.length - 1]! : null;

    const notes: string[] = [];
    const translationLines: string[] = [];
    if (firstSeen) {
      notes.push(occurrenceToNoteLine(firstSeen));
      translationLines.push(...occurrenceToTranslationLines(firstSeen));
    }
    if (count > 2 && occ.length >= 2) {
      notes.push(`(+ ${count - 2} songs)`);
    }
    if (lastSeen && occ.length >= 2) {
      notes.push(occurrenceToNoteLine(lastSeen));
      translationLines.push(...occurrenceToTranslationLines(lastSeen));
    }

    return {
      id: card.id,
      front: card.front,
      meaning: card.meaning,
      gloss: card.gloss,
      kind: card.kind,
      lang: card.lang,
      /** 出典歌词：优先取首次遇到的原句，回退到卡片自身 lyricJaRaw */
      lyricQuote: firstSeen?.lyricJaRaw?.trim() || card.lyricJaRaw?.trim() || undefined,
      /** 出典歌词中文翻译 */
      lyricQuoteZh: firstSeen?.lyricZh?.trim() || card.lyricZh?.trim() || undefined,
      /** 出处歌名：歌手《歌名》格式，用于极小灰色字缀后标注 */
      sourceSongLabel: card.sourceLabel || (firstSeen
        ? (firstSeen.artist ? `${firstSeen.artist}《${firstSeen.songTitle}》` : `《${firstSeen.songTitle}》`)
        : undefined),
      firstSeen,
      lastSeen,
      encounterCount: count,
      notes,
      translationLines,
    };
  });

  return {
    title: '我的专属单词书',
    entries,
  };
}

/**
 * 将词条按歌名分组，确保同一首歌的词条在打印时不可跨页截断。
 *
 * 分组键规则：
 *   - 优先使用 sourceLabel（歌手《歌名》）
 *   - 回退到 card.songTitle / occurrences[0].songTitle
 *   - 最终回退到 '(未知出处)'
 *
 * 同组内保持原始顺序（按 cards 入参顺序）。
 */
export function groupCardsBySong(cards: StudyCard[]): StudyCardBookGroupedLayout {
  const flatEntries = mapCardsToLayoutProps(cards).entries;

  const groupMap = new Map<string, StudyCardBookEntry[]>();

  for (const entry of flatEntries) {
    // 确定分组键
    let groupKey = entry.sourceSongLabel;
    if (!groupKey) {
      // 回退：从 firstSeen 取歌名
      const seen = entry.firstSeen;
      if (seen) {
        groupKey = seen.artist ? `${seen.artist}《${seen.songTitle}》` : `《${seen.songTitle}》`;
      }
    }
    if (!groupKey) {
      groupKey = '(未知出处)';
    }

    const list = groupMap.get(groupKey);
    if (list) {
      list.push(entry);
    } else {
      groupMap.set(groupKey, [entry]);
    }
  }

  // 按 entries 原始顺序排列各组（取每组首条在 flatEntries 中的位置）
  const firstIndexMap = new Map<string, number>();
  for (const [key, list] of groupMap) {
    const idx = flatEntries.indexOf(list[0]!);
    firstIndexMap.set(key, idx);
  }

  const groups: StudyCardBookGroup[] = Array.from(groupMap.entries())
    .sort((a, b) => (firstIndexMap.get(a[0]) ?? 0) - (firstIndexMap.get(b[0]) ?? 0))
    .map(([key, entries]) => ({ key, entries }));

  return {
    title: '我的专属单词书',
    groups,
  };
}
