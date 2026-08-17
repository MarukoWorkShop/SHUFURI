import {
  extractStudyCardsFromRaw,
  rawLyricsHasStudyCardSections,
  type ExtractStudyCardsMeta,
} from './extractStudyCards';
import {
  countStudyCards,
  listStudyCards,
  migrateStudyCardsBundle,
  replaceStudyCardsForBundle,
} from '../services/studyCardsStore';

export function createStudyCardsBundleId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `session-${crypto.randomUUID()}`;
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export type SyncStudyCardsOptions = ExtractStudyCardsMeta & {
  rawLyrics: string;
  includeVocabAndGrammar?: boolean;
};

/** 热插拔入口：从结构化 raw 同步学习卡，失败静默不影响主流程 */
export async function trySyncStudyCardsFromRaw(options: SyncStudyCardsOptions): Promise<number> {
  try {
    if (!options.rawLyrics?.trim()) {
      console.warn('[study-cards] sync skipped: rawLyrics empty');
      return 0;
    }
    const hasSections = rawLyricsHasStudyCardSections(options.rawLyrics);
    // 设置关闭时仍允许：raw 已含 V|/G|（本轮已生成学习材料）则同步
    if (options.includeVocabAndGrammar === false && !hasSections) {
      console.warn('[study-cards] sync skipped: includeVocabAndGrammar disabled');
      return 0;
    }
    if (!hasSections) {
      console.warn('[study-cards] sync skipped: no V|/G| sections in rawLyrics');
      return 0;
    }

    const drafts = extractStudyCardsFromRaw(options.rawLyrics, {
      bundleId: options.bundleId,
      title: options.title,
      artist: options.artist,
      lang: options.lang,
    });
    if (!drafts.length) {
      console.warn('[study-cards] no drafts extracted (parse failure or empty terms)');
      return 0;
    }

    const { written, skipped } = await replaceStudyCardsForBundle(options.bundleId, drafts);
    if (written === 0 && skipped > 0) {
      console.warn(
        `[study-cards] ${skipped} duplicate draft(s) in batch; bundle=${options.bundleId}`,
      );
    }
    if (written > 0) {
      console.log(`[study-cards] synced ${written} card(s) to bundle=${options.bundleId}`);
    }
    return written;
  } catch (err) {
    console.warn('[study-cards] sync skipped:', err);
    return 0;
  }
}

export async function tryMigrateStudyCardsBundle(fromId: string, toId: string): Promise<number> {
  try {
    if (!fromId || !toId || fromId === toId) return 0;
    const all = await listStudyCards();
    const before = all.filter((c) => c.bundleId === fromId);
    if (!before.length) return 0;
    await migrateStudyCardsBundle(fromId, toId);
    return before.length;
  } catch (err) {
    console.warn('[study-cards] migrate skipped:', err);
    return 0;
  }
}

export async function getStudyCardsCount(): Promise<number> {
  try {
    return await countStudyCards();
  } catch {
    return 0;
  }
}

/** fire-and-forget，不阻塞主流程 */
export function scheduleStudyCardsSync(
  options: SyncStudyCardsOptions,
  onUpdated?: () => void,
): void {
  void trySyncStudyCardsFromRaw(options).then(() => {
    onUpdated?.();
  });
}

export { buildAnkiImportTsv } from './exportAnkiDeck';
export { shareAnkiDeckTsv } from './shareAnkiDeck';
