import { studyCardDedupeKey } from '../studyCards/studyCardDedupeKey';
import type { CardOccurrence, StudyCard, StudyCardDraft } from '../studyCards/types';

/** occurrences 数组的最大长度（Rule of Three）。 */
const MAX_OCCURRENCES = 3;

/**
 * 单用户学习卡总库硬性上限（去重后）。
 * 超过后拒绝新增卡（合并已有卡仍允许，不增加总量），防止 IndexedDB / 列表渲染累积爆炸。
 */
export const MAX_TOTAL_STUDY_CARDS = 3000;

/**
 * 判定单次新增是否会突破单用户总库硬性上限。
 * @param existingCount 当前已去重卡数
 * @param additionalNewCount 本次将要新增的全新卡数（合并已有卡不计数）
 * 纯函数，便于 UI/测试复用。
 */
export function isWithinTotalLimit(existingCount: number, additionalNewCount = 0): boolean {
  return existingCount + additionalNewCount <= MAX_TOTAL_STUDY_CARDS;
}

/**
 * 评估总库上限拦截结果。纯函数，便于测试与 UI 提示复用。
 */
export function evaluateTotalLimit(existingCount: number, additionalNewCount = 0): { blocked: boolean; message?: string } {
  if (isWithinTotalLimit(existingCount, additionalNewCount)) return { blocked: false };
  return {
    blocked: true,
    message: `已达总库上限 ${MAX_TOTAL_STUDY_CARDS} 张，新的卡片将不再保存。请删除或归档部分卡片后继续。`,
  };
}

/**
 * 单次导出/打印的硬性上限：确保每次导出卡数始终 ≤ 999，避免 PDF 栅格化卡死。
 */
export const MAX_EXPORT_CARDS = 999;

/**
 * 判定单次导出是否被拦截：超过 MAX_EXPORT_CARDS 则拒绝，并给出提示文案。
 * 纯函数，便于 UI 复用与单元测试。
 */
export function evaluateBookExportCount(count: number): { blocked: boolean; message?: string } {
  if (count <= MAX_EXPORT_CARDS) return { blocked: false };
  return {
    blocked: true,
    message: `本次导出 ${count} 张，已超过上限 ${MAX_EXPORT_CARDS} 张。请先按语言或歌名筛选后再导出。`,
  };
}

/**
 * 从一条 StudyCardDraft（含其来源的歌曲信息/例句）构造一次"相遇"记录。
 * encounteredAt 取 draft 上携带的时间戳（extractStudyCards 注入），否则用当前时间。
 */
function buildOccurrenceFromDraft(draft: StudyCardDraft): CardOccurrence {
  return {
    songTitle: draft.songTitle,
    artist: draft.artist ?? '',
    lyricJaRaw: draft.lyricJaRaw ?? '',
    lyricZh: draft.lyricZh ?? '',
    encounteredAt:
      typeof draft.encounteredAt === 'number' ? draft.encounteredAt : Date.now(),
  };
}

/**
 * 纯函数：Rule of Three 智能合并。
 *
 * 当新 draft 的 dedupeKey 命中已存在的卡片时，不再"直接覆盖"记忆轨迹，
 * 而是保留初见、递增相遇次数、按 FIFO 维护最多 3 条代表性例句。
 *
 * 合并规则：
 *  - 保留旧卡的 id / createdAt。
 *  - encounterCount = (旧卡计数 ?? 1) + 1。
 *  - occurrences：
 *      · 旧卡无 occurrences → [旧卡初见出处(由自身字段构造), 新 occurrence]
 *      · 旧卡 < 3 条 → push 新 occurrence
 *      · 旧卡 == 3 条 → 保留 index0(初见)，index2 移到 index1，最新放 index2
 *
 * 不修改入参，返回新对象（纯函数式更新）。
 */
