import type { StudyCard, StudyCardDraft } from '../studyCards/types';

const DB_NAME = 'japanese-kana-app-study-cards';
const DB_VERSION = 1;
const STORE_NAME = 'study-cards';

function createCardId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('无法打开学习卡数据库'));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('bundleId', 'bundleId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
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

export async function replaceStudyCardsForBundle(bundleId: string, drafts: StudyCardDraft[]): Promise<void> {
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

  if (!drafts.length) return;

  const db2 = await openDb();
  const now = Date.now();
  await new Promise<void>((resolve, reject) => {
    const tx = db2.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const draft of drafts) {
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

  const drafts: StudyCardDraft[] = toMigrate.map(({ bundleId: _b, id: _id, createdAt: _c, ...rest }) => ({
    ...rest,
    bundleId: toId,
  }));

  await replaceStudyCardsForBundle(toId, drafts);
  if (fromId.startsWith('session-')) {
    await replaceStudyCardsForBundle(fromId, []);
  }
}
