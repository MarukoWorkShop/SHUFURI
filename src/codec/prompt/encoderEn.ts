import type { GlossSpec } from '../../services/languageMatrix/glossSpec';
import {
  STRICT_RAW,
  buildFullSampleBlock,
  buildIntegrityCheck,
  buildLearnerGlossBlock,
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
  return `[Role: Sequence_Encoder]
[Task]
将「${artist} - ${title}」编码为 en 记录流。检索完整英语原版歌词。
${buildLearnerGlossBlock(gloss, options.matrix)}
[Lang: en]
- H 第三列固定 en。
- L 第 3 列：纯英文，禁止 ruby/括号注音。
- L 第 4 列：${gloss.label} gloss（界面为英文学习者时用英文释义）。
${include ? '- V：6–10 词；G：3–6 点；G 第 3 列标签格式「英文原文（English gloss）」，括注为母语释义。' : '- 仅输出 H + L。'}
${STRICT_RAW}
${buildWireSchema(include)}
${buildIntegrityCheck(include)}${buildFullSampleBlock('en', include)}`;
}
