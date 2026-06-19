import type { LangCode } from '../services/appSettings';
import { normalizeRubyMarkupText } from '../utils/rubyMarkup';
import type { StudyCardDraft, StudyCardKind } from './types';

const GRAMMAR_TITLE_SPLIT_RE = /^(.+?)\s*[（(]([^）)]+)[）)]\s*$/;

function grammarOrig(label: string): string {
  const trimmed = label.trim();
  const m = trimmed.match(GRAMMAR_TITLE_SPLIT_RE);
  return (m?.[1] ?? trimmed).trim();
}

function normalizeCanonicalTerm(term: string, lang: LangCode): string {
  let t = term.trim();
  if (lang === 'jp' || lang === 'zh') {
    t = normalizeRubyMarkupText(t);
  }
  return t.normalize('NFC');
}

/** 词汇用 sourceRaw；语法用括号前的原形（不含括注） */
export function studyCardCanonicalTerm(
  kind: StudyCardKind,
  sourceRaw: string,
  lang: LangCode,
): string {
  const raw = kind === 'grammar' ? grammarOrig(sourceRaw) : sourceRaw;
  return normalizeCanonicalTerm(raw, lang);
}

export function studyCardDedupeKey(
  draft: Pick<StudyCardDraft, 'lang' | 'kind' | 'sourceRaw'>,
): string {
  const canonical = studyCardCanonicalTerm(draft.kind, draft.sourceRaw, draft.lang);
  return `${draft.lang}|${draft.kind}|${canonical}`;
}

export type StudyCardDraftWithDedupeKey = StudyCardDraft & { dedupeKey: string };

/** 全局去重：已存在同 dedupeKey 的 draft 跳过；同批内也仅保留首张 */
export function filterStudyCardDraftsForInsert(
  drafts: StudyCardDraft[],
  existingKeys: ReadonlySet<string>,
): { toWrite: StudyCardDraftWithDedupeKey[]; skipped: number } {
  const seen = new Set(existingKeys);
  const toWrite: StudyCardDraftWithDedupeKey[] = [];
  let skipped = 0;

  for (const draft of drafts) {
    const dedupeKey = studyCardDedupeKey(draft);
    if (seen.has(dedupeKey)) {
      skipped += 1;
      continue;
    }
    seen.add(dedupeKey);
    toWrite.push({ ...draft, dedupeKey });
  }

  return { toWrite, skipped };
}
