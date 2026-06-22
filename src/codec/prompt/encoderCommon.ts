import type { GlossSpec } from '../../services/languageMatrix/glossSpec';
import type { InterfaceLanguage, LanguageMatrixContext } from '../../services/languageMatrix/types';
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

export function buildGrammarLabelHint(interfaceLanguage: InterfaceLanguage): string {
  return interfaceLanguage === 'zh' ? 'Chinese' : 'English';
}

export function buildLearnerGlossBlock(gloss: GlossSpec, matrix: LanguageMatrixContext): string {
  const pedagogicalRule =
    matrix.interfaceLanguage === 'zh'
      ? `MEANING, DETAIL, lyric translation (L column 4), and EX_ZH MUST be ${gloss.label}. NO English in pedagogical fields.`
      : `MEANING, DETAIL, lyric translation (L column 4), and EX_ZH MUST be ${gloss.label}; grammar TITLE uses (English gloss); NO Chinese in pedagogical fields.`;

  return `
[Learner]
Interface: ${matrix.interfaceLanguage}
Gloss: ${gloss.label}
Rule: ${pedagogicalRule}
Allowed_Langs: ${matrix.learningTargetLanguages.join(', ')}
Active: ${matrix.activeTarget}`;
}

export function buildVocabGrammarIncludeRule(
  include: boolean,
  interfaceLanguage: InterfaceLanguage,
): string {
  if (!include) {
    return '- Output H + L only; omit V/G sections.';
  }
  const hint = buildGrammarLabelHint(interfaceLanguage);
  return `- V: 6–10 items; G: 3–6 points; G column 3 label format: "source term (${hint} gloss in parentheses)"; parentheses hold native-language gloss.`;
}

