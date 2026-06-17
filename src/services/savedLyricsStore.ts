import type { PosterLayoutProfile } from '../utils/furiganaLayout/types';
import { extractArtistFromLyricsRaw } from './lyricsHtml';

const DB_NAME = 'japanese-kana-app';
const DB_VERSION = 1;
const STORE_NAME = 'saved-lyrics';

function createProjectId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export type SavedLyricsProject = {
  id: string;
  title: string;
  artist?: string;
  rawLyrics: string;
  bodyHtml: string;
  pageHtmls: string[];
  layoutProfile: PosterLayoutProfile;
  includeVocabAndGrammar?: boolean;
  /** 排版管线语言（大模型声明 / 自动检测） */
  lang?: import('./appSettings').LangCode;
  savedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('无法打开本地数据库'));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('savedAt', 'savedAt', { unique: false });
        store.createIndex('title', 'title', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const req = fn(store);
        req.onerror = () => reject(req.error ?? new Error('数据库操作失败'));
        req.onsuccess = () => resolve(req.result);
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('数据库事务失败'));
        };
      }),
  );
}

export async function listSavedLyricsProjects(): Promise<SavedLyricsProject[]> {
  const items = await runTransaction<SavedLyricsProject[]>('readonly', (store) => store.getAll());
  return items
    .map((item) => ({
      ...item,
      artist: item.artist?.trim() || extractArtistFromLyricsRaw(item.rawLyrics) || undefined,
      includeVocabAndGrammar: item.includeVocabAndGrammar ?? true,
    }))
    .sort((a, b) => b.savedAt - a.savedAt);
}

export async function getSavedLyricsProject(id: string): Promise<SavedLyricsProject | null> {
  const item = await runTransaction<SavedLyricsProject | undefined>('readonly', (store) =>
    store.get(id),
  );
  if (!item) return null;
  return {
    ...item,
    artist: item.artist?.trim() || extractArtistFromLyricsRaw(item.rawLyrics) || undefined,
    includeVocabAndGrammar: item.includeVocabAndGrammar ?? true,
  };
}

export async function saveLyricsProject(
  project: Omit<SavedLyricsProject, 'id' | 'savedAt'> & { id?: string; savedAt?: number },
): Promise<SavedLyricsProject> {
  const record: SavedLyricsProject = {
    id: project.id ?? createProjectId(),
    title: project.title.trim() || '歌词笔记',
    artist:
      project.artist?.trim() ||
      extractArtistFromLyricsRaw(project.rawLyrics) ||
      undefined,
    rawLyrics: project.rawLyrics,
    bodyHtml: project.bodyHtml,
    pageHtmls: project.pageHtmls,
    layoutProfile: project.layoutProfile,
    ...(project.includeVocabAndGrammar !== undefined
      ? { includeVocabAndGrammar: project.includeVocabAndGrammar }
      : {}),
    savedAt: project.savedAt ?? Date.now(),
  };
  await runTransaction('readwrite', (store) => store.put(record));
  return record;
}

export async function deleteSavedLyricsProject(id: string): Promise<void> {
  await runTransaction('readwrite', (store) => store.delete(id));
}

function sanitizeDirName(name: string): string {
  return name.replace(/[/\\?*:|"<>]/g, '_').trim().slice(0, 80) || '歌词笔记';
}

/** 将项目写入用户选择的本地文件夹（File System Access API） */
export async function writeProjectToUserFolder(project: SavedLyricsProject): Promise<void> {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('当前浏览器不支持选择文件夹保存，已保存到「我的歌词库」');
  }

  const root = await window.showDirectoryPicker({ mode: 'readwrite' });
  const folderName = sanitizeDirName(project.title);
  const songDir = await root.getDirectoryHandle(folderName, { create: true });

  const metadata = {
    id: project.id,
    title: project.title,
    layoutProfile: project.layoutProfile,
    savedAt: project.savedAt,
    pageCount: project.pageHtmls.length,
    includeVocabAndGrammar: project.includeVocabAndGrammar,
  };

  const metaHandle = await songDir.getFileHandle('metadata.json', { create: true });
  const metaWritable = await metaHandle.createWritable();
  await metaWritable.write(JSON.stringify(metadata, null, 2));
  await metaWritable.close();

  const bodyHandle = await songDir.getFileHandle('body.html', { create: true });
  const bodyWritable = await bodyHandle.createWritable();
  await bodyWritable.write(project.bodyHtml);
  await bodyWritable.close();

  const lyricsHandle = await songDir.getFileHandle('lyrics.txt', { create: true });
  const lyricsWritable = await lyricsHandle.createWritable();
  await lyricsWritable.write(project.rawLyrics);
  await lyricsWritable.close();

  const pagesDir = await songDir.getDirectoryHandle('pages', { create: true });
  for (let i = 0; i < project.pageHtmls.length; i++) {
    const pageHandle = await pagesDir.getFileHandle(
      `page-${String(i + 1).padStart(2, '0')}.html`,
      { create: true },
    );
    const pageWritable = await pageHandle.createWritable();
    await pageWritable.write(project.pageHtmls[i] ?? '');
    await pageWritable.close();
  }
}
