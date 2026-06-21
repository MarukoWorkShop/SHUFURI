import {
  extractStudyCardsFromRaw,
  rawLyricsHasStudyCardSections,
  type ExtractStudyCardsMeta,
} from './extractStudyCards';
import {
  countStudyCards,
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
    if (options.includeVocabAndGrammar === false) return 0;
    if (!options.rawLyrics?.trim()) return 0;
    if (!rawLyricsHasStudyCardSections(options.rawLyrics)) return 0;

    const drafts = extractStudyCardsFromRaw(options.rawLyrics, {
      bundleId: options.bundleId,
      title: options.title,
      artist: options.artist,
      lang: options.lang,
    });
    if (!drafts.length) {
      console.warn('[study-cards] no drafts extracted (empty terms or parse failure)');
      return 0;
    }

    const { written, skipped } = await replaceStudyCardsForBundle(options.bundleId, drafts);
    if (written === 0 && skipped > 0) {
      console.warn(
        `[study-cards] ${skipped} card(s) skipped by global dedupe; bundle=${options.bundleId}`,
      );
    }
    return written;
  } catch (err) {
    console.warn('[study-cards] sync skipped:', err);
    return 0;
  }
}

export async function tryMigrateStudyCardsBundle(fromId: string, toId: string): Promise<void> {
  try {
    if (!fromId || !toId || fromId === toId) return;
    await migrateStudyCardsBundle(fromId, toId);
  } catch (err) {
    console.warn('[study-cards] migrate skipped:', err);
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
