import type { LyricLine, ResolvedExample } from './types';

const LINE_INDEX_RE = /^\d+$/;

export function resolveExampleRef(
  refField: string,
  transField: string,
  lyrics: LyricLine[],
): ResolvedExample {
  const ref = refField.trim();
  if (LINE_INDEX_RE.test(ref)) {
    const index = Number.parseInt(ref, 10);
    const line = lyrics.find((l) => l.index === index);
    if (!line) {
      throw new Error(`例句行号 ${index} 无效（歌词中不存在该行）`);
    }
    return {
      primary: line.primary,
      translation: transField.trim() || line.gloss,
      cite: 'lyric',
      lyricIndex: index,
    };
  }
  return {
    primary: ref,
    translation: transField.trim(),
    cite: 'inline',
  };
}
