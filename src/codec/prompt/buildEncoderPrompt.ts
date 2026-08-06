import { DEFAULT_ARTIST } from '../../utils/shufuriPoster/posterTitle';
import { getGlossSpec } from '../../services/languageMatrix/glossSpec';
import type { LearningTargetLanguage } from '../../services/languageMatrix/types';
import { buildEnEncoderPrompt } from './encoderEn';
import { buildJpEncoderPrompt } from './encoderJp';
import { buildKoEncoderPrompt } from './encoderKo';
import { buildZhEncoderPrompt } from './encoderZh';
import {
  buildConfirmedLyricsBlock,
  buildFullSampleBlock,
  buildHeaderLyricsSeparationBlock,
  buildModelComplianceBlock,
  buildOcrHintBlock,
  buildSelfCheckBlock,
  buildSourceIntegrityBlock,
  buildStreamCloseBlock,
  buildStrictRaw,
  buildWireSchema,
  buildZhColumnMapBlock,
  buildZhGrammarLabelBlock,
  buildStudyCardsCitationBlock,
  buildStudyHeadwordScriptBlock,
  buildPedagogicalExampleBlock,
  buildJpRubyBlock,
  buildZhRubyLyricsBlock,
  fillEncoderMeta,
  stripLyricTranslationColumn,
  type EncoderPromptOptions,
} from './encoderCommon';
import { buildPedagogicalLevelBlock } from './pedagogicalLevel';
import { resolvePedagogicalLevel } from '../../services/pedagogicalLevel';

export type { EncoderPromptOptions };

export type EncoderTargetLanguage = LearningTargetLanguage;

export function buildEncoderPrompt(
  artist: string,
  title: string,
  options: EncoderPromptOptions,
): string {
  const t = title.trim().replace(/^《|》$/g, '');
  if (!t) {
    throw new Error('Title is required for external AI lyric lookup');
  }
  const a = artist.trim() || DEFAULT_ARTIST;
  const matrix = options.matrix;
  const lang = matrix.activeTarget;
  if (lang !== 'jp' && lang !== 'ko' && lang !== 'en' && lang !== 'zh') {
    throw new Error(`Invalid target language: ${String(lang)}`);
  }

  const gloss = getGlossSpec(matrix.interfaceLanguage);
  const phase = options.phase ?? 'full';

  if (phase === 'study') {
    return buildStudyMaterialsPrompt(a, t, options);
  }

  // 第一步（lyrics）强制仅输出 H+L；'full' 沿用原设置（保持既有行为/测试）。
  const include = phase === 'lyrics' ? false : options.includeVocabAndGrammar;
  const pedagogicalLevel = include ? resolvePedagogicalLevel(options.pedagogicalLevel) : undefined;
  const iface = matrix.interfaceLanguage;
  const bodyOptions: EncoderPromptOptions = { ...options, includeVocabAndGrammar: include };

  let body: string;
  switch (lang) {
    case 'ko':
      body = buildKoEncoderPrompt(a, t, gloss, bodyOptions);
      break;
    case 'en':
      body = buildEnEncoderPrompt(a, t, gloss, bodyOptions);
      break;
    case 'zh':
      body = buildZhEncoderPrompt(a, t, gloss, bodyOptions);
      break;
    default:
      body = buildJpEncoderPrompt(a, t, gloss, bodyOptions);
  }

  body += buildSourceIntegrityBlock(
    a,
    t,
    options.ocrContext?.firstLyricLine,
    phase === 'lyrics'
      ? { completeness: true, retry: options.retry, retryReason: options.retryReason }
      : undefined,
  );
  body += buildOcrHintBlock(options.ocrContext);
  body += buildWireSchema(include, iface, lang, gloss);
  body += buildStrictRaw(include);

  if (include) {
    body += buildPedagogicalLevelBlock(lang, pedagogicalLevel);
    body += buildStudyCardsCitationBlock();
    body += buildPedagogicalExampleBlock(lang);
  }

  if (lang === 'jp') {
    body += buildJpRubyBlock(include);
  }

  if (lang === 'zh') {
    body += buildZhColumnMapBlock(include);
    body += buildZhRubyLyricsBlock();
    body += buildZhGrammarLabelBlock(iface);
  }

  body += buildFullSampleBlock(lang, include, iface);
  body += buildHeaderLyricsSeparationBlock(a, t);
  body += buildStreamCloseBlock(phase === 'lyrics' ? { lyricsOnly: true } : undefined);
  body += buildSelfCheckBlock(lang, include, pedagogicalLevel, iface);
  body += buildModelComplianceBlock(options.modelHint, iface);

  return fillEncoderMeta(body, a, t);
}

/**
 * 第二步：基于已确认歌词补 V/G 学习材料。
 * 强制回显 H+L、禁止改动歌词，只新增 @1/@2 词汇语法。
 */
function buildStudyMaterialsPrompt(
  a: string,
  t: string,
  options: EncoderPromptOptions,
): string {
  const matrix = options.matrix;
  const lang = matrix.activeTarget as EncoderTargetLanguage;
  const iface = matrix.interfaceLanguage;
  const gloss = getGlossSpec(iface);
  const pedagogicalLevel = resolvePedagogicalLevel(options.pedagogicalLevel);
  const confirmed = options.confirmedLyrics?.trim() ?? '';

  const bodyOptions: EncoderPromptOptions = { ...options, includeVocabAndGrammar: true };
  let body: string;
  switch (lang) {
    case 'ko':
      body = buildKoEncoderPrompt(a, t, gloss, bodyOptions);
      break;
    case 'en':
      body = buildEnEncoderPrompt(a, t, gloss, bodyOptions);
      break;
    case 'zh':
      body = buildZhEncoderPrompt(a, t, gloss, bodyOptions);
      break;
    default:
      body = buildJpEncoderPrompt(a, t, gloss, bodyOptions);
  }

  // 非中文源语：Confirmed 块去掉 L col4，避免模型从译文挖中文词头
  const confirmedForStudy =
    lang === 'zh' ? confirmed : stripLyricTranslationColumn(confirmed);

  body += buildConfirmedLyricsBlock(confirmedForStudy);
  body += buildStudyHeadwordScriptBlock(lang);
  body += buildWireSchema(true, iface, lang, gloss);
  body += buildStrictRaw(true);
  body += buildPedagogicalLevelBlock(lang, pedagogicalLevel);
  body += buildStudyCardsCitationBlock();
  body += buildPedagogicalExampleBlock(lang);

  if (lang === 'jp') {
    body += buildJpRubyBlock(true);
  }
  if (lang === 'zh') {
    body += buildZhColumnMapBlock(true);
    body += buildZhRubyLyricsBlock();
    body += buildZhGrammarLabelBlock(iface);
  }

  body += buildFullSampleBlock(lang, true, iface);
  body += buildStreamCloseBlock({ requireStudySections: true });
  body += buildSelfCheckBlock(lang, true, pedagogicalLevel, iface);
  body += buildModelComplianceBlock(options.modelHint, iface);

  return fillEncoderMeta(body, a, t);
}

export function resolveEncoderModelHint(appId: string): EncoderPromptOptions['modelHint'] {
  if (appId === 'tongyi' || appId === 'wenxin') return 'qwen';
  if (appId === 'doubao') return 'doubao';
  if (appId === 'deepseek') return 'deepseek';
  return 'default';
}

/** @deprecated 使用 buildEncoderPrompt */
export const buildExternalAiPrompt = buildEncoderPrompt;
