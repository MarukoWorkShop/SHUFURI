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

export function buildEnEncoderPrompt(
  artist: string,
  title: string,
  gloss: GlossSpec,
  options: EncoderPromptOptions,
): string {
  const include = options.includeVocabAndGrammar;
  const iface = options.matrix.interfaceLanguage;
  return `[Role: Sequence_Encoder]
[Task]
Encode "${artist} - ${title}" as an en record stream. Retrieve the complete official English lyrics.
${buildLearnerGlossBlock(gloss, options.matrix)}
[Lang: en]
- H column 3 MUST be en.
- L column 3: English only; NO ruby or reading parentheses.
${buildLyricsLine4Rule(gloss, iface, 'en')}
${buildVocabGrammarIncludeRule(include, iface)}
${buildStrictRaw(include)}
${buildWireSchema(include, iface)}
${buildIntegrityCheck(include)}${buildFullSampleBlock('en', include, iface)}`;
}
