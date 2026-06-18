import type { LangCode, LyricsLanguage } from '../../services/appSettings';

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
  // 英语正文复用 jp-line 且无 ruby；日语歌词通常带注音
  if (/\bjp-line\b/.test(html) && !/<ruby[\s>]/i.test(html)) {
    return 'en';
  }
  return undefined;
}

/** 编辑/预览统一解析排版管线 lang（声明 > HTML 推断 > 波轮） */
export function resolvePosterPipelineLang(
  declaredLang: LangCode | undefined,
  bodyHtml: string,
  lyricsLanguage: LyricsLanguage,
): LangCode | undefined {
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
