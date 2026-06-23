import type { GlossSpec } from '../../services/languageMatrix/glossSpec';
import { buildLearnerGlossBlock, buildVocabGrammarIncludeRule, type EncoderPromptOptions } from './encoderCommon';

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
Encode "${artist} - ${title}" as an en record stream.
${buildLearnerGlossBlock(gloss, options.matrix)}
[Lang: en]
- H col3 = song title from prompt; H col4 (lang code) MUST be en
- L col3: English only; NO ruby or reading parentheses
${buildVocabGrammarIncludeRule(include, iface)}`;
}
