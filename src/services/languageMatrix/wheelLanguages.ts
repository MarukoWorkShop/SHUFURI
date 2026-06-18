import type { LyricsLanguage } from '../appSettings';
import type { LearningTargetLanguage } from './types';

export const WHEEL_TARGET_ORDER: readonly LearningTargetLanguage[] = ['jp', 'ko', 'en', 'zh'];

const ALL_TARGETS: LearningTargetLanguage[] = ['jp', 'ko', 'en', 'zh'];

/** 已选学习目标语言（拨轮顺序） */
export function getWheelLanguages(targets: LearningTargetLanguage[]): LyricsLanguage[] {
  const picked = WHEEL_TARGET_ORDER.filter((t) => targets.includes(t));
  return picked.length ? picked : (['jp'] as LearningTargetLanguage[]);
}

export function normalizeLearningTargetLanguages(
  targets: unknown,
): LearningTargetLanguage[] {
  if (!Array.isArray(targets)) return [...ALL_TARGETS];
  const valid = targets.filter(
    (t): t is LearningTargetLanguage =>
      t === 'jp' || t === 'ko' || t === 'en' || t === 'zh',
  );
  return valid.length ? valid : ['jp'];
}

/** 若当前拨轮值不在允许集合内，重置为首个已选语言 */
export function normalizeActiveTarget(
  activeTarget: LyricsLanguage | 'auto',
  targets: LearningTargetLanguage[],
): LyricsLanguage {
  const allowed = getWheelLanguages(targets);
  if (activeTarget !== 'auto' && allowed.includes(activeTarget as LyricsLanguage)) {
    return activeTarget as LyricsLanguage;
  }
  return allowed[0] ?? 'jp';
}
