import type { GlossSpec } from '../../services/languageMatrix/glossSpec';
import { buildLearnerGlossBlock, buildVocabGrammarIncludeRule, type EncoderPromptOptions } from './encoderCommon';

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
Encode "${artist} - ${title}" as a ko record stream.
${buildLearnerGlossBlock(gloss, options.matrix)}
[Lang: ko]
- H col3 = song title from prompt; H col4 (lang code) MUST be ko
- L col3: Korean only; NO reading annotations in parentheses
${buildVocabGrammarIncludeRule(include, iface)}`;
}
