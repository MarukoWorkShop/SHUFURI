import type { LyricsLanguage } from '../../services/appSettings';
import type { LanguageMatrixContext } from '../../services/languageMatrix/types';
import type { OcrDetectedLanguage } from '../../services/ocrTypes';
import { buildEncoderPrompt } from './buildEncoderPrompt';
import type { EncoderPromptOptions } from './encoderCommon';

export type LyricsStep1PromptParams = {
  artist: string;
  title: string;
  matrix: LanguageMatrixContext;
  language?: LyricsLanguage;
  ocrDetectedLanguage?: OcrDetectedLanguage;
  ocrContext?: EncoderPromptOptions['ocrContext'];
  retry?: boolean;
  modelHint?: EncoderPromptOptions['modelHint'];
};

/** 与 HtmlPasteInput 手动 Step1 一致的目标语言解析（拨轮 > OCR > matrix） */
export function resolveLyricsStep1Target(
  language: LyricsLanguage | undefined,
  matrix: LanguageMatrixContext,
  ocrDetectedLanguage?: OcrDetectedLanguage,
): LyricsLanguage {
  return (
    language ??
    (ocrDetectedLanguage === 'ko'
      ? 'ko'
      : ocrDetectedLanguage === 'jp'
        ? 'jp'
        : ocrDetectedLanguage === 'zh'
          ? 'zh'
          : matrix.activeTarget)
  );
}

function resolveOcrContext(
  ocrContext: EncoderPromptOptions['ocrContext'] | undefined,
  ocrDetectedLanguage: OcrDetectedLanguage | undefined,
): EncoderPromptOptions['ocrContext'] | undefined {
  if (ocrContext) return ocrContext;
  if (ocrDetectedLanguage) return { detectedLanguage: ocrDetectedLanguage };
  return undefined;
}

export function buildLyricsStep1EncoderOptions(
  params: LyricsStep1PromptParams,
): EncoderPromptOptions {
  const effectiveTarget = resolveLyricsStep1Target(
    params.language,
    params.matrix,
    params.ocrDetectedLanguage,
  );

  return {
    includeVocabAndGrammar: false,
    matrix: { ...params.matrix, activeTarget: effectiveTarget },
    modelHint: params.modelHint,
    phase: 'lyrics',
    retry: params.retry,
    ocrContext: resolveOcrContext(params.ocrContext, params.ocrDetectedLanguage),
  };
}

/** Step1 歌词口令：手动模式与 AI 模式共用同一构建逻辑 */
export function buildLyricsStep1Prompt(params: LyricsStep1PromptParams): string {
  const promptArtist = params.artist.trim() || '佚名';
  return buildEncoderPrompt(
    promptArtist,
    params.title,
    buildLyricsStep1EncoderOptions(params),
  );
}
