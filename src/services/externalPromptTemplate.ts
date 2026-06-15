const PROMPT_HEAD = `[System_Init: Shufu-Life-Parser_v2.5]
[Env: Cross_Platform_General; Output=Data_Stream; Check_Level=Strict]

[Meta]
Artist: {{ARTIST}}
Title: {{TITLE}}

[Header_Required]
The FIRST non-empty line inside ===BEGIN=== MUST be exactly:
# {{ARTIST}}《{{TITLE}}》
- Artist field is mandatory. If unknown, use 佚名 (never omit or use N/A).
- Title field is mandatory and must match [Meta] Title.

[Global_Syntax_Rules]
Rule_1 (Ruby_Tag): Wrap Kanji words ONLY. Syntax MUST be {Kanji|Kana} with a pipe |.
       - Eg: {今日|きょう}, {秋桜|コスモス}, {過去|かこ}, {過|か}{去|こ}.
       - Okurigana outside: {舞|ま}う, {食|た}べる.
       - BAD (missing pipe): {過|か}去{こ}, 真{じつ}, 実{じつ} — use {過去|かこ} or {過|か}{去|こ} instead.
Rule_2 (Pure_Kana/Num): Pure Hiragana/Katakana/Spaces/Punctuation -> Keep raw, NO brackets.
Rule_3 (Strict_Isolation): NO HTML. NO MD codeblocks (\`\`\`). NO bracket-style (like 秋(あき)).
Rule_4 (Zero_Tag_In_ZH): ZH lines MUST NOT contain any "{...}".
Rule_5 (Self_Check): Validate every Kanji in JP lines is bounded by "{...}".
Rule_6 (Atomic_Ruby): Each {...} wraps ONE contiguous Kanji run ONLY.
       - NO nesting (e.g. BAD: {今{日|に}|きょう}).
       - NO cross/overlap tagging on the same Kanji (e.g. BAD: {今日|きょう} split as {今|き}{日|ょう} with shared kana).
Rule_7 (Non_Overlap_Reading): Adjacent ruby readings must NOT duplicate/cover the same kana span.
       - Each hiragana/katakana segment in the line belongs to at most one tag's reading.
       - BAD: {食|た}べ{食|し}る (reading た overlaps); split as {食|た}べ{事|し} or keep okurigana outside.`;

const TASK_FLOW_FULL = `
[Task_Flow]
1. [Module: Web_Retrieval] -> Search and fetch the COMPLETE and OFFICIAL Japanese lyrics of [Meta].
2. [Module: Line_Map] -> Parse retrieved lyrics to ===LYRICS=== block line-by-line with accurate ZH translation.
3. [Module: Feature_Extract] -> Extract 6-10 Vocabulary to ===VOCAB===. EX_JP must be a NEW independent sentence.
4. [Module: Feature_Extract] -> Extract 3-6 Grammar points to ===GRAMMAR===. EX_JP must be a NEW independent sentence.`;

const TASK_FLOW_LYRICS_ONLY = `
[Task_Flow]
1. [Module: Web_Retrieval] -> Search and fetch the COMPLETE and OFFICIAL Japanese lyrics of [Meta].
2. [Module: Line_Map] -> Parse retrieved lyrics to ===LYRICS=== block line-by-line with accurate ZH translation.
3. [Constraint] -> Output lyrics ONLY. Do NOT output ===VOCAB=== or ===GRAMMAR===.`;

const OUTPUT_SCHEMA_LYRICS = `
[Output_Schema]
===BEGIN===
# {{ARTIST}}《{{TITLE}}》
===LYRICS===
---PAIR---
JP: [Apply Rule_1–Rule_7 here]
ZH: [Pure Chinese translation]
---END---
===END===`;

const OUTPUT_SCHEMA_FULL = `
[Output_Schema]
===BEGIN===
# {{ARTIST}}《{{TITLE}}》
===LYRICS===
---PAIR---
JP: [Apply Rule_1–Rule_7 here]
ZH: [Pure Chinese translation]
---END===
===VOCAB===
---WORD---
TERM: {Word_Kanji|Kana}
MEANING: [Pure Chinese]
EX_JP: [Independent sample sentence; apply Rule_1–Rule_7]
EX_ZH: [Pure Chinese]
---END---
===GRAMMAR===
---POINT---
TITLE: [Grammar Name]
DETAIL: [Pure Chinese explanation]
EX_JP: [Independent sample sentence; apply Rule_1–Rule_7]
EX_ZH: [Pure Chinese]
---END===
===END===`;

