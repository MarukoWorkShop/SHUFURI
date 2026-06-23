import type { GlossSpec } from '../../services/languageMatrix/glossSpec';
import { buildLearnerGlossBlock, buildVocabGrammarIncludeRule, type EncoderPromptOptions } from './encoderCommon';

export function buildZhEncoderPrompt(
  artist: string,
  title: string,
  gloss: GlossSpec,
  options: EncoderPromptOptions,
): string {
  const include = options.includeVocabAndGrammar;
  const iface = options.matrix.interfaceLanguage;
  return `[Role: Sequence_Encoder]
[Task]
Encode "${artist} - ${title}" as a zh record stream.
${buildLearnerGlossBlock(gloss, options.matrix)}
[Lang: zh]
- H col3 = song title from prompt; H col4 (lang code) MUST be zh
- L col3: full-line {Hanzi:pinyin} on every CJK character (see [Zh_ruby]); contiguous tokens only
${buildVocabGrammarIncludeRule(include, iface)}`;
}
