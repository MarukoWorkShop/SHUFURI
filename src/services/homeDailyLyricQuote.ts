import type { LangCode } from './appSettings';
import { listSavedLyricsProjects, type SavedLyricsProject } from './savedLyricsStore';
import { inferPosterLangFromBodyHtml } from '../utils/shufuriPoster/inferPosterLang';

export type HomeDailyLyricQuote = {
  projectId: string;
  title: string;
  artist?: string;
  lang: LangCode;
  lines: string[];
  /** 在整首歌主歌行数组中的起始下标 */
  startIndex: number;
};

export type HomeDailyLyricQuoteOptions = {
  /** daily = 日 seed 固定；random = 长按刷新 */
  mode?: 'daily' | 'random';
  /** 长按刷新时尽量避开同一摘录 */
  exclude?: Pick<HomeDailyLyricQuote, 'projectId' | 'startIndex' | 'lines'>;
  /** 测试注入 */
  now?: Date;
  /** 测试注入随机源 */
  rng?: () => number;
};

const PRIMARY_LINE_SELECTOR = '.jp-line, .ko-line, .cn-line, .zh-line';

function stripPrimaryLineHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  doc.querySelectorAll('rt, rp').forEach((el) => el.remove());
  return doc.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/** 从海报 bodyHtml 提取主歌行纯文本（排除 vocab / grammar 区段） */
export function extractHomeLyricLines(bodyHtml: string): string[] {
  const doc = new DOMParser().parseFromString(`<div>${bodyHtml}</div>`, 'text/html');
  const lines: string[] = [];
  doc.querySelectorAll('.lyrics-group').forEach((group) => {
    const primary = group.querySelector(PRIMARY_LINE_SELECTOR);
    if (!primary) return;
    const text = stripPrimaryLineHtml(primary.innerHTML);
    if (text) lines.push(text);
  });
  return lines;
}

function resolveProjectLang(project: SavedLyricsProject): LangCode {
  return project.lang ?? inferPosterLangFromBodyHtml(project.bodyHtml) ?? 'jp';
}

function dailySeedKey(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 简单可复现伪随机（Mulberry32 变体） */
export function createSeededRng(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(31, h) + seed.charCodeAt(i);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function pickHomeLyricExcerpt(
  allLines: string[],
  rng: () => number,
): { lines: string[]; startIndex: number } | null {
  if (!allLines.length) return null;

  if (allLines.length <= 4) {
    return { lines: [...allLines], startIndex: 0 };
  }

  const count = 1 + Math.floor(rng() * 4);
  const maxStart = allLines.length - count;
  const startIndex = Math.floor(rng() * (maxStart + 1));
  return {
    lines: allLines.slice(startIndex, startIndex + count),
    startIndex,
  };
}

function excerptSignature(
  projectId: string,
  startIndex: number,
  lines: string[],
): string {
  return `${projectId}:${startIndex}:${lines.join('\u0001')}`;
}

function buildQuoteFromProject(
  project: SavedLyricsProject,
  rng: () => number,
): HomeDailyLyricQuote | null {
  const allLines = extractHomeLyricLines(project.bodyHtml);
  const excerpt = pickHomeLyricExcerpt(allLines, rng);
  if (!excerpt) return null;

  return {
    projectId: project.id,
    title: project.title,
    artist: project.artist,
    lang: resolveProjectLang(project),
    lines: excerpt.lines,
    startIndex: excerpt.startIndex,
  };
}

function pickEligibleProjects(projects: SavedLyricsProject[]): SavedLyricsProject[] {
  return projects.filter((p) => extractHomeLyricLines(p.bodyHtml).length > 0);
}

export async function resolveHomeDailyLyricQuote(
  options: HomeDailyLyricQuoteOptions = {},
): Promise<HomeDailyLyricQuote | null> {
  const mode = options.mode ?? 'daily';
  const now = options.now ?? new Date();
  const projects = pickEligibleProjects(await listSavedLyricsProjects());
  if (!projects.length) return null;

  const excludeSig = options.exclude
    ? excerptSignature(options.exclude.projectId, options.exclude.startIndex, options.exclude.lines)
    : null;

  const tryBuild = (rng: () => number, project: SavedLyricsProject): HomeDailyLyricQuote | null =>
    buildQuoteFromProject(project, rng);

  if (mode === 'daily') {
    const rng = options.rng ?? createSeededRng(dailySeedKey(now));
    const project = projects[Math.floor(rng() * projects.length)]!;
    return tryBuild(rng, project);
  }

  const maxAttempts = Math.max(8, projects.length * 3);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const rng = options.rng ?? Math.random;
    const project = projects[Math.floor(rng() * projects.length)]!;
    const quote = tryBuild(rng, project);
    if (!quote) continue;
    const sig = excerptSignature(quote.projectId, quote.startIndex, quote.lines);
    if (excludeSig && sig === excludeSig) continue;
    return quote;
  }

  const fallbackProject = projects[Math.floor(Math.random() * projects.length)]!;
  return tryBuild(options.rng ?? Math.random, fallbackProject);
}
