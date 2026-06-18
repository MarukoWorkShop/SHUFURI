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
  exampleRef: string;
  exampleTrans: string;
};

export type GrammarRow = {
  seq: number;
  label: string;
  detail: string;
  exampleRef: string;
  exampleTrans: string;
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
};

export type CompileOptions = {
  interfaceLanguage?: 'zh' | 'en';
};
