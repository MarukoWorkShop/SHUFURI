import { isNativeWebView, shareTextFile } from '../utils/nativeBridge';
import {
  listSavedLyricsProjects,
  upsertSavedLyricsProjects,
  type SavedLyricsProject,
} from './savedLyricsStore';
import {
  listStudyCards,
  upsertStudyCardsFromBackup,
} from './studyCardsStore';
import type { StudyCard } from '../studyCards/types';
import type { PosterLayoutProfile } from '../utils/shufuriPoster/types';
import type { LangCode } from './appSettings';
import type { PedagogicalLevel } from './pedagogicalLevel';

export const LIBRARY_BACKUP_FORMAT = 'shufuri-library-backup';
export const LIBRARY_BACKUP_VERSION = 1;

export type LibraryBackupPayload = {
  format: typeof LIBRARY_BACKUP_FORMAT;
  version: typeof LIBRARY_BACKUP_VERSION;
  exportedAt: number;
  lyricsProjects: SavedLyricsProject[];
  studyCards: StudyCard[];
};

export type LibraryImportResult = {
  lyricsUpserted: number;
  studyCardsWritten: number;
  studyCardsSkipped: number;
};

const LAYOUTS: PosterLayoutProfile[] = ['clipPosterPrint', 'mobilePoster', 'squarePoster'];
const LANGS: LangCode[] = ['jp', 'ko', 'en', 'zh'];
const KINDS = ['vocab', 'grammar'] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isLayout(v: unknown): v is PosterLayoutProfile {
  return typeof v === 'string' && (LAYOUTS as string[]).includes(v);
}

function isLang(v: unknown): v is LangCode {
  return typeof v === 'string' && (LANGS as string[]).includes(v);
}

function isKind(v: unknown): v is StudyCard['kind'] {
  return typeof v === 'string' && (KINDS as readonly string[]).includes(v);
}

function sanitizeProject(raw: unknown): SavedLyricsProject | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (typeof raw.title !== 'string') return null;
  if (typeof raw.rawLyrics !== 'string') return null;
  if (typeof raw.bodyHtml !== 'string') return null;
  if (!Array.isArray(raw.pageHtmls) || !raw.pageHtmls.every((p) => typeof p === 'string')) {
    return null;
  }
  if (!isLayout(raw.layoutProfile)) return null;
  if (typeof raw.savedAt !== 'number' || !Number.isFinite(raw.savedAt)) return null;

  const project: SavedLyricsProject = {
    id: raw.id.trim(),
    title: raw.title.trim() || '歌词笔记',
    rawLyrics: raw.rawLyrics,
    bodyHtml: raw.bodyHtml,
    pageHtmls: raw.pageHtmls as string[],
    layoutProfile: raw.layoutProfile,
    savedAt: raw.savedAt,
  };
  if (typeof raw.artist === 'string' && raw.artist.trim()) {
    project.artist = raw.artist.trim();
  }
  if (typeof raw.titleMarkupHtml === 'string') {
    project.titleMarkupHtml = raw.titleMarkupHtml;
  }
  if (typeof raw.includeVocabAndGrammar === 'boolean') {
    project.includeVocabAndGrammar = raw.includeVocabAndGrammar;
  }
  if (
    raw.pedagogicalLevel === 'beginner' ||
    raw.pedagogicalLevel === 'intermediate' ||
    raw.pedagogicalLevel === 'advanced'
  ) {
    project.pedagogicalLevel = raw.pedagogicalLevel as PedagogicalLevel;
  }
  if (isLang(raw.lang)) {
    project.lang = raw.lang;
  }
  return project;
}

