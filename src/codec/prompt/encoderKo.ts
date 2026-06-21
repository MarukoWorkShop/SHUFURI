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

export function buildKoEncoderPrompt(
  artist: string,
  title: string,
  gloss: GlossSpec,
  options: EncoderPromptOptions,
): string {
  const include = options.includeVocabAndGrammar;
  const iface = options.matrix.interfaceLanguage;
  return `[Role: Sequence_Encoder]
[Task]
Encode "${artist} - ${title}" as a ko record stream. Retrieve the complete official Korean lyrics.
${buildLearnerGlossBlock(gloss, options.matrix)}
[Lang: ko]
- H column 3 MUST be ko.
- L column 3: Korean only; NO reading annotations in parentheses.
${buildLyricsLine4Rule(gloss, iface, 'ko')}
${buildVocabGrammarIncludeRule(include, iface)}
${buildStrictRaw(include)}
${buildWireSchema(include, iface)}
${buildIntegrityCheck(include)}${buildFullSampleBlock('ko', include, iface)}`;
}
