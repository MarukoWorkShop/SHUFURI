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

/** ===GRAMMAR=== TITLE 字段：原语言语法点 + 括号内纯中文名（排版层据此拆分 PingFang） */
const GRAMMAR_TITLE_SCHEMA_LINE =
  'TITLE: [Grammar point in original language]（[Pure Chinese gloss — MUST be inside parentheses）]';

const GRAMMAR_TITLE_RULE_BLOCK = `
[Grammar_TITLE_Format] (===GRAMMAR=== TITLE only; LANG: jp | ko | en)
- REQUIRED: [original-language grammar label]（[pure Chinese name]）
- Chinese gloss MUST be inside （） or (); NEVER append Chinese after only a space.
- BAD: ~ ㄹ 거야 推测终结句 | ～てゆく 逐渐…下去 | Past Simple 一般过去时
- GOOD: ~ ㄹ 거야（推测终结句）| ～{て|て}ゆく（逐渐…下去）| Past Simple（一般过去时）
- LANG: jp — {Kanji|Kana} ruby allowed BEFORE （ only; ZH inside （ must have NO "{...}".
- DETAIL remains a separate pure-Chinese field.`;

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
LANG: jp
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
LANG: jp
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
${GRAMMAR_TITLE_SCHEMA_LINE}
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
LANG: ko
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
LANG: ko
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
${GRAMMAR_TITLE_SCHEMA_LINE}
DETAIL: [Pure Chinese explanation]
EX_KO: [Independent Korean sample sentence]
EX_ZH: [Pure Chinese]
---END===
===END===`;

// ---- 英文模式（无 ruby，EN: 标签） ----

const EN_PROMPT_HEAD = `[System_Init: Shufu-Life-Parser_v2.5]
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
Rule_1: Original lyrics use EN: lines — plain English text only. NO ruby, NO {Kanji|Kana}, NO brackets around words.
Rule_2 (Strict_Isolation): NO HTML. NO MD codeblocks (\\\`\\\`\\\`).
Rule_3 (Zero_Tag_In_ZH): ZH / MEANING / DETAIL / EX_ZH lines MUST NOT contain any "{...}".`;

const EN_TASK_FLOW_LYRICS = `
[Task_Flow]
1. [Module: Web_Retrieval] -> Search and fetch the COMPLETE and OFFICIAL **English** lyrics of [Meta].
2. [Module: Line_Map] -> Parse retrieved lyrics to ===LYRICS=== block line-by-line with accurate ZH translation.
3. [Constraint] -> Output lyrics ONLY. Do NOT output ===VOCAB=== or ===GRAMMAR===.`;

const EN_TASK_FLOW_FULL = `
[Task_Flow]
1. [Module: Web_Retrieval] -> Search and fetch the COMPLETE and OFFICIAL **English** lyrics of [Meta].
2. [Module: Line_Map] -> Parse retrieved lyrics to ===LYRICS=== block line-by-line with accurate ZH translation.
3. [Module: Feature_Extract] -> Extract 6-10 Vocabulary to ===VOCAB===. EX_EN must be a NEW independent English sentence.
4. [Module: Feature_Extract] -> Extract 3-6 Grammar points to ===GRAMMAR===. EX_EN must be a NEW independent English sentence.`;

const EN_OUTPUT_SCHEMA_LYRICS = `
[Output_Schema]
===BEGIN===
# {{ARTIST}}《{{TITLE}}》
LANG: en
===LYRICS===
---PAIR---
EN: [Original English lyrics — plain text]
ZH: [Pure Chinese translation]
---END---
===END===`;

const EN_OUTPUT_SCHEMA_FULL = `
[Output_Schema]
===BEGIN===
# {{ARTIST}}《{{TITLE}}》
LANG: en
===LYRICS===
---PAIR---
EN: [Original English lyrics]
ZH: [Pure Chinese translation]
---END---
===VOCAB===
---WORD---
TERM: [English word or phrase]
MEANING: [Pure Chinese]
EX_EN: [Independent English sample sentence]
EX_ZH: [Pure Chinese]
---END---
===GRAMMAR===
---POINT---
${GRAMMAR_TITLE_SCHEMA_LINE}
DETAIL: [Pure Chinese explanation]
EX_EN: [Independent English sample sentence]
EX_ZH: [Pure Chinese]
---END---
===END===`;

// ---- AUTO 模式：由 AI 判定原曲语言并声明 LANG ----

const AUTO_PROMPT_HEAD = `[System_Init: Shufu-Life-Parser_v2.5]
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
Rule_1 (Ruby_Tag): When LANG: jp — wrap Kanji ONLY as {Kanji|Kana} with pipe | on JP: / EX_JP lines.
Rule_2 (Pure_Kana/Num): Pure Hiragana/Katakana/Numbers -> Keep raw, NO brackets.
Rule_3 (Strict_Isolation): NO HTML. NO MD codeblocks.
Rule_4 (Zero_Tag_In_ZH): ZH lines MUST NOT contain any "{...}".
Rule_5 (KO/EN_Lines): When LANG: ko use KO: pure Hangul; when LANG: en use EN: plain English — NO ruby on either.`;

const AUTO_TASK_FLOW_LYRICS = `
[Task_Flow]
1. [Module: Web_Retrieval] -> Identify the OFFICIAL **original language** of [Meta] (jp / ko / en). Fetch complete lyrics in that language only.
2. [Module: Line_Map] -> Set LANG: to the detected language. Map lyrics line-by-line with accurate ZH translation.
3. [Constraint] -> Output lyrics ONLY. Do NOT output ===VOCAB=== or ===GRAMMAR===.`;

const AUTO_TASK_FLOW_FULL = `
[Task_Flow]
1. [Module: Web_Retrieval] -> Identify the OFFICIAL **original language** of [Meta] (jp / ko / en). Fetch complete lyrics in that language only.
2. [Module: Line_Map] -> Set LANG: to the detected language. Map lyrics line-by-line with accurate ZH translation.
3. [Module: Feature_Extract] -> Extract 6-10 Vocabulary to ===VOCAB=== using EX_JP / EX_KO / EX_EN matching LANG.
4. [Module: Feature_Extract] -> Extract 3-6 Grammar points to ===GRAMMAR=== using the same language for examples.`;

const AUTO_OUTPUT_SCHEMA_LYRICS = `
[Output_Schema]
===BEGIN===
# {{ARTIST}}《{{TITLE}}》
LANG: [jp | ko | en — MUST match original lyrics language]
===LYRICS===
---PAIR---
(Use ONE line tag matching LANG: JP: with ruby if jp | KO: if ko | EN: if en)
ZH: [Pure Chinese translation]
---END---
===END===`;

const AUTO_OUTPUT_SCHEMA_FULL = `
[Output_Schema]
===BEGIN===
# {{ARTIST}}《{{TITLE}}》
LANG: [jp | ko | en]
===LYRICS===
---PAIR---
(JP: / KO: / EN: — pick ONE family matching LANG)
ZH: [Pure Chinese translation]
---END---
===VOCAB===
---WORD---
TERM: [word in original language]
MEANING: [Pure Chinese]
(EX_JP / EX_KO / EX_EN matching LANG)
EX_ZH: [Pure Chinese]
---END---
===GRAMMAR===
---POINT---
${GRAMMAR_TITLE_SCHEMA_LINE}
DETAIL: [Pure Chinese explanation]
(EX_JP / EX_KO / EX_EN matching LANG)
EX_ZH: [Pure Chinese]
---END---
===END===`;

import { DEFAULT_ARTIST } from '../utils/furiganaLayout/posterTitle';
import type { ClassifiedTextLine, OcrDetectedLanguage } from './ocrTypes';

export type PromptLyricsLanguage = 'auto' | 'jp' | 'ko' | 'en';

export type ExternalPromptOptions = {
  /** 是否要求 AI 附带 ===VOCAB=== / ===GRAMMAR=== 板块（由设置总开关决定） */
  includeVocabAndGrammar: boolean;
  /** 歌词语言模式：auto（自动，默认）/ jp（日语）/ ko（韩语）/ en（英语） */
  language?: PromptLyricsLanguage;
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

/** 波轮语言标签：写入 Prompt，避免同名不同语言歌曲搜错 */
function buildLanguageTargetBlock(language: PromptLyricsLanguage): string {
  switch (language) {
    case 'jp':
      return `
[Language_Target]
Target_Lyrics_Language: jp (Japanese)
Search_Disambiguation: Fetch OFFICIAL ORIGINAL **Japanese** lyrics only. Same title in English/Korean/Chinese is a different song — do NOT return those.
Output_Tags: LANG: jp | line tag JP: | apply Global_Syntax_Rules Rule_1–Rule_7 for ruby.`;
    case 'ko':
      return `
[Language_Target]
Target_Lyrics_Language: ko (Korean)
Search_Disambiguation: Fetch OFFICIAL ORIGINAL **Korean** lyrics only. Same title in Japanese/English/Chinese is a different song — do NOT return those.
Output_Tags: LANG: ko | line tag KO: | pure Hangul, NO ruby/brackets.`;
    case 'en':
      return `
[Language_Target]
Target_Lyrics_Language: en (English)
Search_Disambiguation: Fetch OFFICIAL ORIGINAL **English** lyrics only. Same title in Japanese/Korean/Chinese is a different song — do NOT return those.
Output_Tags: LANG: en | line tag EN: | plain English, NO ruby/brackets.`;
    case 'auto':
    default:
      return `
[Language_Target]
Target_Lyrics_Language: AUTO — infer original language from artist, album, market, and official recording.
Search_Disambiguation: When homonyms exist across languages, choose the OFFICIAL original version. Do NOT default to Japanese without evidence.
Output_Tags: MUST set LANG: to jp | ko | en. Use matching line tags (JP: / KO: / EN:) — never mix families in one song.`;
  }
}

function fillPromptTemplate(prompt: string, artist: string, title: string): string {
  return prompt.replaceAll('{{ARTIST}}', artist).replaceAll('{{TITLE}}', title);
}

export function buildExternalAiPrompt(
  artist: string,
  title: string,
  options: ExternalPromptOptions,
): string {
  const includeVocabAndGrammar = options.includeVocabAndGrammar;
  const language: PromptLyricsLanguage = options.language ?? 'auto';
  const t = title.trim().replace(/^《|》$/g, '');
  if (!t) {
    throw new Error('歌名为必填项，外部 AI 需要歌名才能查找歌词');
  }
  const a = artist.trim() || DEFAULT_ARTIST;
  const ocrBlock = buildOcrContextBlock(options.ocrContext);
  const langBlock = buildLanguageTargetBlock(language);

  if (language === 'ko') {
    const taskFlow = includeVocabAndGrammar ? KO_TASK_FLOW_FULL : KO_TASK_FLOW_LYRICS;
    const outputSchema = includeVocabAndGrammar ? KO_OUTPUT_SCHEMA_FULL : KO_OUTPUT_SCHEMA_LYRICS;
    let prompt = PROMPT_HEAD + langBlock + ocrBlock + taskFlow + outputSchema;
    if (includeVocabAndGrammar) {
      prompt += GRAMMAR_TITLE_RULE_BLOCK;
    }
    return fillPromptTemplate(prompt, a, t);
  }

  if (language === 'en') {
    const taskFlow = includeVocabAndGrammar ? EN_TASK_FLOW_FULL : EN_TASK_FLOW_LYRICS;
    const outputSchema = includeVocabAndGrammar ? EN_OUTPUT_SCHEMA_FULL : EN_OUTPUT_SCHEMA_LYRICS;
    let prompt = EN_PROMPT_HEAD + langBlock + ocrBlock + taskFlow + outputSchema;
    if (includeVocabAndGrammar) {
      prompt += GRAMMAR_TITLE_RULE_BLOCK;
    }
    return fillPromptTemplate(prompt, a, t);
  }

  if (language === 'auto') {
    const taskFlow = includeVocabAndGrammar ? AUTO_TASK_FLOW_FULL : AUTO_TASK_FLOW_LYRICS;
    const outputSchema = includeVocabAndGrammar ? AUTO_OUTPUT_SCHEMA_FULL : AUTO_OUTPUT_SCHEMA_LYRICS;
    let prompt = AUTO_PROMPT_HEAD + langBlock + ocrBlock + taskFlow + outputSchema;
    if (includeVocabAndGrammar) {
      prompt += GRAMMAR_TITLE_RULE_BLOCK;
      prompt += `
Rule_6 (Atomic_Ruby): When LANG: jp — each {...} wraps ONE contiguous Kanji run ONLY; re-check on EX_JP.`;
    }
    return fillPromptTemplate(prompt, a, t);
  }

  // 日语模式（jp）
  const taskFlow = includeVocabAndGrammar ? TASK_FLOW_FULL : TASK_FLOW_LYRICS_ONLY;
  const outputSchema = includeVocabAndGrammar ? OUTPUT_SCHEMA_FULL : OUTPUT_SCHEMA_LYRICS;
  let prompt = PROMPT_HEAD + langBlock + ocrBlock + taskFlow + outputSchema;
  if (includeVocabAndGrammar) {
    prompt += GRAMMAR_TITLE_RULE_BLOCK;
    prompt += `
Rule_4 (Zero_Tag_In_ZH): ZH/MEANING/DETAIL/EX_ZH lines MUST NOT contain any "{...}".
Rule_5 (Self_Check): Validate every Kanji in JP/EX_JP lines is bounded by "{...}"; re-check Rule_6 & Rule_7 on EX_JP too.`;
  }
  return fillPromptTemplate(prompt, a, t);
}