function sanitizeCard(raw: unknown): StudyCard | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (typeof raw.bundleId !== 'string' || !raw.bundleId.trim()) return null;
  if (typeof raw.songTitle !== 'string') return null;
  if (!isLang(raw.lang)) return null;
  if (!isKind(raw.kind)) return null;
  if (typeof raw.front !== 'string') return null;
  if (typeof raw.back !== 'string') return null;
  if (typeof raw.tags !== 'string') return null;
  if (typeof raw.sourceRaw !== 'string') return null;
  if (typeof raw.createdAt !== 'number' || !Number.isFinite(raw.createdAt)) return null;

  const card: StudyCard = {
    id: raw.id.trim(),
    bundleId: raw.bundleId.trim(),
    songTitle: raw.songTitle,
    lang: raw.lang,
    kind: raw.kind,
    front: raw.front,
    back: raw.back,
    tags: raw.tags,
    sourceRaw: raw.sourceRaw,
    dedupeKey: typeof raw.dedupeKey === 'string' ? raw.dedupeKey : '',
    createdAt: raw.createdAt,
  };
  if (typeof raw.artist === 'string') card.artist = raw.artist;
  if (typeof raw.meaning === 'string') card.meaning = raw.meaning;
  if (typeof raw.gloss === 'string') card.gloss = raw.gloss;
  if (typeof raw.sourceLabel === 'string') card.sourceLabel = raw.sourceLabel;
  if (typeof raw.lyricJaRaw === 'string') card.lyricJaRaw = raw.lyricJaRaw;
  if (typeof raw.lyricZh === 'string') card.lyricZh = raw.lyricZh;
  return card;
}

export function parseLibraryBackupJson(text: string): LibraryBackupPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error('无法解析 JSON 文件');
  }
  if (!isRecord(parsed)) throw new Error('备份格式无效');
  if (parsed.format !== LIBRARY_BACKUP_FORMAT) {
    throw new Error('不是 SHUFURI 歌词本备份文件');
  }
  if (parsed.version !== LIBRARY_BACKUP_VERSION) {
    throw new Error(`不支持的备份版本：${String(parsed.version)}`);
  }
  if (!Array.isArray(parsed.lyricsProjects) || !Array.isArray(parsed.studyCards)) {
    throw new Error('备份缺少歌词本或学习卡数据');
  }

  const lyricsProjects = parsed.lyricsProjects
    .map(sanitizeProject)
    .filter((p): p is SavedLyricsProject => p != null);
  const studyCards = parsed.studyCards
    .map(sanitizeCard)
    .filter((c): c is StudyCard => c != null);

  if (!lyricsProjects.length && !studyCards.length) {
    throw new Error('备份中没有可导入的歌词或单词');
  }

  return {
    format: LIBRARY_BACKUP_FORMAT,
    version: LIBRARY_BACKUP_VERSION,
    exportedAt:
      typeof parsed.exportedAt === 'number' && Number.isFinite(parsed.exportedAt)
        ? parsed.exportedAt
        : Date.now(),
    lyricsProjects,
    studyCards,
  };
}

export async function buildLibraryBackup(): Promise<LibraryBackupPayload> {
  const [lyricsProjects, studyCards] = await Promise.all([
    listSavedLyricsProjects(),
    listStudyCards(),
  ]);
  return {
    format: LIBRARY_BACKUP_FORMAT,
    version: LIBRARY_BACKUP_VERSION,
    exportedAt: Date.now(),
    lyricsProjects,
    studyCards,
  };
}

function backupFilename(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `shufuri-library-${y}${m}${day}.json`;
}

export async function exportLibraryBackupJson(): Promise<{
  lyricsCount: number;
  studyCardsCount: number;
}> {
  const payload = await buildLibraryBackup();
  if (!payload.lyricsProjects.length && !payload.studyCards.length) {
    throw new Error('暂无歌词本或学习卡可导出');
  }
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  const filename = backupFilename();

  if (isNativeWebView()) {
    await shareTextFile(json, filename, '导出歌词与单词');
  } else {
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return {
    lyricsCount: payload.lyricsProjects.length,
    studyCardsCount: payload.studyCards.length,
  };
}

export async function importLibraryBackupJson(text: string): Promise<LibraryImportResult> {
  const payload = parseLibraryBackupJson(text);
  const lyricsUpserted = await upsertSavedLyricsProjects(payload.lyricsProjects);
  const cards = await upsertStudyCardsFromBackup(payload.studyCards);
  return {
    lyricsUpserted,
    studyCardsWritten: cards.written,
    studyCardsSkipped: cards.skipped,
  };
}

export async function readLibraryBackupFile(file: File): Promise<string> {
  return file.text();
}