export function buildLyricsLine4Rule(
  gloss: GlossSpec,
  interfaceLanguage: InterfaceLanguage,
  targetLang: SampleLang,
): string {
  if (targetLang === 'en') {
    return `- L column 4: ${gloss.label} gloss (maps to column 3; brief gloss or leave empty).`;
  }
  if (targetLang === 'zh') {
    if (interfaceLanguage === 'zh') {
      return '- L column 4: leave empty (Chinese interface; no gloss line).';
    }
    return `- L column 4: ${gloss.label} gloss (${gloss.translationField}).`;
  }
  if (interfaceLanguage === 'zh') {
    return '- L column 4: full-line Simplified Chinese translation (maps to column 3; NOT a line number or vocab meaning).';
  }
  return `- L column 4: full-line ${gloss.translationField} (secondary lyric line; NOT a line number or vocab meaning).`;
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

export function buildStrictRaw(includeVocab: boolean): string {
  const columnIntegrity = includeVocab
    ? `
- Column count integrity: each row MUST have a fixed pipe count (tag + fields). Count unescaped | only.
  · H: exactly 3 | → H|artist|title|lang
  · L: exactly 3 | → L|line_no|main|translation_or_gloss (trailing | when column 4 empty)
  · V/G: exactly 6 | → tag|index|field3|field4|lyric_line_no|pedagogical_example|pedagogical_translation (trailing | when last field empty)
- Emit ALL L rows before @1/@2 V/G sections.
- lyric_line_no (5th field): REQUIRED 1-based L line (≥1) where the term/grammar appears in lyrics (study-card source). NEVER 0.
- pedagogical_example (6th field): REQUIRED hand-written teaching sentence for poster; MUST differ from the cited L line; NEVER a lone integer.
- pedagogical_translation (7th field): gloss of pedagogical_example only — NOT the line number.`
    : `
- Column count integrity: each row MUST have a fixed pipe count (tag + fields). Count unescaped | only.
  · H: exactly 3 | → H|artist|title|lang
  · L: exactly 3 | → L|line_no|main|translation_or_gloss (trailing | when column 4 empty)
- Do NOT emit @1, @2, V, or G rows.`;

  return `
[STRICT_RAW]
- Output MUST be a record stream only: start with @0, end with @9.
- Forbidden: markdown code fences (\`\`\`), HTML, explanatory prefix/suffix text.
- One record per line; column separator is unescaped |; literal | inside a field MUST be written as \\|.
- Ruby micro-syntax: {base:reading} (colon, NOT pipe); e.g. {秋桜:コスモス}, {淡:あわ}.${columnIntegrity}`;
}

export function buildWireSchema(includeVocab: boolean, interfaceLanguage: InterfaceLanguage): string {
  const glossCol =
    interfaceLanguage === 'zh'
      ? 'Simplified Chinese (meaning column, example translation column, lyric translation)'
      : 'natural English (meaning, example translation, lyric translation; NO Chinese)';

  const lColRules =
    interfaceLanguage === 'zh'
      ? `  · jp/ko: column 4 = Simplified Chinese line translation → frontend .zh-line
  · en: column 4 = Simplified Chinese gloss
  · zh: column 4 may be empty`
      : `  · jp/ko: column 4 = natural English line translation → frontend .zh-line (DOM class name unchanged)
  · en: column 4 = natural English gloss
  · zh: column 4 = natural English gloss → gloss-line`;

  const vocab = includeVocab
    ? `
@1
V|index|headword|meaning|lyric_line_no|pedagogical_example|pedagogical_translation
  · 6 | (7 fields); meaning + pedagogical_translation = ${glossCol}
  · lyric_line_no = L line where headword appears (≥1, NEVER 0) — for study cards, NOT poster
  · pedagogical_example = new teaching sentence (poster) — do NOT copy L line verbatim
  · pedagogical_translation = gloss of pedagogical_example (NOT line number)
@2
G|index|grammar_label|detail|lyric_line_no|pedagogical_example|pedagogical_translation
  · 6 | (7 fields); detail + pedagogical_translation = ${glossCol}
  · lyric_line_no = L line illustrating grammar (≥1, NEVER 0) — for study cards
  · pedagogical_example = new teaching sentence (poster) — do NOT copy L line verbatim
  · pedagogical_translation = gloss of pedagogical_example (NOT line number)
...`
    : '';
  return `
[Wire_Schema]
@0
H|artist|title|lang
  · 3 | (4 columns); col3 = prompt song title (metadata only — NOT a substitute for L|1)
L|line_no(1-based)|target_main_line(ruby)|translation_or_gloss
  · col2 MUST start at 1 and be contiguous 1..N (no skipping L|1)
${lColRules}
  · 3 | (4 columns)${vocab}
@9`;
}

export function buildZhRubyLyricsBlock(): string {
  return `
[Zh_ruby — L column 3 and V column 3 (headword) ONLY]
- Format: {汉字:拼音} micro-syntax (colon in prompt; pipe also accepted)
- EVERY CJK character in lyric lines MUST have ruby — no bare Hanzi (Latin/digits/punctuation exempt)
- Emit ONLY back-to-back {字:拼音} tokens plus spaces/punctuation/Latin — NEVER bare CJK between tokens
- Prefer per-character {字:zì} tokens; multi-char words may use {词:pín yīn} when syllable count matches Hanzi count
- Forbidden: skipping ruby for "common" characters or only annotating headwords
- Forbidden alternating pattern (Qwen/Tongyi failure — causes doubled Hanzi on screen):
  · WRONG: {藤:téng}蔓{蔓:màn}植{植:zhí}物{物:wù} → displays as 藤蔓蔓植植物物
  · WRONG: Japanese-style base+brace: 藤{蔓:màn} or 蔓{蔓:màn}
  · WRONG: repeating the same Hanzi outside and inside consecutive tokens: {A:py}B{B:py}
- CORRECT: L|1|{藤:téng}{蔓:màn}{植:zhí}{物:wù}|translation
- Ruby reading MUST be pinyin (Latin letters + tone marks/numbers) — NEVER another CJK character in the reading slot
- Self-check per L row: mentally delete every {…:…} token — remaining col3 must contain ZERO CJK characters`;
}

export function buildZhGrammarLabelBlock(): string {
  return `
[Zh_grammar — G column 3 (grammar_label)]
- Plain Hanzi + gloss in parentheses — NO {汉字:拼音} ruby tokens in grammar_label
- Format: source_term (English gloss in parentheses) — same as jp/ko/en grammar samples
- Examples: 像 (simile marker) | 满了 (resultative complement) | 在 (progressive marker)
- col4 (detail) = English explanation; parentheses in col3 hold the short English gloss only
- FORBIDDEN in col3: {满:了} (reading slot must never be another Hanzi — causes 满 with 了 above 满)
- FORBIDDEN: {为:为}, {像:像}, {在:在} — never repeat Hanzi as the "reading"
- FORBIDDEN: applying L-line full-line ruby rules to G col3
- If you need two characters (e.g. 满 + 了), write plain text: 满了 (resultative complement) — not {满:了}`;
}

export function buildZhPedagogicalExampleBlock(): string {
  return `
[Zh_pedagogical — V/G column 6 (pedagogical_example)]
- Plain Hanzi only — NO {汉字:拼音} ruby in pedagogical_example (poster hides example pinyin)
- If you ever emit ruby in col6 by mistake: use contiguous {字:拼音} only — NEVER {A:py}B{B:py} alternating
- MUST write a NEW teaching sentence — NEVER copy any L line verbatim or reuse a lyric fragment
- lyric_line_no (col 5) cites the line where the term appears; col 6 must differ from that L line text
- pedagogical_translation (col 7) glosses col 6 only`;
}

export function buildIntegrityCheck(includeVocab: boolean): string {
  const extra = includeVocab
    ? ' Each V/G row MUST have lyric_line_no (≥1) + pedagogical_example (new sentence ≠ cited L line) + pedagogical_translation. NEVER 0 in lyric_line_no.'
    : '';
  return `
[Integrity]
- Retrieve complete official lyrics; line numbers MUST be contiguous 1..N.
- Stream MUST end with @9; missing @9 counts as failure.${extra}`;
}

export function buildStreamCloseBlock(): string {
  return `
[Stream_Close — REQUIRED]
- The absolute LAST line of your entire output MUST be exactly: @9
- After @9 output NOTHING: no summary, no 「希望对您有帮助」, no markdown fence, no blank explanation
- Missing @9 = entire output rejected by the app (100% failure)
- If token budget is tight: shorten V/G or omit @1/@2 entirely, but NEVER omit @9
- Self-check before send: scroll to bottom — last non-empty line MUST be @9`;
}

export function buildHeaderLyricsSeparationBlock(artist: string, title: string): string {
  return `
[H_metadata vs L_lyrics — NO deduplication]
- H|artist|title|lang is METADATA only:
  · col2 = artist "${artist}" (from prompt)
  · col3 = song title "${title}" (from prompt) — NEVER substitute the first lyric line
  · col4 = lang code
- L|line_no|main|translation is LYRICS only:
  · col2 = contiguous 1-based index; MUST include L|1 and run 1..N with no gaps or renumbering
  · col3 = official sung lyric text; col4 = translation/gloss
- CRITICAL: when H|col3 and L|1|col3 text are identical, emit BOTH rows (two separate records) — NEVER skip L|1 because H already contains the same string
- "Both rows" means H and L|1 records — NOT doubling each Hanzi character inside L col3
- NEVER copy L|1 into H|col3 when it differs from prompt title "${title}"
- Context/OCR First_Line (if present) is the opening lyric → belongs in L|1 col3 when official; it does NOT replace H|col3 unless it equals the prompt title
- Self-check before send: H|col3 is exactly "${title}"; L|1 exists; line numbers are 1..N contiguous`;
}

/** When H title equals L|1 lyric text, both H and L|1 rows are required (not per-character doubling). */
export function buildTitleLyricOverlapSampleBlock(): string {
  return `
[Sample — H title equals L|1 text; both H and L|1 rows required]
@0
H|示例歌手|同文歌名|ko
L|1|同文歌名|When H col3 equals L|1 col3, still emit L|1 — do NOT skip L|1 (this is NOT doubling each character)
L|2|다음 가사 줄|next line translation
@9`;
}

export function buildSourceIntegrityBlock(artist: string, title: string): string {
  return `
[Source_Integrity — NO hallucination]
- Target song: "${artist} - ${title}" (exact artist + title from the prompt)
- Use the complete OFFICIAL published lyrics only — same song, same artist, same language
- Do NOT invent, guess, paraphrase from memory, or merge lines from other songs/versions/covers
- Do NOT split one official line into two L rows or merge two official lines into one L row
- L indices MUST be contiguous 1..N matching the authoritative full lyric text
- If unsure of any line: omit that L row rather than fabricate (incomplete + @9 beats wrong lyrics)
- H|col3 = metadata title; L|col3 = lyric text — separate roles even when strings match`;
}

export function buildModelComplianceBlock(): string {
  return `
[Model_Compliance]
- Output RAW record stream only — first line MUST be @0 (or H| after any strip)
- Forbidden: \`\`\` code fences, HTML, bullet lists, JSON, explanatory preface/epilogue
- Tongyi/Qwen/通义千问: @9 is non-negotiable; verify last line before sending
- Tongyi/Qwen zh L col3: contiguous {字:拼音} tokens only — never {A:py}B{B:py}; zero bare CJK after removing all tokens
- Doubao/other models: same rules — no postscript after @9`;
}

export type SampleLang = 'jp' | 'ko' | 'en' | 'zh';

/** Minimal @0/@1/@2/@9 sample: lyric_line_no + pedagogical example */
export function buildFullSampleBlock(
  lang: SampleLang,
  includeVocab: boolean,
  interfaceLanguage: InterfaceLanguage,
): string {
  const glossPlaceholder =
    interfaceLanguage === 'zh' ? '(Chinese gloss, optional)' : '(English gloss, optional)';

  if (!includeVocab) {
    return `
[Sample]
@0
H|Demo Artist|Demo Title|${lang}
L|1|(one target-language line)|${glossPlaceholder}
@9`;
  }

  if (interfaceLanguage === 'en') {
    switch (lang) {
      case 'jp':
        return `
[Sample]
@0
H|山口百惠|秋樱|jp
L|1|{淡:あわ}い{色:いろ}の{秋桜:コスモス}|Pale cosmos in a light hue
@1
V|1|{秋桜:コスモス}|cosmos flower|1|{秋桜:コスモス}が{咲:さ}いた|cosmos flowers bloomed
@2
G|1|の (possessive particle)|marks possession or modification|1|{秋桜:コスモス}の{花:はな}|flowers of the cosmos
@9`;
      case 'ko':
        return `
[Sample]
@0
H|아이유|Blueming|ko
L|1|우리만의 블루밍|Our own blooming
@1
V|1|블루밍|blooming|1|꽃이 블루밍했다|the flowers bloomed
@2
G|1|만의 (possessive)|marks belonging|1|우리만의 노래|our own song
@9`;
      case 'en':
        return `
[Sample]
@0
H|Adele|Hello|en
L|1|Hello from the other side|greeting from afar
@1
V|1|hello|greeting|1|She said hello to me|she greeted me
@2
G|1|from (source)|indicates origin|1|a letter from home|a letter from home
@9`;
      case 'zh':
        return `
[Sample]
@0
H|周杰伦|晴天|zh
L|1|{故:gù}{事:shì}{的:de}{小:xiǎo}{黄:huáng}{花:huā}|small yellow flowers of the story
@1
V|1|{黄:huáng}{花:huā}|small yellow flower|1|路边开着小黄花|little yellow flowers by the road
@2
G|1|的 (possessive)|marks possession|1|这是老师的书|this is the teacher's book
@9`;
    }
  }

  switch (lang) {
    case 'jp':
      return `
[Sample]
@0
H|山口百惠|秋樱|jp
L|1|{淡:あわ}い{色:いろ}の{秋桜:コスモス}|淡淡的秋樱
@1
V|1|{秋桜:コスモス}|大波斯菊|1|{秋桜:コスモス}が{咲:さ}いた|秋樱绽放了
@2
G|1|の（的）|表示领属或修饰|1|{秋桜:コスモス}の{花:はな}|秋樱的花
@9`;
    case 'ko':
      return `
[Sample]
@0
H|아이유|Blueming|ko
L|1|우리만의 블루밍|我们专属的 blooming
@1
V|1|블루밍|开花、绽放|1|꽃이 블루밍했다|花儿绽放了
@2
G|1|만의（专属的）|表示所属|1|우리만의 노래|我们专属的歌
@9`;
    case 'en':
      return `
[Sample]
@0
H|Adele|Hello|en
L|1|Hello from the other side|从另一边问好
@1
V|1|hello|问候|1|She said hello to me|她向我问好
@2
G|1|from（从）|表示来源|1|a letter from home|一封来自家的信
@9`;
    case 'zh':
      return `
[Sample]
@0
H|周杰伦|晴天|zh
L|1|{故:gù}{事:shì}{的:de}{小:xiǎo}{黄:huáng}{花:huā}|故事的小黄花
@1
V|1|{黄:huáng}{花:huā}|小黄花|1|路边开着小黄花|路边开着小黄花
@2
G|1|的（的）|表示领属或修饰|1|这是老师的书|这是老师的书
@9`;
  }
}
