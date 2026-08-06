import {
  countLyricsScriptSignals,
  detectLyricsLanguage,
  extractLyricSurfaceForDetect,
  resolveStudySourceLanguage,
  type DetectedLyricsLanguage,
  type LyricsScriptCounts,
} from './detectLyricsLanguage';
import { sampleVocabHeadwords } from './studyVocabSanity';

export type StudyLangProbePayload = {
  phase: 'pre-request' | 'post-response';
  wheel: string;
  interfaceLanguage: string;
  pedagogicalLevel?: string;
  /** 旧：整段确认流检测（对照用） */
  detectedRaw: DetectedLyricsLanguage;
  /** 新：仅 L col3 */
  detectedLyricsOnly: DetectedLyricsLanguage;
  detectMismatch: boolean;
  overrideApplied: boolean;
  effectiveSource: string;
  contentHashPrefix?: string;
  surfaceCharCount: number;
  countsRaw: LyricsScriptCounts;
  countsSurface: LyricsScriptCounts;
  fromCache?: boolean;
  vgSample?: string[];
  poisonRejected?: boolean;
};

const PROBE_FLAG_KEY = 'shufuri.studyLangProbe';

/** 默认开启；localStorage 设为 `0` 可关闭。 */
export function isStudyLangProbeEnabled(): boolean {
  try {
    return localStorage.getItem(PROBE_FLAG_KEY) !== '0';
  } catch {
    return true;
  }
}

export function buildStudyLangProbeBase(params: {
  confirmedLyrics: string;
  wheel: DetectedLyricsLanguage | string;
  interfaceLanguage: string;
  pedagogicalLevel?: string;
  overrideApplied: boolean;
  effectiveSource: string;
  contentHash?: string;
}): Omit<StudyLangProbePayload, 'phase' | 'fromCache' | 'vgSample' | 'poisonRejected'> {
  const surface = extractLyricSurfaceForDetect(params.confirmedLyrics);
  const detectedRaw = detectLyricsLanguage(params.confirmedLyrics);
  const resolved = resolveStudySourceLanguage(
    params.confirmedLyrics,
    params.wheel as DetectedLyricsLanguage,
  );
  return {
    wheel: params.wheel,
    interfaceLanguage: params.interfaceLanguage,
    pedagogicalLevel: params.pedagogicalLevel,
    detectedRaw,
    detectedLyricsOnly: resolved.detected,
    detectMismatch: detectedRaw !== resolved.detected,
    overrideApplied: params.overrideApplied,
    effectiveSource: params.effectiveSource,
    contentHashPrefix: params.contentHash?.slice(0, 8),
    surfaceCharCount: surface.length,
    countsRaw: countLyricsScriptSignals(params.confirmedLyrics),
    countsSurface: countLyricsScriptSignals(surface),
  };
}

export { sampleVocabHeadwords };

export function logStudyLangProbe(payload: StudyLangProbePayload): void {
  if (!isStudyLangProbeEnabled()) return;
  console.info('[study-lang-probe]', payload);
}
