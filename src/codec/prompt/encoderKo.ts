import type { GlossSpec } from '../../services/languageMatrix/glossSpec';
import {
  STRICT_RAW,
  buildFullSampleBlock,
  buildIntegrityCheck,
  buildLearnerGlossBlock,
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
  return `[Role: Sequence_Encoder]
[Task]
将「${artist} - ${title}」编码为 ko 记录流。检索完整韩语原版歌词。
${buildLearnerGlossBlock(gloss, options.matrix)}
[Lang: ko]
- H 第三列固定 ko。
- L 第 3 列：纯韩文，禁止注音括号。
- L 第 4 列：${gloss.label} gloss。
${include ? `- V：6–10 词；G：3–6 点；G 第 3 列标签格式「原文（${options.matrix.interfaceLanguage === 'zh' ? '中文' : 'English'} gloss）」。` : '- 仅输出 H + L。'}
${STRICT_RAW}
${buildWireSchema(include)}
${buildIntegrityCheck(include)}${buildFullSampleBlock('ko', include)}`;
}
