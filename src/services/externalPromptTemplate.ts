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

import { DEFAULT_ARTIST } from '../utils/furiganaLayout/posterTitle';

export type ExternalPromptOptions = {
  /** 是否要求 AI 附带 ===VOCAB=== / ===GRAMMAR=== 板块（由设置总开关决定） */
  includeVocabAndGrammar: boolean;
};

export function buildExternalAiPrompt(
  artist: string,
  title: string,
  options: ExternalPromptOptions,
): string {
  const includeVocabAndGrammar = options.includeVocabAndGrammar;
  const t = title.trim().replace(/^《|》$/g, '');
  if (!t) {
    throw new Error('歌名为必填项，外部 AI 需要歌名才能查找歌词');
  }
  const a = artist.trim() || DEFAULT_ARTIST;

  const taskFlow = includeVocabAndGrammar ? TASK_FLOW_FULL : TASK_FLOW_LYRICS_ONLY;
  const outputSchema = includeVocabAndGrammar ? OUTPUT_SCHEMA_FULL : OUTPUT_SCHEMA_LYRICS;

  let prompt = PROMPT_HEAD;
  if (includeVocabAndGrammar) {
    prompt += `
Rule_4 (Zero_Tag_In_ZH): ZH/MEANING/DETAIL/EX_ZH lines MUST NOT contain any "{...}".
Rule_5 (Self_Check): Validate every Kanji in JP/EX_JP lines is bounded by "{...}"; re-check Rule_6 & Rule_7 on EX_JP too.`;
  }
  prompt += taskFlow + outputSchema;

  return prompt.replaceAll('{{ARTIST}}', a).replaceAll('{{TITLE}}', t);
}
