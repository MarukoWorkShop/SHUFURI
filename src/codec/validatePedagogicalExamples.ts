import type { StreamDocument } from './types';

const CODEC_RUBY_RE = /\{([^:\\{}]+)[:|]([^\\{}]+)\}/g;

/** Remove ruby markup; keep base characters for lyric/example comparison. */
export function stripRubyPlain(text: string): string {
  return text.replace(CODEC_RUBY_RE, '$1');
}

export function warnPedagogicalLyricCopies(doc: StreamDocument): void {
  const lyricPlain = doc.lyrics
    .map((line) => stripRubyPlain(line.primary).trim())
    .filter((line) => line.length > 0);

  for (const row of [...doc.vocab, ...doc.grammar]) {
    const example = stripRubyPlain(row.pedagogicalExample).trim();
    if (!example) continue;

    for (const lyric of lyricPlain) {
      if (example === lyric) {
        console.warn(
          `[codec] pedagogical_example copies L lyric (seq ${row.seq}):`,
          example.slice(0, 80),
        );
        break;
      }
      if (example.length > 3 && lyric.includes(example)) {
        console.warn(
          `[codec] pedagogical_example is a lyric fragment (seq ${row.seq}):`,
          example.slice(0, 80),
        );
        break;
      }
    }
  }
}
