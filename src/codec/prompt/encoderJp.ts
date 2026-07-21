import type { GlossSpec } from '../../services/languageMatrix/glossSpec';
import { buildLearnerGlossBlock, buildVocabGrammarIncludeRule, type EncoderPromptOptions } from './encoderCommon';

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
Encode "${artist} - ${title}" as a jp record stream.
${buildLearnerGlossBlock(gloss, options.matrix)}
[Lang: jp]
- H col3 = song title from prompt; H col4 (lang code) MUST be jp
- L col3: {漢字:かな} on kanji ONLY; okurigana/particles/katakana plain (never {る} / {アルバム} bare braces)
${buildVocabGrammarIncludeRule(include, iface)}`;
}
