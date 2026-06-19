export type {
  InterfaceLanguage,
  LearningTargetLanguage,
  LanguageMatrix,
  LanguageMatrixContext,
  GlossLanguage,
} from './types';

export { resolveSystemInterfaceLanguage } from './resolveSystemLanguage';
export {
  WHEEL_TARGET_ORDER,
  getWheelLanguages,
  normalizeLearningTargetLanguages,
  normalizeActiveTarget,
} from './wheelLanguages';
export { getGlossSpec, type GlossSpec } from './glossSpec';
export { buildLearnerMatrixBlock } from './promptContext';

import type { AppSettings } from '../appSettings';
import type { LanguageMatrix, LanguageMatrixContext } from './types';

/** 从 AppSettings 提取语言矩阵（不含 activeTarget） */
export function matrixFromSettings(settings: AppSettings): LanguageMatrix {
  return {
    interfaceLanguage: settings.interfaceLanguage,
    learningTargetLanguages: settings.learningTargetLanguages,
  };
}

/** 构建完整 Prompt 上下文 */
export function buildLanguageMatrixContext(settings: AppSettings): LanguageMatrixContext {
  return {
    ...matrixFromSettings(settings),
    activeTarget: settings.lyricsLanguage,
  };
}
