import type { GlossSpec } from '../../services/languageMatrix/glossSpec';
import {
  STRICT_RAW,
  buildFullSampleBlock,
  buildIntegrityCheck,
  buildLearnerGlossBlock,
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
  return `[Role: Sequence_Encoder]
[Task]
将「${artist} - ${title}」编码为 jp 记录流。检索完整日语原版歌词。
${buildLearnerGlossBlock(gloss, options.matrix)}
[Lang: jp]
- H 第三列固定 jp。
- L 第 3 列：日文主行；汉字须 {基字:假名} 注音；纯假名/数字/标点保持原文。
- L 第 4 列：中文副歌词（整句中文翻译，对应第 3 列；不是行号、不是词汇释义）。
${include ? `- V：6–10 词；G：3–6 点；G 第 3 列标签格式「原文（${options.matrix.interfaceLanguage === 'zh' ? '中文' : 'English'} gloss）」。` : '- 仅输出 H + L，省略 V/G 段。'}
${STRICT_RAW}
${buildWireSchema(include)}
${buildIntegrityCheck(include)}${buildFullSampleBlock('jp', include)}`;
}
