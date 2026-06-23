import type { GlossSpec } from '../../services/languageMatrix/glossSpec';
import type { InterfaceLanguage, LanguageMatrixContext } from '../../services/languageMatrix/types';
import type { ClassifiedTextLine, OcrDetectedLanguage } from '../../services/ocrTypes';

export type EncoderPromptOptions = {
  includeVocabAndGrammar: boolean;
  matrix: LanguageMatrixContext;
  modelHint?: 'qwen' | 'doubao' | 'deepseek' | 'default';
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
      ? `MEANING, DETAIL, lyric translation (L column 4), and pedagogical_translation (V/G col7) MUST be ${gloss.label}. NO English in pedagogical fields.`
      : `MEANING, DETAIL, lyric translation (L column 4), and pedagogical_translation (V/G col7) MUST be ${gloss.label}; grammar_label col3 uses (${buildGrammarLabelHint(matrix.interfaceLanguage)} gloss in parentheses). NO Chinese in pedagogical fields.`;

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
  const parenRule =
    interfaceLanguage === 'zh'
      ? 'grammar_label gloss MUST be inside （） or (); NEVER append Chinese after only a space'
      : 'grammar_label gloss MUST be inside () or （）; NEVER append gloss after only a space';
  return `- V: 6–10 items; G: 3–6 points; G column 3: "source term (${hint} gloss in parentheses)"; ${parenRule}.`;
}

export function buildLyricsLine4WireRule(
  gloss: GlossSpec,
  interfaceLanguage: InterfaceLanguage,
  activeTarget: SampleLang,
): string {
  if (activeTarget === 'en') {
    return `  · L column 4 = ${gloss.label} gloss`;
  }
  if (activeTarget === 'zh') {
    if (interfaceLanguage === 'zh') {
      return '  · L column 4 = leave empty (trailing | when empty)';
    }
    return `  · L column 4 = ${gloss.label} gloss`;
  }
  if (interfaceLanguage === 'zh') {
    return '  · L column 4 = Simplified Chinese line translation → frontend .zh-line';
  }
  return `  · L column 4 = natural English line translation → frontend .zh-line (DOM class unchanged)`;
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
  lines.push(
    'Context hints do NOT override H col3 title or official lyrics.',
    '[End_Context]',
  );
  return '\n' + lines.join('\n') + '\n';
}

export function buildStrictRaw(includeVocab: boolean): string {
  const vocabNote = includeVocab
    ? '- Emit ALL L rows before @1/@2 V/G sections.'
    : '- Do NOT emit @1, @2, V, or G rows.';
  return `
[STRICT_RAW]
- Forbidden: markdown code fences (\`\`\`), HTML, explanatory prefix/suffix text.
- One record per line; column separator is unescaped |; literal | inside a field MUST be written as \\|.
- Ruby micro-syntax: {base:reading} (colon, NOT pipe); e.g. {秋桜:コスモス}, {淡:あわ}.
${vocabNote}`;
}

export function buildWireSchema(
  includeVocab: boolean,
  interfaceLanguage: InterfaceLanguage,
  activeTarget: SampleLang,
  gloss: GlossSpec,
): string {
  const glossCol =
    interfaceLanguage === 'zh'
      ? 'Simplified Chinese (meaning, pedagogical_translation, lyric translation)'
      : 'natural English (meaning, pedagogical_translation, lyric translation; NO Chinese)';

  const lColRule = buildLyricsLine4WireRule(gloss, interfaceLanguage, activeTarget);

  const vgFieldRules = includeVocab
    ? `
- lyric_line_no (col5): see [Study_cards]
- pedagogical_example (col6): see [Pedagogical_example]
- pedagogical_translation (col7): gloss of col6 only`
    : '';

  const vocab = includeVocab
    ? `
@1
V|index|headword|meaning|lyric_line_no|pedagogical_example|pedagogical_translation
  · exactly 6 | (7 fields); meaning + pedagogical_translation = ${glossCol}
@2
G|index|grammar_label|detail|lyric_line_no|pedagogical_example|pedagogical_translation
  · exactly 6 | (7 fields); detail + pedagogical_translation = ${glossCol}${vgFieldRules}`
    : '';

  return `
[Wire_Schema]
@0
H|artist|title|lang
  · exactly 3 | (4 fields); col3 = prompt song title (metadata — NOT a substitute for L|1); col4 = lang code
L|line_no(1-based)|target_main_line|translation_or_gloss
  · exactly 3 | (4 fields); col2 contiguous 1..N (MUST include L|1)
${lColRule}${vocab}
  · Stream ends with @9`;
}

