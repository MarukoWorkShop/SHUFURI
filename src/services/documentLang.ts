import type { LangCode, LyricsLanguage } from './appSettings';
import { resolvePosterPipelineLang } from '../utils/shufuriPoster/inferPosterLang';

/** 歌曲正文语言（记录流 H 行、项目元数据或 HTML 推断） */
export type DocumentLang = LangCode;

/** 首页学习目标拨轮（设置项，不等于正文语言） */
export type LearningTarget = LyricsLanguage;

/**
 * 解析当前文档内容语言（声明 > HTML 推断 > 拨轮兜底）。
 * 排版、注音开关、词卡 lang 应优先使用此结果，而非仅读拨轮。
 */
export function resolveDocumentLang(
  declaredLang: DocumentLang | undefined,
  bodyHtml: string,
  learningTarget: LearningTarget,
): DocumentLang | undefined {
  return resolvePosterPipelineLang(declaredLang, bodyHtml, learningTarget);
}
