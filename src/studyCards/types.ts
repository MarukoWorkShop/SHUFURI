import type { LangCode } from '../services/appSettings';

export type StudyCardKind = 'vocab' | 'grammar';

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
};

export type StudyCardDraft = Omit<StudyCard, 'id' | 'createdAt'>;

export type StudyCardDetail = {
  meaning: string;
  gloss?: string;
  sourceLabel: string;
  lyricJaRaw?: string;
  lyricZh?: string;
};
