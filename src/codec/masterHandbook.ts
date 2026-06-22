import type { LangCode } from '../services/appSettings';
import type { CompileOptions } from './types';

export type PosterTextRole =
  | 'lyricPrimary'
  | 'lyricSecondary'
  | 'vocabTerm'
  | 'vocabMeaning'
  | 'vocabExamplePrimary'
  | 'vocabExampleSecondary'
  | 'grammarTitlePrimary'
  | 'grammarTitleSecondary'
  | 'grammarDetail'
  | 'grammarExamplePrimary'
  | 'grammarExampleSecondary';

const LYRIC_PRIMARY: Record<LangCode, string> = {
  jp: 'jp-line',
  ko: 'ko-line',
  en: 'jp-line',
  zh: 'cn-line',
};

const LYRIC_SECONDARY: Record<LangCode, string> = {
  jp: 'zh-line',
  ko: 'zh-line',
  en: 'gloss-line',
  zh: 'gloss-line',
};

const VOCAB_TERM: Record<LangCode, string> = {
  jp: 'vocab-word',
  ko: 'vocab-word-ko',
  en: 'vocab-word',
  zh: 'vocab-word-cn',
};

const VOCAB_EX_PRIMARY: Record<LangCode, string> = {
  jp: 'vocab-ex-ja',
  ko: 'vocab-ex-ko',
  en: 'vocab-ex-ja',
  zh: 'vocab-ex-cn',
};

const GRAMMAR_EX_PRIMARY: Record<LangCode, string> = {
  jp: 'grammar-ex-ja',
  ko: 'grammar-ex-ko',
  en: 'grammar-ex-ja',
  zh: 'grammar-ex-cn',
};

const GRAMMAR_EX_SECONDARY: Record<LangCode, string> = {
  jp: 'grammar-ex-zh',
  ko: 'grammar-ex-zh',
  en: 'grammar-ex-gloss',
  zh: 'grammar-ex-gloss',
};

export function resolvePosterClass(
  role: PosterTextRole,
  contentLang: LangCode,
  opts?: CompileOptions,
): string {
  const iface = opts?.interfaceLanguage ?? 'zh';

  switch (role) {
    case 'lyricPrimary':
      return LYRIC_PRIMARY[contentLang];
    case 'lyricSecondary':
      if (contentLang === 'zh' && iface === 'zh') return '';
      return LYRIC_SECONDARY[contentLang];
    case 'vocabTerm':
      return VOCAB_TERM[contentLang];
    case 'vocabMeaning':
      return 'vocab-meaning';
    case 'vocabExamplePrimary':
      return VOCAB_EX_PRIMARY[contentLang];
    case 'vocabExampleSecondary':
      return 'vocab-ex-zh';
    case 'grammarTitlePrimary':
      if (contentLang === 'ko') return 'grammar-title-ko';
      if (contentLang === 'zh') return 'grammar-title-cn';
      return 'grammar-title-ja';
    case 'grammarTitleSecondary':
      if (contentLang === 'en') return 'grammar-title-gloss';
      return 'grammar-title-zh';
    case 'grammarDetail':
      return 'grammar-detail';
    case 'grammarExamplePrimary':
      return GRAMMAR_EX_PRIMARY[contentLang];
    case 'grammarExampleSecondary':
      return GRAMMAR_EX_SECONDARY[contentLang];
    default:
      return '';
  }
}

export function usesRubyMarkup(role: PosterTextRole, contentLang: LangCode): boolean {
  if (contentLang === 'ko' || contentLang === 'en') return false;
  if (contentLang === 'zh') {
    return (
      role === 'lyricPrimary' ||
      role === 'vocabTerm' ||
      role === 'grammarTitlePrimary'
    );
  }
  return (
    role === 'lyricPrimary' ||
    role === 'vocabTerm' ||
    role === 'vocabExamplePrimary' ||
    role === 'grammarTitlePrimary' ||
    role === 'grammarExamplePrimary'
  );
}

export function usesPlainHtml(role: PosterTextRole, contentLang: LangCode): boolean {
  if (contentLang === 'en') {
    return (
      role === 'lyricPrimary' ||
      role === 'vocabTerm' ||
      role === 'vocabExamplePrimary' ||
      role === 'grammarTitlePrimary' ||
      role === 'grammarExamplePrimary'
    );
  }
  if (contentLang === 'ko') {
    return (
      role === 'lyricPrimary' ||
      role === 'vocabTerm' ||
      role === 'vocabExamplePrimary' ||
      role === 'grammarTitlePrimary' ||
      role === 'grammarExamplePrimary'
    );
  }
  if (contentLang === 'zh') {
    return true;
  }
  return false;
}
