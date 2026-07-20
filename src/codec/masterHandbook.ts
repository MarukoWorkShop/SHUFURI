import type { InterfaceLanguage, LangCode } from '../services/appSettings';
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

/** 辅文 DOM class 由使用语言决定：zh → *-zh / zh-line；en → *-gloss / gloss-line */
function auxClass(zhClass: string, glossClass: string, iface: InterfaceLanguage): string {
  return iface === 'en' ? glossClass : zhClass;
}

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
      if (contentLang === 'en' && iface === 'en') return '';
      return auxClass('zh-line', 'gloss-line', iface);
    case 'vocabTerm':
      return VOCAB_TERM[contentLang];
    case 'vocabMeaning':
      return 'vocab-meaning';
    case 'vocabExamplePrimary':
      return VOCAB_EX_PRIMARY[contentLang];
    case 'vocabExampleSecondary':
      return auxClass('vocab-ex-zh', 'vocab-ex-gloss', iface);
    case 'grammarTitlePrimary':
      if (contentLang === 'ko') return 'grammar-title-ko';
      if (contentLang === 'zh') return 'grammar-title-cn';
      return 'grammar-title-ja';
    case 'grammarTitleSecondary':
      return auxClass('grammar-title-zh', 'grammar-title-gloss', iface);
    case 'grammarDetail':
      return 'grammar-detail';
    case 'grammarExamplePrimary':
      return GRAMMAR_EX_PRIMARY[contentLang];
    case 'grammarExampleSecondary':
      return auxClass('grammar-ex-zh', 'grammar-ex-gloss', iface);
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
      role === 'vocabExamplePrimary' ||
      role === 'grammarTitlePrimary' ||
      role === 'grammarExamplePrimary'
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
