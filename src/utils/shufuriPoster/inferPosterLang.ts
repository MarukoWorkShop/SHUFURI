import type { LangCode, LyricsLanguage } from '../../services/appSettings';

function isRubyToggleLang(lang: LangCode): boolean {
  return lang === 'jp' || lang === 'zh';
}

/** 正文是否含 HTML ruby 注音（与 compile / 注音开关 CSS 一致） */
export function bodyHtmlHasPosterRuby(html: string): boolean {
  return /<ruby[\s>]/i.test(html);
}

/** 从已排版 HTML 推断管线语言（旧项目无 lang 元数据时的兜底） */
export function inferPosterLangFromBodyHtml(html: string): LangCode | undefined {
  if (
    /\blyrics-group--zh\b/.test(html) ||
    /\bcn-line\b/.test(html) ||
    /\blyrics-vocabulary--zh\b/.test(html) ||
    /\blyrics-vocab-item--zh\b/.test(html)
  ) {
    return 'zh';
  }
  if (/\bko-line\b/.test(html)) {
    return 'ko';
  }
  if (/\bjp-line\b/.test(html) && bodyHtmlHasPosterRuby(html)) {
    return 'jp';
  }
  // 英语正文复用 jp-line 且无 ruby；日语歌词通常带注音
  if (/\bjp-line\b/.test(html)) {
    return 'en';
  }
  return undefined;
}

/** 编辑/预览统一解析排版管线 lang（声明 > HTML 推断 > 拨轮） */
export function resolvePosterPipelineLang(
  declaredLang: LangCode | undefined,
  bodyHtml: string,
  lyricsLanguage: LyricsLanguage,
): LangCode | undefined {
  // 与 resolveDocumentLang（services/documentLang.ts）规则一致
  if (declaredLang) {
    return declaredLang;
  }
  const inferred = inferPosterLangFromBodyHtml(bodyHtml);
  if (inferred) {
    return inferred;
  }
  if (
    lyricsLanguage === 'jp' ||
    lyricsLanguage === 'ko' ||
    lyricsLanguage === 'en' ||
    lyricsLanguage === 'zh'
  ) {
    return lyricsLanguage;
  }
  return undefined;
}

/** 注音显隐开关是否可用（jp/zh 管线，或拨轮 jp/zh 且正文含 ruby） */
export function resolvePosterRubyToggleSupported(
  declaredLang: LangCode | undefined,
  bodyHtml: string,
  lyricsLanguage: LyricsLanguage,
): boolean {
  const pipelineLang = resolvePosterPipelineLang(declaredLang, bodyHtml, lyricsLanguage);
  if (pipelineLang && isRubyToggleLang(pipelineLang)) {
    return true;
  }
  return isRubyToggleLang(lyricsLanguage) && bodyHtmlHasPosterRuby(bodyHtml);
}
