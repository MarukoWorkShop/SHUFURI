import { DEFAULT_ARTIST } from '../../utils/shufuriPoster/posterTitle';
import { getGlossSpec } from '../../services/languageMatrix/glossSpec';
import type { LearningTargetLanguage } from '../../services/languageMatrix/types';
import { buildEnEncoderPrompt } from './encoderEn';
import { buildJpEncoderPrompt } from './encoderJp';
import { buildKoEncoderPrompt } from './encoderKo';
import { buildZhEncoderPrompt } from './encoderZh';
import { buildOcrHintBlock, fillEncoderMeta, type EncoderPromptOptions } from './encoderCommon';

export type { EncoderPromptOptions };

export type EncoderTargetLanguage = LearningTargetLanguage;

export function buildEncoderPrompt(
  artist: string,
  title: string,
  options: EncoderPromptOptions,
): string {
  const t = title.trim().replace(/^《|》$/g, '');
  if (!t) {
    throw new Error('歌名为必填项，外部 AI 需要歌名才能查找歌词');
  }
  const a = artist.trim() || DEFAULT_ARTIST;
  const matrix = options.matrix;
  const lang = matrix.activeTarget;
  if (lang !== 'jp' && lang !== 'ko' && lang !== 'en' && lang !== 'zh') {
    throw new Error(`无效的目标语言：${String(lang)}`);
  }

  const gloss = getGlossSpec(matrix.interfaceLanguage);
  const ocr = buildOcrHintBlock(options.ocrContext);

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

  return fillEncoderMeta(body + ocr, a, t);
}

/** @deprecated 使用 buildEncoderPrompt */
export const buildExternalAiPrompt = buildEncoderPrompt;