export function mergeStudyCardOccurrence(
  existing: StudyCard,
  draft: StudyCardDraft,
): StudyCard {
  const newOccurrence = buildOccurrenceFromDraft(draft);
  const prevCount = existing.encounterCount ?? 1;
  const nextCount = prevCount + 1;

  let nextOccurrences: CardOccurrence[];
  const prev = existing.occurrences;

  if (!prev || prev.length === 0) {
    // 老卡首次合并：用旧卡自身出处构造"初见"记录（index0），新相遇放 index1。
    const seed: CardOccurrence = {
      songTitle: existing.songTitle,
      artist: existing.artist ?? '',
      lyricJaRaw: existing.lyricJaRaw ?? '',
      lyricZh: existing.lyricZh ?? '',
      encounteredAt: existing.createdAt,
    };
    nextOccurrences = [seed, newOccurrence];
  } else if (prev.length < MAX_OCCURRENCES) {
    nextOccurrences = [...prev, newOccurrence];
  } else {
    // prev.length === 3：保留 index0，其余右移一格，最新落到 index2。
    nextOccurrences = [prev[0]!, prev[2]!, newOccurrence];
  }

  return {
    ...existing,
    ...draft,
    // 以下字段永远以"合并"结果为准，覆盖 draft 可能携带的（draft 不应带这些）。
    id: existing.id,
    createdAt: existing.createdAt,
    dedupeKey: existing.dedupeKey,
    encounterCount: nextCount,
    occurrences: nextOccurrences,
  };
}

const DB_NAME = 'japanese-kana-app-study-cards';
const DB_VERSION = 2;
const STORE_NAME = 'study-cards';

const studyCardsListeners = new Set<() => void>();

/** 学习卡库写入后订阅刷新（替代 refreshKey 透传） */
export function subscribeStudyCardsStore(listener: () => void): () => void {
  studyCardsListeners.add(listener);
  return () => studyCardsListeners.delete(listener);
}

function notifyStudyCardsStoreChanged(): void {
  for (const listener of studyCardsListeners) {
    listener();
  }
}

function createCardId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function ensureStudyCardIndexes(store: IDBObjectStore, options?: { dedupeUnique?: boolean }): void {
  if (!store.indexNames.contains('bundleId')) {
    store.createIndex('bundleId', 'bundleId', { unique: false });
  }
  if (!store.indexNames.contains('createdAt')) {
    store.createIndex('createdAt', 'createdAt', { unique: false });
  }
  if (!store.indexNames.contains('dedupeKey')) {
    store.createIndex('dedupeKey', 'dedupeKey', { unique: options?.dedupeUnique ?? true });
  }
}

function dedupeLegacyCards(cards: StudyCard[]): { survivors: StudyCard[]; deleteIds: string[] } {
  const survivorByKey = new Map<string, StudyCard>();
  const deleteIds: string[] = [];

  for (const card of cards) {
    const key = studyCardDedupeKey(card);
    const withKey = { ...card, dedupeKey: key };
    const existing = survivorByKey.get(key);
    if (!existing) {
      survivorByKey.set(key, withKey);
      continue;
    }
    if (card.createdAt < existing.createdAt) {
      deleteIds.push(existing.id);
      survivorByKey.set(key, withKey);
    } else {
      deleteIds.push(card.id);
    }
  }

  return { survivors: [...survivorByKey.values()], deleteIds };
}

function migrateLegacyCardsInUpgrade(
  store: IDBObjectStore,
  onDone: () => void,
  onError: (err: DOMException | null) => void,
): void {
  const getAllReq = store.getAll();
  getAllReq.onerror = () => onError(getAllReq.error);
  getAllReq.onsuccess = () => {
    const items = (getAllReq.result as StudyCard[]) ?? [];
    const { survivors, deleteIds } = dedupeLegacyCards(items);
    const deleteIdSet = new Set(deleteIds);
    let pending = survivors.length + deleteIdSet.size;

    const finishOne = () => {
      pending -= 1;
      if (pending === 0) onDone();
    };

    if (pending === 0) {
      onDone();
      return;
    }

    for (const card of survivors) {
      const putReq = store.put(card);
      putReq.onerror = () => onError(putReq.error);
      putReq.onsuccess = () => finishOne();
    }
    for (const id of deleteIdSet) {
      const delReq = store.delete(id);
      delReq.onerror = () => onError(delReq.error);
      delReq.onsuccess = () => finishOne();
    }
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('无法打开学习卡数据库'));
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const tx = event.target instanceof IDBOpenDBRequest ? event.target.transaction : null;
      if (!tx) {
        reject(new Error('学习卡数据库升级事务不可用'));
        return;
      }

      let store: IDBObjectStore;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        ensureStudyCardIndexes(store);
        return;
      }

      store = tx.objectStore(STORE_NAME);
      if (event.oldVersion < 2) {
        migrateLegacyCardsInUpgrade(
          store,
          () => ensureStudyCardIndexes(store, { dedupeUnique: true }),
          (err) => reject(err ?? new Error('学习卡去重迁移失败')),
        );
      } else {
        ensureStudyCardIndexes(store);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

export async function listStudyCards(): Promise<StudyCard[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onerror = () => reject(req.error ?? new Error('读取学习卡失败'));
    req.onsuccess = () => {
      const items = (req.result as StudyCard[]) ?? [];
      resolve(items.sort((a, b) => b.createdAt - a.createdAt));
    };
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('读取学习卡失败'));
    };
  });
}

