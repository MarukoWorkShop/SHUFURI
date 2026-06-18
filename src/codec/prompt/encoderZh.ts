import type { GlossSpec } from '../../services/languageMatrix/glossSpec';
import {
  STRICT_RAW,
  buildFullSampleBlock,
  buildIntegrityCheck,
  buildLearnerGlossBlock,
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
  const glossRule =
    iface === 'zh'
      ? '- L 第 4 列可留空（中文界面无需 gloss）。'
      : `- L 第 4 列：${gloss.label} gloss。`;

  return `[Role: Sequence_Encoder]
[Task]
将「${artist} - ${title}」编码为 zh 记录流。检索完整中文原版歌词。
${buildLearnerGlossBlock(gloss, options.matrix)}
[Lang: zh]
- H 第三列固定 zh。
- L 第 3 列：{汉字:拼音} 注音；纯标点/拉丁保持原文。
${glossRule}
${include ? `- V：6–10 词；G：3–6 点；G 第 3 列标签格式「原文（${iface === 'zh' ? '中文' : 'English'} gloss）」。` : '- 仅输出 H + L。'}
${STRICT_RAW}
${buildWireSchema(include)}
${buildIntegrityCheck(include)}${buildFullSampleBlock('zh', include)}`;
}