// ---- 韩文模式（无 ruby 注音，Hangul 是表音文字） ----

const KO_TASK_FLOW_LYRICS = `
[Task_Flow]
1. [Module: Web_Retrieval] -> Search and fetch the COMPLETE and OFFICIAL Korean lyrics of [Meta].
2. [Module: Line_Map] -> Parse retrieved lyrics to ===LYRICS=== block line-by-line with accurate ZH translation.
3. [Constraint] -> Output lyrics ONLY. Do NOT output ===VOCAB=== or ===GRAMMAR===.`;

const KO_TASK_FLOW_FULL = `
[Task_Flow]
1. [Module: Web_Retrieval] -> Search and fetch the COMPLETE and OFFICIAL Korean lyrics of [Meta].
2. [Module: Line_Map] -> Parse retrieved lyrics to ===LYRICS=== block line-by-line with accurate ZH translation.
3. [Module: Feature_Extract] -> Extract 6-10 Vocabulary to ===VOCAB===. EX_KO must be a NEW independent sentence.
4. [Module: Feature_Extract] -> Extract 3-6 Grammar points to ===GRAMMAR===. EX_KO must be a NEW independent sentence.`;

const KO_OUTPUT_SCHEMA_LYRICS = `
[Output_Schema]
===BEGIN===
# {{ARTIST}}《{{TITLE}}》
===LYRICS===
---PAIR---
KO: [Korean lyrics — pure Hangul, NO ruby/brackets]
ZH: [Pure Chinese translation]
---END---
===END===`;

const KO_OUTPUT_SCHEMA_FULL = `
[Output_Schema]
===BEGIN===
# {{ARTIST}}《{{TITLE}}》
===LYRICS===
---PAIR---
KO: [Korean lyrics]
ZH: [Pure Chinese translation]
---END---
===VOCAB===
---WORD---
TERM: [Korean word]
MEANING: [Pure Chinese]
EX_KO: [Independent Korean sample sentence]
EX_ZH: [Pure Chinese]
---END---
===GRAMMAR===
---POINT---
TITLE: [Grammar Name]
DETAIL: [Pure Chinese explanation]
EX_KO: [Independent Korean sample sentence]
EX_ZH: [Pure Chinese]
---END===
===END===`;

import { DEFAULT_ARTIST } from '../utils/furiganaLayout/posterTitle';
import type { ClassifiedTextLine, OcrDetectedLanguage } from './ocrTypes';

export type ExternalPromptOptions = {
  /** 是否要求 AI 附带 ===VOCAB=== / ===GRAMMAR=== 板块（由设置总开关决定） */
  includeVocabAndGrammar: boolean;
  /** 歌词语言模式：jp（日语，默认）或 ko（韩语）。韩语模式不使用 ruby 注音 */
  language?: 'jp' | 'ko';
  /** OCR 识别到的完整上下文信息，用于减少 AI 幻觉、提升搜索召回率 */
  ocrContext?: {
    /** OCR 识别到的歌名 */
    songTitle?: string;
    /** OCR 识别到的歌手 */
    artist?: string;
    /** OCR 识别到的专辑名 */
    album?: string;
    /** OCR 识别到的制作信息（作词/作曲/编曲等） */
    production?: string;
    /** OCR 识别到的首句歌词 */
    firstLyricLine?: string;
    /** OCR 识别到的原始文本行（供 AI 自行推断） */
    rawTexts?: string[];
    /** OCR 管线检测到的语言，供 Prompt 加入语言提示 */
    detectedLanguage?: OcrDetectedLanguage;
    /** OCR 管线逐行分类结果（供 AI 交叉验证） */
    classifiedTexts?: ClassifiedTextLine[];
  };
};

