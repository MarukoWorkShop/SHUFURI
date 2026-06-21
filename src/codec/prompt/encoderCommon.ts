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
  · 3 | (4 columns)
L|line_no(1-based)|target_main_line(ruby)|translation_or_gloss
${lColRules}
  · 3 | (4 columns)${vocab}
@9`;
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
L|1|{故:gù}事的小{黄:huáng}花|small yellow flowers of the story
@1
V|1|{黄:huáng}花|small yellow flower|1|路边开着小{黄:huáng}花|little yellow flowers by the road
@2
G|1|的 (possessive)|marks possession|1|我的{故:gù}事|my story
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
L|1|{故:gù}事的小{黄:huáng}花|故事的小黄花
@1
V|1|{黄:huáng}花|小黄花|1|路边开着小{黄:huáng}花|路边开着小黄花
@2
G|1|的（的）|表示领属或修饰|1|我的{故:gù}事|我的故事
@9`;
  }
}
