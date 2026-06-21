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
Encode "${artist} - ${title}" as a zh record stream. Retrieve the complete official Chinese lyrics.
${buildLearnerGlossBlock(gloss, options.matrix)}
[Lang: zh]
- H column 3 MUST be zh.
- L column 3: {Hanzi:pinyin} ruby; Latin / punctuation unchanged.
${buildLyricsLine4Rule(gloss, iface, 'zh')}
${buildVocabGrammarIncludeRule(include, iface)}
${buildStrictRaw(include)}
${buildWireSchema(include, iface)}
${buildIntegrityCheck(include)}${buildFullSampleBlock('zh', include, iface)}`;
}