export async function countStudyCards(): Promise<number> {
  const items = await listStudyCards();
  return items.length;
}

export type ReplaceStudyCardsResult = { written: number; skipped: number };

export async function replaceStudyCardsForBundle(
  bundleId: string,
  drafts: StudyCardDraft[],
): Promise<ReplaceStudyCardsResult> {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('bundleId');
    const cursorReq = index.openCursor(IDBKeyRange.only(bundleId));

    cursorReq.onerror = () => reject(cursorReq.error ?? new Error('清除旧学习卡失败'));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('清除旧学习卡失败'));
    };
  });

  if (!drafts.length) {
    notifyStudyCardsStoreChanged();
    return { written: 0, skipped: 0 };
  }

  const remaining = await listStudyCards();
  const cardByDedupeKey = new Map(
    remaining.map((card) => [card.dedupeKey, card]),
  );

  const seenKeys = new Set<string>();
  const upserts: StudyCard[] = [];
  let skipped = 0;
  const now = Date.now();

  for (const draft of drafts) {
    const dedupeKey = studyCardDedupeKey(draft);
    if (seenKeys.has(dedupeKey)) {
      skipped += 1;
      continue;
    }
    seenKeys.add(dedupeKey);

    const existing = cardByDedupeKey.get(dedupeKey);
    if (existing) {
      // Rule of Three 智能合并：保留初见轨迹，而非直接覆盖。
      upserts.push(mergeStudyCardOccurrence(existing, { ...draft, bundleId }));
    } else {
      // 总库硬性上限：达到上限后拒绝新增（合并不增总量，仍可继续）。
      if (evaluateTotalLimit(remaining.length, upserts.length).blocked) {
        skipped += 1;
        continue;
      }
      upserts.push({
        ...draft,
        id: createCardId(),
        createdAt: now,
        dedupeKey,
      });
    }
  }

  if (!upserts.length) {
    notifyStudyCardsStoreChanged();
    return { written: 0, skipped };
  }

  const db2 = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db2.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const card of upserts) {
      store.put(card);
    }
    tx.oncomplete = () => {
      db2.close();
      resolve();
    };
    tx.onerror = () => {
      db2.close();
      reject(tx.error ?? new Error('写入学习卡失败'));
    };
  });

  notifyStudyCardsStoreChanged();
  return { written: upserts.length, skipped };
}

/**
 * 全量备份导入：按 id upsert；若 dedupeKey 冲突则合并到已有卡（保留本地 id）。
 */
