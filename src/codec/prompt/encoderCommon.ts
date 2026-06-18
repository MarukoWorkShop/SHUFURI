import type { GlossSpec } from '../../services/languageMatrix/glossSpec';
import type { LanguageMatrixContext } from '../../services/languageMatrix/types';
import type { ClassifiedTextLine, OcrDetectedLanguage } from '../../services/ocrTypes';

export type EncoderPromptOptions = {
  includeVocabAndGrammar: boolean;
  matrix: LanguageMatrixContext;
  ocrContext?: {
    songTitle?: string;
    artist?: string;
    album?: string;
    production?: string;
    firstLyricLine?: string;
    rawTexts?: string[];
    detectedLanguage?: OcrDetectedLanguage;
    classifiedTexts?: ClassifiedTextLine[];
  };
};

export function fillEncoderMeta(template: string, artist: string, title: string): string {
  return template.replaceAll('{{ARTIST}}', artist).replaceAll('{{TITLE}}', title);
}

export function buildLearnerGlossBlock(gloss: GlossSpec, matrix: LanguageMatrixContext): string {
  const pedagogicalRule =
    matrix.interfaceLanguage === 'zh'
      ? `母语 gloss、释义、详解、例句译须为${gloss.label}。`
      : `母语 gloss、释义、详解、例句译须为${gloss.label}；语法标签括注用英文 gloss。`;

  return `
[Learner]
Interface: ${matrix.interfaceLanguage}
Gloss: ${gloss.label}
Rule: ${pedagogicalRule}
Allowed_Langs: ${matrix.learningTargetLanguages.join(', ')}
Active: ${matrix.activeTarget}`;
}

export function buildOcrHintBlock(ctx: EncoderPromptOptions['ocrContext']): string {
  if (!ctx) return '';
  const lines: string[] = ['[Context]'];
  if (ctx.songTitle) lines.push(`Title_Hint: ${ctx.songTitle}`);
  if (ctx.artist) lines.push(`Artist_Hint: ${ctx.artist}`);
  if (ctx.album) lines.push(`Album: ${ctx.album}`);
  if (ctx.firstLyricLine) lines.push(`First_Line: ${ctx.firstLyricLine}`);
  if (ctx.detectedLanguage) lines.push(`Detected: ${ctx.detectedLanguage}`);
  if (ctx.rawTexts?.length) {
    for (const raw of ctx.rawTexts.slice(0, 8)) {
      lines.push(`OCR: "${raw}"`);
    }
  }
  lines.push('[End_Context]');
  return '\n' + lines.join('\n') + '\n';
}

export const STRICT_RAW = `
[STRICT_RAW]
- 输出仅为记录流：以 @0 开头，以 @9 结尾。
- 禁止 markdown 代码围栏（\`\`\`）、HTML、解释性前后缀。
- 每条记录独占一行；列分隔符为未转义的 |；字段内字面 | 写 \\|。
- 注音微语法：{汉字:读音}（冒号，非管道）；例 {秋桜:コスモス}、{淡:あわ}。
- 必须先输出全部 L 行，再输出 V/G；V/G 第 5 列纯数字 = 歌词行号（1-based），否则为手写例句。`;

export function buildWireSchema(includeVocab: boolean): string {
  const vocab = includeVocab
    ? `
@1
V|序号|词头|释义|例句域|例句译
...
@2
G|序号|语法标签|详解|例句域|例句译
  · 标签第 3 列：目标语原文（括注内为母语 gloss）；前端拆为词条主标 + 括注辅标
...`
    : '';
  return `
[Wire_Schema]
@0
H|歌手|歌名|lang
L|行号(1起)|目标语主行(注音)|副歌词译义
  · jp/ko：第 4 列 = 中文副歌词 → 前端 .zh-line（非 gloss-line）
  · en/zh：第 4 列 = 母语 gloss（en 界面）或留空（zh 界面）
...${vocab}
@9`;
}

export function buildIntegrityCheck(includeVocab: boolean): string {
  const extra = includeVocab
    ? ' V/G 例句域优先填歌词行号；词未出现于歌词时才手写例句。语法例句默认行号。'
    : '';
  return `
[Integrity]
- 检索完整官方歌词；行号连续 1..N。
- 末尾必须输出 @9；缺失视为失败。${extra}`;
}

export type SampleLang = 'jp' | 'ko' | 'en' | 'zh';

/** 麻雀虽小、五脏俱全：示范 @0/@1/@2/@9 与 V/G 行号引用 */
export function buildFullSampleBlock(lang: SampleLang, includeVocab: boolean): string {
  if (!includeVocab) {
    return `
[Sample]
@0
H|示例歌手|示例歌名|${lang}
L|1|（目标语一行）|（gloss，可留空）
@9`;
  }

  switch (lang) {
    case 'jp':
      return `
[Sample]
@0
H|山口百惠|秋樱|jp
L|1|{淡:あわ}い{色:いろ}の{秋桜:コスモス}|淡淡的秋樱
@1
V|1|{秋桜:コスモス}|大波斯菊|1|
@2
G|1|の（的）|表示领属或修饰|1|
@9`;
    case 'ko':
      return `
[Sample]
@0
H|아이유|Blueming|ko
L|1|우리만의 블루밍|我们专属的 blooming
@1
V|1|블루밍|开花、绽放|1|
@2
G|1|만의（专属的）|表示所属|1|
@9`;
    case 'en':
      return `
[Sample]
@0
H|Adele|Hello|en
L|1|Hello from the other side|从另一边问好
@1
V|1|hello|问候|1|
@2
G|1|from（从）|表示来源|1|
@9`;
    case 'zh':
      return `
[Sample]
@0
H|周杰伦|晴天|zh
L|1|{故:gù}事的小{黄:huáng}花|故事的小黄花
@1
V|1|{黄:huáng}花|小黄花|1|
@2
G|1|的（的）|表示领属或修饰|1|
@9`;
  }
}
