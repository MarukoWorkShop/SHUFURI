import type { LangCode } from '../services/appSettings';

export type StudyCardKind = 'vocab' | 'grammar';

/** 一条记忆轨迹：记录在某首歌中初次/再次遇到该词时的代表性例句。 */
export type CardOccurrence = {
  songTitle: string;
  artist: string;
  /** 遇到该词时的例句原文（日文/原文） */
  lyricJaRaw: string;
  /** 例句翻译 */
  lyricZh: string;
  /** 遇到时间戳 */
  encounteredAt: number;
};

export type StudyCard = {
  id: string;
  bundleId: string;
  songTitle: string;
  artist?: string;
  lang: LangCode;
  kind: StudyCardKind;
  front: string;
  back: string;
  tags: string;
  sourceRaw: string;
  /** 全局去重键：`${lang}|${kind}|${canonicalTerm}` */
  dedupeKey: string;
  createdAt: number;
  /** 释义 / 详解（纯文本） */
  meaning?: string;
  /** 正面中文提示（词汇 MEANING 或语法标题释义） */
  gloss?: string;
  /** 出典：歌手《歌名》 */
  sourceLabel?: string;
  /** 例句原文（含 {漢|かな} 或 Anki 格式） */
  lyricJaRaw?: string;
  lyricZh?: string;
  /**
   * 该词汇在全局去重（dedupeKey）前提下被"再次遇到"的总次数。
   * 未定义时视作 1（兼容老数据：老卡未记录，视为仅在初见处遇到）。
   */
  encounterCount?: number;
  /**
   * 代表性例句轨迹（记忆遗产）。最多保留 3 条，index 0 永远是最初遇到的出处。
   * 老卡无此字段，合并时由自身 songTitle/artist/lyricJaRaw/lyricZh 初始化。
   */
  occurrences?: CardOccurrence[];
  /**
   * 最近一次析出入库时注入的时间戳（来自 extractStudyCards）。
   * 合并时用于构造新 occurrence 的 encounteredAt。可选以兼容老数据。
   */
  encounteredAt?: number;
};

export type StudyCardDraft = Omit<StudyCard, 'id' | 'createdAt' | 'dedupeKey'>;

export type StudyCardDetail = {
  meaning: string;
  gloss?: string;
  sourceLabel: string;
  lyricJaRaw?: string;
  lyricZh?: string;
};