export async function upsertStudyCardsFromBackup(
  cards: StudyCard[],
): Promise<{ written: number; skipped: number }> {
  if (!cards.length) return { written: 0, skipped: 0 };

  const existing = await listStudyCards();
  const byId = new Map(existing.map((c) => [c.id, c]));
  const byDedupe = new Map(existing.map((c) => [c.dedupeKey, c]));

  const upserts: StudyCard[] = [];
  const seenKeys = new Set<string>();
  let skipped = 0;

  for (const incoming of cards) {
    const dedupeKey =
      typeof incoming.dedupeKey === 'string' && incoming.dedupeKey.trim()
        ? incoming.dedupeKey
        : studyCardDedupeKey(incoming);

    if (seenKeys.has(dedupeKey)) {
      skipped += 1;
      continue;
    }
    seenKeys.add(dedupeKey);

    const byExistingDedupe = byDedupe.get(dedupeKey);
    const byExistingId = byId.get(incoming.id);

    if (byExistingDedupe) {
      // 备份导入也走智能合并：保留本地初见轨迹，叠加备份里的相遇记录。
      const merged = mergeStudyCardOccurrence(byExistingDedupe, incoming);
      upserts.push({
        ...merged,
        // 导入时若备份记录的创建更早，保留更早的 createdAt（不覆盖初见时刻）。
        createdAt: Math.min(byExistingDedupe.createdAt, incoming.createdAt || Date.now()),
      });
    } else if (byExistingId) {
      upserts.push({
        ...byExistingId,
        ...incoming,
        id: byExistingId.id,
        dedupeKey,
      });
    } else {
      // 总库硬性上限：全新卡达到上限后拒绝导入（合并/按 id 更新不增总量，仍可继续）。
      if (evaluateTotalLimit(existing.length, upserts.length).blocked) {
        skipped += 1;
        continue;
      }
      upserts.push({
        ...incoming,
        id: incoming.id || createCardId(),
        dedupeKey,
        createdAt: incoming.createdAt || Date.now(),
      });
    }
  }

  if (!upserts.length) return { written: 0, skipped };

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const card of upserts) {
      store.put(card);
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('导入学习卡失败'));
    };
  });

  notifyStudyCardsStoreChanged();
  return { written: upserts.length, skipped };
}

/**
 * 单卡 upsert（不清除同 bundle 其它卡）：按 dedupeKey 合并或新建。
 */
export async function upsertStudyCardDraft(
  draft: StudyCardDraft,
): Promise<{ written: boolean; skipped: boolean; id?: string }> {
  const dedupeKey = studyCardDedupeKey(draft);
  const existing = await listStudyCards();
  const same = existing.find((c) => c.dedupeKey === dedupeKey);

  // 总库硬性上限：全新卡达到上限后拒绝新增。
  if (!same && evaluateTotalLimit(existing.length).blocked) {
    console.warn(
      `[studyCardsStore] 学习卡已达总库上限 ${MAX_TOTAL_STUDY_CARDS} 张，新卡片「${dedupeKey}」未保存`,
    );
    return { written: false, skipped: true };
  }

  const card: StudyCard = same
    ? mergeStudyCardOccurrence(same, draft)
    : {
        ...draft,
        id: createCardId(),
        createdAt: Date.now(),
        dedupeKey,
      };

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(card);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('写入学习卡失败'));
    };
  });

  notifyStudyCardsStoreChanged();
  return { written: true, skipped: false, id: card.id };
}

export async function deleteStudyCard(id: string): Promise<void> {
  await deleteStudyCards([id]);
}

export async function deleteStudyCards(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const id of ids) {
      store.delete(id);
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('删除学习卡失败'));
    };
  });
  notifyStudyCardsStoreChanged();
}

export async function migrateStudyCardsBundle(fromId: string, toId: string): Promise<void> {
  const items = await listStudyCards();
  const toMigrate = items.filter((item) => item.bundleId === fromId);
  if (!toMigrate.length) return;

  const drafts: StudyCardDraft[] = toMigrate.map(
    ({ bundleId: _b, id: _id, createdAt: _c, dedupeKey: _d, ...rest }) => ({
      ...rest,
      bundleId: toId,
    }),
  );
  // 注意：rest 已包含 occurrences / encounterCount（仅排除了 id/createdAt/dedupeKey），
  // 因此迁移不会丢弃记忆轨迹。StudyCardDraft = Omit<StudyCard,'id'|'createdAt'|'dedupeKey'>，
  // 这两个可选字段本就在 Draft 允许范围内。

  if (fromId.startsWith('session-')) {
    await replaceStudyCardsForBundle(fromId, []);
  }

  await replaceStudyCardsForBundle(toId, drafts);
}