function buildOcrContextBlock(ctx: ExternalPromptOptions['ocrContext']): string {
  if (!ctx) return '';
  const lines: string[] = ['[Context_Hint]'];
  lines.push('  （以下信息来自截屏 OCR 识别，供交叉验证以减少幻觉）');

  // 语言提示
  if (ctx.detectedLanguage) {
    const langLabel: Record<string, string> = {
      jp: '日语',
      ko: '韩语',
      zh: '中文',
      mixed: '日韩混合',
      unknown: '未识别',
    };
    lines.push(`  检测语言: ${langLabel[ctx.detectedLanguage] || ctx.detectedLanguage}`);
  }

  if (ctx.songTitle) lines.push(`  歌名: ${ctx.songTitle}`);
  if (ctx.artist) lines.push(`  歌手: ${ctx.artist}`);
  if (ctx.album) lines.push(`  专辑: ${ctx.album}`);
  if (ctx.production) lines.push(`  制作: ${ctx.production}`);
  if (ctx.firstLyricLine) lines.push(`  首句歌词: ${ctx.firstLyricLine}`);

  // 分类文本行（优先展示 title/artist/album/lyrics 行，抑制 noise）
  if (ctx.classifiedTexts && ctx.classifiedTexts.length > 0) {
    const priorityOrder: ClassifiedTextLine['category'][] = [
      'title', 'artist', 'album', 'lyricsWriter', 'composer',
      'arranger', 'producer', 'releaseYear', 'lyrics', 'unknown',
    ];
    const priorityMap = new Map(priorityOrder.map((c, i) => [c, i]));
    const sorted = [...ctx.classifiedTexts].sort((a, b) => {
      const ai = priorityMap.get(a.category) ?? 99;
      const bi = priorityMap.get(b.category) ?? 99;
      return ai - bi;
    });

    // 标题/歌手/专辑行单独标注
    const coreCategories: ClassifiedTextLine['category'][] = [
      'title', 'artist', 'album', 'lyricsWriter', 'composer',
      'arranger', 'producer', 'releaseYear',
    ];
    const coreLines = sorted.filter((l) => coreCategories.includes(l.category));
    const otherLines = sorted.filter((l) => !coreCategories.includes(l.category) && l.category !== 'ui_noise');

    if (coreLines.length > 0) {
      lines.push('  分类文本_核心字段:');
      for (const l of coreLines.slice(0, 10)) {
        lines.push(`    [${l.category}] ${l.text}`);
      }
    }

    if (otherLines.length > 0) {
      lines.push('  分类文本_歌词候选:');
      for (const l of otherLines.slice(0, 8)) {
        lines.push(`    [${l.category}] ${l.text}`);
      }
    }
  }

  // 原始 OCR 文本（兜底，最多保留 10 行）
  if (ctx.rawTexts && ctx.rawTexts.length > 0 && !ctx.classifiedTexts) {
    const sample = ctx.rawTexts.slice(0, 10);
    lines.push('  Raw_OCR_Lines:');
    for (const raw of sample) {
      lines.push(`    - "${raw}"`);
    }
  }

  lines.push('[End_Context_Hint]');
  return '\n' + lines.join('\n') + '\n';
}

export function buildExternalAiPrompt(
  artist: string,
  title: string,
  options: ExternalPromptOptions,
): string {
  const includeVocabAndGrammar = options.includeVocabAndGrammar;
  const isKorean = options.language === 'ko';
  const t = title.trim().replace(/^《|》$/g, '');
  if (!t) {
    throw new Error('歌名为必填项，外部 AI 需要歌名才能查找歌词');
  }
  const a = artist.trim() || DEFAULT_ARTIST;

  // 韩文模式：使用 KO: 标签 + 无 ruby 规则
  if (isKorean) {
    const taskFlow = includeVocabAndGrammar ? KO_TASK_FLOW_FULL : KO_TASK_FLOW_LYRICS;
    const outputSchema = includeVocabAndGrammar ? KO_OUTPUT_SCHEMA_FULL : KO_OUTPUT_SCHEMA_LYRICS;
    const ocrBlock = buildOcrContextBlock(options.ocrContext);
    const prompt = PROMPT_HEAD + ocrBlock + taskFlow + outputSchema;
    return prompt.replaceAll('{{ARTIST}}', a).replaceAll('{{TITLE}}', t);
  }

  // 日语模式（默认）
  const taskFlow = includeVocabAndGrammar ? TASK_FLOW_FULL : TASK_FLOW_LYRICS_ONLY;
  const outputSchema = includeVocabAndGrammar ? OUTPUT_SCHEMA_FULL : OUTPUT_SCHEMA_LYRICS;
  const ocrBlock = buildOcrContextBlock(options.ocrContext);

  let prompt = PROMPT_HEAD;
  if (includeVocabAndGrammar) {
    prompt += `
Rule_4 (Zero_Tag_In_ZH): ZH/MEANING/DETAIL/EX_ZH lines MUST NOT contain any "{...}".
Rule_5 (Self_Check): Validate every Kanji in JP/EX_JP lines is bounded by "{...}"; re-check Rule_6 & Rule_7 on EX_JP too.`;
  }
  prompt += ocrBlock + taskFlow + outputSchema;

  return prompt.replaceAll('{{ARTIST}}', a).replaceAll('{{TITLE}}', t);
}

