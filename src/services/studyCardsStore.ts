import {
  filterStudyCardDraftsForInsert,
  studyCardDedupeKey,
} from '../studyCards/studyCardDedupeKey';
import type { StudyCard, StudyCardDraft } from '../studyCards/types';

const DB_NAME = 'japanese-kana-app-study-cards';
const DB_VERSION = 2;
const STORE_NAME = 'study-cards';

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

async function readExistingDedupeKeys(db: IDBDatabase): Promise<Set<string>> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    if (!store.indexNames.contains('dedupeKey')) {
      resolve(new Set());
      return;
    }
    const index = store.index('dedupeKey');
    const req = index.getAllKeys();
    req.onerror = () => reject(req.error ?? new Error('读取学习卡去重键失败'));
    req.onsuccess = () => {
      const keys = (req.result ?? []).map((k) => String(k));
      resolve(new Set(keys));
    };
    tx.onerror = () => reject(tx.error ?? new Error('读取学习卡去重键失败'));
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
    return { written: 0, skipped: 0 };
  }

  const db2 = await openDb();
  const existingKeys = await readExistingDedupeKeys(db2);
  const { toWrite, skipped } = filterStudyCardDraftsForInsert(drafts, existingKeys);
  if (!toWrite.length) {
    db2.close();
    return { written: 0, skipped };
  }

  const now = Date.now();
  await new Promise<void>((resolve, reject) => {
    const tx = db2.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const draft of toWrite) {
      store.put({
        ...draft,
        id: createCardId(),
        createdAt: now,
      } satisfies StudyCard);
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

  return { written: toWrite.length, skipped };
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

  await replaceStudyCardsForBundle(toId, drafts);
  if (fromId.startsWith('session-')) {
    await replaceStudyCardsForBundle(fromId, []);
  }
}
