import type { LangCode } from '../services/appSettings';
import { getLyricConfirmPreview, type LyricConfirmPreview } from './lyricConfirm';

export type LyricCandidate = {
  id: 'A' | 'B';
  /** 展示标签，如「首选（完整版）」「备选（TV Size 短版）」 */
  label: string;
  /** 检索来源，如 UtaTen / Genius / Melon */
  source?: string;
  /** 版本类型，如 full / tv_size / radio_edit / official */
  variant?: string;
  /** 清洗后的完整记录流，供下游排版 / 合并 */
  rawText: string;
  preview: LyricConfirmPreview;
  title: string;
  artist: string;
  lang?: LangCode;
  lineCount: number;
};

export type LyricCandidatesResult =
  | { status: 'ok'; candidates: [LyricCandidate, LyricCandidate] }
  | { status: 'single'; candidate: LyricCandidate; message?: string }
  | { status: 'no_match'; message: string }
  | { status: 'error'; code: string; message: string; retryable: boolean };

const CAND_A = '@@CANDIDATE_A@@';
const CAND_B = '@@CANDIDATE_B@@';
const NO_MATCH = '@@NO_MATCH@@';

const VARIANT_LABELS: Record<string, string> = {
  full: '完整版',
  tv_size: 'TV Size 短版',
  radio_edit: 'Radio Edit',
  official: '官方内页',
};

function labelFor(id: 'A' | 'B', variant?: string): string {
  const v = variant ? VARIANT_LABELS[variant] ?? variant : undefined;
  if (id === 'A') return v ? `首选（${v}）` : '首选（完整版）';
  return v ? `备选（${v}）` : '备选';
}

/** 去除 markdown 代码围栏等噪声 */
function stripFences(body: string): string {
  return body
    .replace(/```[a-zA-Z]*\n?/g, '')
    .replace(/~~~[a-zA-Z]*\n?/g, '')
    .trim();
}

/** 解析可选 META|source=..|variant=.. 头行 */
function parseMeta(seg: string): { body: string; source?: string; variant?: string } {
  const lines = seg.split('\n');
  let source: string | undefined;
  let variant: string | undefined;
  const rest: string[] = [];
  let consumed = 0;
  for (const line of lines) {
    const m = line.match(/^META\|(.+)$/);
    if (m && consumed === 0) {
      for (const part of m[1].split('|')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        const k = part.slice(0, idx).trim();
        const val = part.slice(idx + 1).trim();
        if (k === 'source') source = val || undefined;
        if (k === 'variant') variant = val || undefined;
      }
      consumed++;
      continue;
    }
    rest.push(line);
  }
  return { body: rest.join('\n').trim(), source, variant };
}

function buildCandidate(
  id: 'A' | 'B',
  rawSeg: string,
  fallbacks?: { title?: string; artist?: string },
): LyricCandidate | null {
  const { body, source, variant } = parseMeta(rawSeg);
  const cleaned = stripFences(body);
  if (!cleaned) return null;
  const preview = getLyricConfirmPreview(cleaned, fallbacks);
  if (!preview) return null;
  return {
    id,
    label: labelFor(id, variant),
    source,
    variant,
    rawText: cleaned,
    preview,
    title: preview.title,
    artist: preview.artist,
    lang: preview.lang,
    lineCount: preview.lineCount,
  };
}

function normalizeForCompare(s: string): string {
  return s.replace(/\s+/g, '').replace(/[｜|]/g, '|');
}

/**
 * 解析双候选歌词结果。
 * - 含 @@NO_MATCH@@ → no_match
 * - 按 @@CANDIDATE_A/B@@ 切分为两段记录流，各自用 getLyricConfirmPreview 校验
 * - 2 段有效 → ok；仅 1 段 → single（鲁棒兜底，仍允许采纳）；0 段 → error
 * - 两段内容几乎相同 → 降级 single，避免重复展示
 */
export function parseLyricCandidates(
  raw: string,
  fallbacks?: { title?: string; artist?: string },
): LyricCandidatesResult {
  const text = (raw ?? '').trim();
  if (!text) {
    return { status: 'error', code: 'empty', message: '模型返回为空', retryable: true };
  }

  if (text.includes(NO_MATCH)) {
    const m = text.match(/reason:\s*(.+)/i);
    const message = (m && m[1].trim()) || '没有找到匹配的歌词';
    return { status: 'no_match', message };
  }

  const tokens = text.split(/(@@CANDIDATE_[AB]@@|@@NO_MATCH@@)/);
  let currentId: 'A' | 'B' | null = null;
  const buffers: Record<'A' | 'B', string[]> = { A: [], B: [] };
  for (const tok of tokens) {
    if (tok === CAND_A) {
      currentId = 'A';
      continue;
    }
    if (tok === CAND_B) {
      currentId = 'B';
      continue;
    }
    if (tok === NO_MATCH) {
      continue;
    }
    if (currentId) buffers[currentId].push(tok);
  }

  let bodyA = buffers.A.join('').trim();
  let bodyB = buffers.B.join('').trim();

  // 没有任何分隔符：整段作为首选候选
  if (!bodyA && !bodyB) {
    bodyA = text;
  }

  const candA = bodyA ? buildCandidate('A', bodyA, fallbacks) : null;
  const candB = bodyB ? buildCandidate('B', bodyB, fallbacks) : null;

  if (candA && candB) {
    if (normalizeForCompare(candA.rawText) === normalizeForCompare(candB.rawText)) {
      return {
        status: 'single',
        candidate: candA,
        message: '两个候选版本内容一致，已为你保留唯一版本',
      };
    }
    return { status: 'ok', candidates: [candA, candB] };
  }
  if (candA) {
    return { status: 'single', candidate: candA, message: '未检索到第二个可靠版本，以下为唯一候选' };
  }
  if (candB) {
    return { status: 'single', candidate: candB, message: '未检索到第二个可靠版本，以下为唯一候选' };
  }
  return { status: 'error', code: 'parse_failed', message: '歌词解析失败，请重试', retryable: true };
}
