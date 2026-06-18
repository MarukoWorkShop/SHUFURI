import type { GlossLanguage } from './types';

export type GlossSpec = {
  label: string;
  grammarTitleSchema: string;
  grammarTitleRule: string;
  zeroTagRule: string;
  meaningField: string;
  detailField: string;
  translationField: string;
  exTranslationField: string;
};

const GLOSS_SPECS: Record<GlossLanguage, GlossSpec> = {
  zh: {
    label: 'Simplified Chinese',
    grammarTitleSchema:
      'TITLE: [Grammar point in original language]（[Pure Chinese gloss — MUST be inside parentheses）]',
    grammarTitleRule: `
[Grammar_TITLE_Format] (===GRAMMAR=== TITLE only; LANG: jp | ko | en)
- REQUIRED: [original-language grammar label]（[pure Chinese name]）
- Chinese gloss MUST be inside （） or (); NEVER append Chinese after only a space.
- BAD: ~ ㄹ 거야 推测终结句 | ～てゆく 逐渐…下去 | Past Simple 一般过去时
- GOOD: ~ ㄹ 거야（推测终结句）| ～{て|て}ゆく（逐渐…下去）| Past Simple（一般过去时）
- LANG: jp — {Kanji|Kana} ruby allowed BEFORE （ only; ZH inside （ must have NO "{...}".
- DETAIL remains a separate pure-Chinese field.`,
    zeroTagRule:
      'Rule_4 (Zero_Tag_In_ZH): ZH / MEANING / DETAIL / EX_ZH lines MUST NOT contain any "{...}".',
    meaningField: 'Pure Chinese',
    detailField: 'Pure Chinese explanation',
    translationField: 'Pure Chinese translation',
    exTranslationField: 'Pure Chinese',
  },
  en: {
    label: 'natural English',
    grammarTitleSchema:
      'TITLE: [Grammar point in original language] ([Pure English gloss — MUST be inside parentheses])',
    grammarTitleRule: `
[Grammar_TITLE_Format] (===GRAMMAR=== TITLE only; LANG: jp | ko | en)
- REQUIRED: [original-language grammar label] ([pure English name])
- English gloss MUST be inside () or （）; NEVER append English after only a space.
- BAD: ~ ㄹ 거야 speculative ending | ～てゆく gradual continuation
- GOOD: ~ ㄹ 거야 (speculative ending) | ～{て|て}ゆく (gradual continuation) | Past Simple (simple past tense)
- LANG: jp — {Kanji|Kana} ruby allowed BEFORE ( only; gloss inside ( ) must have NO "{...}".
- DETAIL remains a separate pure-English field.`,
    zeroTagRule:
      'Rule_4 (Zero_Tag_In_Gloss): ZH / MEANING / DETAIL / EX_ZH lines MUST NOT contain any "{...}". Write English gloss text only.',
    meaningField: 'Natural English',
    detailField: 'Pure English explanation for native English learners',
    translationField: 'Natural English translation',
    exTranslationField: 'Natural English',
  },
};

export function getGlossSpec(gloss: GlossLanguage): GlossSpec {
  return GLOSS_SPECS[gloss];
}