export function buildJpRubyBlock(includeVocab: boolean): string {
  const col6Line = includeVocab
    ? '\n- V/G col6: newly authored sentence — never copy any L|n|col3 (see [Pedagogical_example])'
    : '';
  return `
[Jp_ruby]
- L col3 / V headword col3: {漢字:かな} on kanji; kana-only / digits / punctuation unchanged${col6Line}`;
}

export function buildZhColumnMapBlock(includeVocab: boolean): string {
  const pedRef = includeVocab ? ', [Pedagogical_example]' : '';
  return `
[Zh_column_map]
| Row        | col3 (main/label/headword)     | col6 (pedagogical_example) |
| L          | {字:pinyin} contiguous tokens  | —                          |
| V headword | {字:pinyin} allowed            | plain Hanzi only           |
| G label    | plain Hanzi + (gloss)          | plain Hanzi only           |
See [Zh_ruby], [Zh_grammar]${pedRef} for details.`;
}

export function buildZhRubyLyricsBlock(): string {
  return `
[Zh_ruby — L col3 and V headword col3 ONLY]
- Format: {汉字:拼音}; emit ONLY back-to-back tokens + spaces/punctuation/Latin — NEVER bare CJK between tokens
- Reading MUST be pinyin (Latin + tone marks/numbers) — NEVER another CJK character
- WRONG: {藤:téng}蔓{蔓:màn}… → 藤蔓蔓… on screen | WRONG: {A:py}B{B:py}
- CORRECT: L|1|{藤:téng}{蔓:màn}{植:zhí}{物:wù}|…
- Self-check: delete all {…:…} from L col3 — zero CJK characters remain`;
}

export function buildZhGrammarLabelBlock(interfaceLanguage: InterfaceLanguage): string {
  const glossInParen =
    interfaceLanguage === 'zh'
      ? 'short Chinese gloss inside （） or () — NO English in col3 parentheses'
      : 'short English gloss inside () or （）';
  const detailCol =
    interfaceLanguage === 'zh' ? 'col4 (detail) = Simplified Chinese explanation' : 'col4 (detail) = English explanation';
  const examples =
    interfaceLanguage === 'zh'
      ? '像（比喻标记）| 满了（结果补语）| 在（进行态标记）'
      : '像 (simile marker) | 满了 (resultative complement) | 在 (progressive marker)';

  return `
[Zh_grammar — G col3 grammar_label]
- Plain Hanzi + gloss in parentheses — NO {汉字:拼音} ruby in grammar_label
- Format: source_term (${glossInParen})
- Examples: ${examples}
- ${detailCol}
- Gloss inside parentheses MUST have NO "{...}" ruby tokens
- FORBIDDEN: {满:了}, {为:为}, {像:像} — never Hanzi as "reading"; use plain 满了 (gloss) not {满:了}`;
}

export function buildStudyCardsCitationBlock(): string {
  return `
[Study_cards — lyric_line_no col5 ALL languages]
- Word/grammar study cards (Anki) are built from V/G rows for jp, ko, en, and zh equally
- Study card example = L|lyric_line_no|col3 lyric line (+ L col4 translation when present) — ALWAYS the original sung line
- Study cards NEVER use pedagogical_example (col6); col6 is for the poster only
- col5 MUST be the 1-based L index where the headword or grammar point appears in the official lyrics`;
}

export function buildPedagogicalExampleBlock(activeTarget: SampleLang): string {
  const langNotes: Record<SampleLang, string> = {
    jp: '- jp col6 may use {base:reading} ruby — still must be a NEW sentence, not a lyric paste',
    ko: '- ko col6: plain Korean sentence — no parenthetical readings',
    en: '- en col6: plain English sentence — no ruby',
    zh: '- zh col6: plain Hanzi only — NO {汉字:拼音} ruby (see [Zh_column_map])',
  };
  return `
[Pedagogical_example — V/G col6 ALL target languages]
- col6 is a hand-written teaching example for the poster — NOT a lyric quotation
- col5 (lyric_line_no) cites the lyric line for study cards — see [Study_cards]
- FORBIDDEN: copying the cited L line into col6 (col6 is poster-only; study cards read L rows directly)
- FORBIDDEN: copying the cited L line, any other L line, or a contiguous lyric fragment from the song
- col6 MUST differ from every L|n|col3 text (compare after removing {base:reading} ruby markup)
- Self-check: if col6 equals or is contained in any lyric line → rewrite col6 as a new sentence
${langNotes[activeTarget]}`;
}

