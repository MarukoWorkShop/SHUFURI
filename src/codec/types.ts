import type { LangCode } from '../services/appSettings';

export type StreamLang = LangCode;

export type StreamHeader = {
  artist: string;
  title: string;
  lang: StreamLang;
};

export type LyricLine = {
  index: number;
  primary: string;
  gloss: string;
};

export type VocabRow = {
  seq: number;
  term: string;
  meaning: string;
  /** 1-based L line where term appears (study cards / 出典) */
  lyricLineNo: string;
  /** Hand-written teaching example (poster only; NOT copy from L) */
  pedagogicalExample: string;
  pedagogicalTranslation: string;
};

export type GrammarRow = {
  seq: number;
  label: string;
  detail: string;
  /** 1-based L line illustrating grammar (study cards / 出典) */
  lyricLineNo: string;
  /** Hand-written teaching example (poster only) */
  pedagogicalExample: string;
  pedagogicalTranslation: string;
};

export type StreamDocument = {
  header: StreamHeader;
  lyrics: LyricLine[];
  vocab: VocabRow[];
  grammar: GrammarRow[];
  closed: boolean;
};

export type ResolvedExample = {
  primary: string;
  translation: string;
  cite: 'lyric' | 'inline';
  lyricIndex?: number;
};

export type ParsedStreamLyrics = {
  bodyHtml: string;
  title?: string;
  artist?: string;
  lang?: LangCode;
  document: StreamDocument;
  /** 流未闭合等可恢复解析时的用户提示 */
  streamWarning?: string;
};

export type CompileOptions = {
  interfaceLanguage?: 'zh' | 'en';
};
