import type { LyricsLanguage } from '../appSettings';

/** 使用语言：决定 Prompt 释义/解析的输出语言 */
export type InterfaceLanguage = 'zh' | 'en';

/** 学习目标语言：歌曲原文语言 */
export type LearningTargetLanguage = 'jp' | 'ko' | 'en' | 'zh';

/** 语言矩阵 — 设置与 Prompt 的单一真相源 */
export type LanguageMatrix = {
  interfaceLanguage: InterfaceLanguage;
  /** 至少 1 项 */
  learningTargetLanguages: LearningTargetLanguage[];
};

/** 运行时上下文 = 矩阵 + 当前拨轮选中项 */
export type LanguageMatrixContext = LanguageMatrix & {
  activeTarget: LyricsLanguage;
};

export type GlossLanguage = InterfaceLanguage;
