import { DEFAULT_ARTIST } from '../../utils/shufuriPoster/posterTitle';
import { getGlossSpec } from '../../services/languageMatrix/glossSpec';
import type { LearningTargetLanguage } from '../../services/languageMatrix/types';
import { buildEnEncoderPrompt } from './encoderEn';
import { buildJpEncoderPrompt } from './encoderJp';
import { buildKoEncoderPrompt } from './encoderKo';
import { buildZhEncoderPrompt } from './encoderZh';
import {
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
  buildPedagogicalExampleBlock,
  buildJpRubyBlock,
  buildZhRubyLyricsBlock,
  fillEncoderMeta,
  type EncoderPromptOptions,
} from './encoderCommon';

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
  const include = options.includeVocabAndGrammar;
  const iface = matrix.interfaceLanguage;

  let body: string;
  switch (lang) {
    case 'ko':
      body = buildKoEncoderPrompt(a, t, gloss, options);
      break;
    case 'en':
      body = buildEnEncoderPrompt(a, t, gloss, options);
      break;
    case 'zh':
      body = buildZhEncoderPrompt(a, t, gloss, options);
      break;
    default:
      body = buildJpEncoderPrompt(a, t, gloss, options);
  }

  body += buildSourceIntegrityBlock(a, t, options.ocrContext?.firstLyricLine);
  body += buildOcrHintBlock(options.ocrContext);
  body += buildWireSchema(include, iface, lang, gloss);
  body += buildStrictRaw(include);

  if (include) {
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
  body += buildStreamCloseBlock();
  body += buildSelfCheckBlock(lang, include);
  body += buildModelComplianceBlock(options.modelHint);

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
