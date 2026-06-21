import type { GlossSpec } from '../../services/languageMatrix/glossSpec';
import {
  buildStrictRaw,
  buildFullSampleBlock,
  buildIntegrityCheck,
  buildLearnerGlossBlock,
  buildLyricsLine4Rule,
  buildVocabGrammarIncludeRule,
  buildWireSchema,
  type EncoderPromptOptions,
} from './encoderCommon';

export function buildJpEncoderPrompt(
  artist: string,
  title: string,
  gloss: GlossSpec,
  options: EncoderPromptOptions,
): string {
  const include = options.includeVocabAndGrammar;
  const iface = options.matrix.interfaceLanguage;
  return `[Role: Sequence_Encoder]
[Task]
Encode "${artist} - ${title}" as a jp record stream. Retrieve the complete official Japanese lyrics.
${buildLearnerGlossBlock(gloss, options.matrix)}
[Lang: jp]
- H column 3 MUST be jp.
- L column 3: Japanese main line; kanji MUST use {base:reading} ruby; kana-only / digits / punctuation unchanged.
${buildLyricsLine4Rule(gloss, iface, 'jp')}
${buildVocabGrammarIncludeRule(include, iface)}
${buildStrictRaw(include)}
${buildWireSchema(include, iface)}
${buildIntegrityCheck(include)}${buildFullSampleBlock('jp', include, iface)}`;
}
