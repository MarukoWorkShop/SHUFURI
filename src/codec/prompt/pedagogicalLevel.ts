import type { LangCode } from '../../services/appSettings';
import {
  PEDAGOGICAL_LEVEL_MATRIX,
  resolvePedagogicalLevel,
  type PedagogicalLevel,
} from '../../services/pedagogicalLevel';

export function buildPedagogicalLevelBlock(
  lang: LangCode,
  level?: PedagogicalLevel,
): string {
  const resolved = resolvePedagogicalLevel(level);
  const spec = PEDAGOGICAL_LEVEL_MATRIX[lang][resolved];
  return `
[Pedagogical_Level]
Level: ${resolved}
Framework: ${spec.framework}
Vocab_scope: ${spec.vocab}
Grammar_scope: ${spec.grammar}
Counts: ${spec.counts}
Example_style: ${spec.exampleStyle}
Avoid: ${spec.avoid}
Rule: Pick V/G ONLY from words/patterns appearing in official lyrics at this level; if the song is harder overall, choose the simplest still-authentic teachable items — do NOT invent easier words absent from the song.
Note: [Sample] V/G rows show wire format only — counts and difficulty follow this block, not the sample.`;
}