export function buildStreamCloseBlock(): string {
  return `
[Stream_Close — REQUIRED]
- The absolute LAST line of your entire output MUST be exactly: @9
- After @9 output NOTHING: no summary, no 「希望对您有帮助」, no markdown fence, no explanation
- If token budget is tight: shorten V/G or omit @1/@2 entirely, but NEVER omit @9`;
}

export function buildHeaderLyricsSeparationBlock(artist: string, title: string): string {
  return `
[H_metadata vs L_lyrics]
- H = metadata: col2 artist "${artist}", col3 title "${title}", col4 lang code
- L = lyrics: col2 contiguous 1..N; col3 official lyric text
- When H col3 equals L|1 col3 text: emit BOTH rows — NEVER skip L|1 (two records, NOT per-character doubling)
- Example: H|歌手|同文歌名|ko and L|1|同文歌名|translation — both required
- NEVER put L|1 text into H col3 when it differs from prompt title "${title}"
- OCR First_Line → L|1 col3 when official; does NOT replace H col3 unless it equals the prompt title`;
}

export function buildSourceIntegrityBlock(
  artist: string,
  title: string,
  firstLyricLine?: string,
): string {
  const searchQuery =
    artist.trim() && artist.trim() !== '佚名'
      ? `「${artist} ${title} 歌词」`
      : `「${title} 歌词」`;
  const anchor = firstLyricLine?.trim()
    ? `\n- Anchor line (OCR/song match): "${firstLyricLine.trim().slice(0, 120)}" — searched lyrics MUST include this line; reject wrong homonym songs`
    : '';
  return `
[Source_Integrity]
- Target: "${artist} - ${title}" — studio OFFICIAL published lyrics ONLY (not memory, paraphrase, fan lyric)
- BEFORE encoding: search web for ${searchQuery}; transcribe verbatim from ≥2 matching lyric pages; turn on 联网/搜索 if the app supports it
- L col3 = published lines only; if sources conflict or search fails: output verified L rows + @9 — NEVER pad gaps with guesses${anchor}
- Do NOT invent, merge other songs, or split/merge official lines
- L indices contiguous 1..N; omit uncertain lines rather than fabricate (incomplete + @9 beats wrong lyrics)`;
}

export function buildSelfCheckBlock(activeTarget: SampleLang, includeVocab: boolean): string {
  const col6Line = includeVocab
    ? '\n4. V/G col6 differs from every L|n|col3 — new poster sentence only (see [Pedagogical_example])'
    : '';
  const zhLine =
    activeTarget === 'zh'
      ? `\n${includeVocab ? '5' : '4'}. zh L col3: zero bare CJK after removing all {…:…} tokens`
      : '';
  return `
[Self_Check — before send]
1. Last non-empty line is exactly @9
2. L line numbers contiguous 1..N
3. H col3 = prompt title; L|1 exists; L lyrics transcribed from web search — not memory recall${col6Line}${zhLine}`;
}

export function buildModelComplianceBlock(modelHint?: EncoderPromptOptions['modelHint']): string {
  let extra = '';
  if (modelHint === 'qwen') {
    extra =
      '\n- Tongyi/Qwen: enable 联网搜索 first; verify lyrics against web — never {A:py}B{B:py} on zh L col3; verify @9';
  } else if (modelHint === 'deepseek') {
    extra =
      '\n- DeepSeek: search official lyrics before @0; no preamble/reasoning; no ``` fences; after @9 output NOTHING';
  } else if (modelHint === 'doubao') {
    extra =
      '\n- Doubao: enable 联网搜索 to verify official lyrics before encoding; never guess from memory';
  }
  return `
[Model_Compliance]
- Output RAW record stream only — first line @0; no \`\`\` fences, HTML, bullet lists, JSON, or epilogue after @9${extra}`;
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
V|1|{黄:huáng}{花:huā}|small yellow flower|1|春天路边开满小黄花|little yellow flowers bloom by the road in spring
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
L|1|{故:gù}{事:shì}{的:de}{小:xiǎo}{黄:huáng}{花:huā}|
@1
V|1|{黄:huáng}{花:huā}|小黄花|1|春天路边开满小黄花|路边春天开满小黄花
@2
G|1|的（的）|表示领属或修饰|1|这是老师的书|这是老师的教材
@9`;
  }
}
