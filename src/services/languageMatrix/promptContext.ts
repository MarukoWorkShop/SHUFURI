import type { LanguageMatrixContext } from './types';
import { getGlossSpec } from './glossSpec';

export function buildLearnerMatrixBlock(ctx: LanguageMatrixContext): string {
  const gloss = getGlossSpec(ctx.interfaceLanguage);
  const allowed = ctx.learningTargetLanguages.join(', ');
  const pedagogicalRule =
    ctx.interfaceLanguage === 'zh'
      ? `MEANING, DETAIL, ZH, EX_ZH, and grammar-title gloss inside （） MUST be ${gloss.label} for native Chinese learners.`
      : `MEANING, DETAIL, ZH, EX_ZH MUST be ${gloss.label}. Grammar TITLE format: [original] ([English gloss]). NO Chinese in pedagogical fields.`;

  return `
[Learner_Matrix]
Interface_Language: ${ctx.interfaceLanguage}
Gloss_Language: ${ctx.interfaceLanguage}
Pedagogical_Rule: ${pedagogicalRule}
Allowed_Target_Languages: ${allowed}
Active_Target: ${ctx.activeTarget}
Disambiguation: Fetch lyrics ONLY in languages from Allowed_Target_Languages. If the song's original language is outside this set, do NOT substitute another language's lyrics.
Field_Names: Keep output tags ZH:, MEANING:, DETAIL:, EX_ZH: unchanged — only the text content follows Gloss_Language.`;
}
