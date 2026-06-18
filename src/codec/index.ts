export type {
  CompileOptions,
  GrammarRow,
  LyricLine,
  ParsedStreamLyrics,
  ResolvedExample,
  StreamDocument,
  StreamHeader,
  StreamLang,
  VocabRow,
} from './types';

export { splitStreamColumns } from './splitStreamColumns';
export { normalizeCodecRuby, normalizeCodecRubyFields } from './normalizeCodecRuby';
export { stripMarkdownFences, trimToStreamStart } from './stripStreamEnvelope';
export { isStreamCodecText, isLegacyStructuredLyricsText } from './detect';
export { resolveExampleRef } from './resolveExampleRef';
export { parseStream, extractStreamHeader, extractStreamLang } from './parseStream';
export { resolvePosterClass, usesRubyMarkup, usesPlainHtml, type PosterTextRole } from './masterHandbook';
export { compileStreamDocument } from './roleCompiler';
export { compileDocument, normalizeStreamText } from './compileDocument';

export { buildEncoderPrompt } from './prompt/buildEncoderPrompt';
