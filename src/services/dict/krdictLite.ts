/**
 * KRDICT lite：本地韩中即时查词（读音 / 词性 / 中文释义）。
 * 数据：public/dict/krdict-lite.json.gz（CC-BY-SA 2.0 KR，국립국어원）
 *
 * 查词：Garu 形态分析（优先）→ 精确 / 空白分词 / 助词词尾 / 最长子串（回退）。
 */

import type { MicroscopeExplainResult } from '../../codec/prompt/buildMicroscopePrompt';
import {
  analyzeKorean,
  lemmasFromGaruTokens,
  type GaruLemmaCandidate,
} from './garuKoTokenizer';
import {
  applyKoConjRules,
  koLookupCandidates,
  normalizeKoSurface,
  splitKoTokens,
  stripKoParticles,
} from './koSurfaceNormalize';
import { mergeKrdictSeedPatches } from './krdictSeedPatches';

export type KrdictLiteEntry = {
  f: string[];
  h: string;
  r: string;
  p: string;
  g: string;
};

type KrdictLiteFile = {
  v: number;
  src: string;
  date: string | null;
  n: number;
  license?: string;
  attribution?: string;
  entries: KrdictLiteEntry[];
};

let loadPromise: Promise<Map<string, KrdictLiteEntry>> | null = null;
let indexRef: Map<string, KrdictLiteEntry> | null = null;
let metaRef: {
  src: string;
  date: string | null;
  n: number;
  license?: string;
  attribution?: string;
} | null = null;

async function gunzipToText(buf: ArrayBuffer): Promise<string> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前环境不支持 gzip 解压（需要 DecompressionStream）');
  }
  const stream = new Response(buf).body!.pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

function isGzipBuffer(buf: ArrayBuffer): boolean {
  const b = new Uint8Array(buf);
  return b.length >= 2 && b[0] === 0x1f && b[1] === 0x8b;
}

async function bufferToDictJson(buf: ArrayBuffer): Promise<string> {
  if (isGzipBuffer(buf)) return gunzipToText(buf);
  return new TextDecoder('utf-8').decode(buf);
}

function preferEntry(a: KrdictLiteEntry, b: KrdictLiteEntry, form: string): KrdictLiteEntry {
  const aHead = a.h === form ? 1 : 0;
  const bHead = b.h === form ? 1 : 0;
  if (aHead !== bHead) return bHead > aHead ? b : a;
  if (a.g.length !== b.g.length) return a.g.length <= b.g.length ? a : b;
  return a;
}

function buildIndex(file: KrdictLiteFile): Map<string, KrdictLiteEntry> {
  const map = new Map<string, KrdictLiteEntry>();
  for (const entry of file.entries) {
    for (const form of entry.f) {
      if (!form) continue;
      const prev = map.get(form);
      if (!prev) map.set(form, entry);
      else map.set(form, preferEntry(prev, entry, form));
    }
  }
  mergeKrdictSeedPatches(map);
  return map;
}

export function getKrdictLiteMeta(): {
  src: string;
  date: string | null;
  n: number;
  license?: string;
  attribution?: string;
} | null {
  return metaRef;
}

export async function ensureKrdictLiteLoaded(): Promise<Map<string, KrdictLiteEntry>> {
  if (indexRef) return indexRef;
  if (!loadPromise) {
    loadPromise = (async () => {
      const res = await fetch('/dict/krdict-lite.json.gz');
      if (!res.ok) throw new Error(`韩语词典加载失败（HTTP ${res.status}）`);
      const text = await bufferToDictJson(await res.arrayBuffer());
      const file = JSON.parse(text) as KrdictLiteFile;
      if (!file?.entries?.length) throw new Error('韩语词典数据为空');
      metaRef = {
        src: file.src,
        date: file.date,
        n: file.n,
        license: file.license,
        attribution: file.attribution,
      };
      indexRef = buildIndex(file);
      return indexRef;
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }
  return loadPromise;
}

export type KrdictLookupHit = {
  entry: KrdictLiteEntry;
  matched: string;
  /** 查词路径说明（剥助词 / 前缀等） */
  via: string;
};

function tryExact(
  index: Map<string, KrdictLiteEntry>,
  form: string,
  via: string,
): KrdictLookupHit | null {
  const entry = index.get(form);
  if (!entry) return null;
  return { entry, matched: form, via };
}

/** 从前缀探测词典形：划选越长越先试更长前缀；下限 2 字 */
function lookupByPrefix(
  index: Map<string, KrdictLiteEntry>,
  surface: string,
): KrdictLookupHit | null {
  const q = normalizeKoSurface(surface);
  if (q.length < 2) return null;
  const minLen = 2;
  const startLen = q.length >= 3 ? q.length - 1 : q.length;
  for (let len = startLen; len >= minLen; len--) {
    const prefix = q.slice(0, len);
    const hit = index.get(prefix);
    if (hit) {
      return { entry: hit, matched: prefix, via: `前缀命中「${prefix}」` };
    }
    const asDa = `${prefix}다`;
    const hitDa = index.get(asDa);
    if (hitDa) {
      return { entry: hitDa, matched: asDa, via: `前缀词干「${asDa}」` };
    }
    if (prefix.length >= 1) {
      const asHada = `${prefix}하다`;
      const hitHada = index.get(asHada);
      if (hitHada) {
        return { entry: hitHada, matched: asHada, via: `前缀词干「${asHada}」` };
      }
      const asHida = `${prefix}히다`;
      const hitHida = index.get(asHida);
      if (hitHida) {
        return { entry: hitHida, matched: asHida, via: `前缀词干「${asHida}」` };
      }
    }
  }
  return null;
}

/** 单片段查词（不含短语切分） */
function lookupUnit(
  index: Map<string, KrdictLiteEntry>,
  phrase: string,
): KrdictLookupHit | null {
  const q = normalizeKoSurface(phrase);
  if (!q) return null;

  for (const c of koLookupCandidates(q)) {
    const hit = tryExact(index, c.form, c.note === 'exact' ? '精确' : c.note);
    if (hit) return hit;
  }

  const { stem } = stripKoParticles(q);
  const prefixSurfaces = [q, stem, ...applyKoConjRules(q).map((c) => c.form)];
  for (const s of prefixSurfaces) {
    const pref = lookupByPrefix(index, s);
    if (pref) return pref;
  }

  return null;
}

function hitScore(hit: KrdictLookupHit, surfaceLen: number): number {
  const pos = hit.entry.p;
  const posBonus =
    pos.includes('名') || pos.includes('动') || pos.includes('形') || pos.includes('副')
      ? 30
      : pos.includes('助')
        ? -40
        : 0;
  return surfaceLen * 10 + hit.matched.length + posBonus;
}

/**
 * 去空白后自左向右最长匹配；跳过无法命中的字。
 * 用于「포수에게잡혀온잉어만」这类多词粘连划选。
 */
function lookupByLongestScan(
  index: Map<string, KrdictLiteEntry>,
  phrase: string,
): KrdictLookupHit | null {
  const q = normalizeKoSurface(phrase);
  if (q.length < 2) return null;

  let best: KrdictLookupHit | null = null;
  let bestScore = -1;
  let i = 0;
  while (i < q.length) {
    let local: KrdictLookupHit | null = null;
    let localLen = 0;
    let localScore = -1;
    const maxLen = Math.min(12, q.length - i);
    for (let len = maxLen; len >= 2; len--) {
      const surface = q.slice(i, i + len);
      const hit = lookupUnit(index, surface);
      if (!hit) continue;
      // 避免整段里只命中 1～2 字弱词冒充结果（划选很长时）
      if (q.length >= 6 && hit.matched.length <= 1) continue;
      const sc = hitScore(hit, len);
      if (sc > localScore) {
        localScore = sc;
        local = hit;
        localLen = len;
      }
    }
    if (local && localLen > 0) {
      if (localScore > bestScore) {
        best = {
          ...local,
          via: `短语分词「${local.matched}」· ${local.via}`,
        };
        bestScore = localScore;
      }
      i += localLen;
    } else {
      i += 1;
    }
  }
  return best;
}

function garuLemmaScore(lemma: GaruLemmaCandidate): number {
  const pos = lemma.pos;
  const posBonus =
    pos === 'VV' || pos === 'VA' || pos === 'VX'
      ? 40
      : pos.startsWith('NN') || pos === 'NP' || pos === 'NR'
        ? 35
        : pos === 'MAG' || pos === 'MAJ' || pos === 'XR'
          ? 20
          : 0;
  return lemma.form.length * 10 + posBonus;
}

function isGaruContentPos(pos: string): boolean {
  return (
    pos.startsWith('NN') ||
    pos === 'NP' ||
    pos === 'NR' ||
    pos === 'VV' ||
    pos === 'VA' ||
    pos === 'VX' ||
    pos === 'MAG' ||
    pos === 'MAJ' ||
    pos === 'XR'
  );
}

/** 同干的「영원하다」优先于「영원」，避免短语里重复列同一概念 */
function dedupeGaruContentLemmas(
  lemmas: GaruLemmaCandidate[],
): GaruLemmaCandidate[] {
  const content = lemmas.filter((l) => isGaruContentPos(l.pos));
  const forms = new Set(content.map((c) => c.form));
  const filtered = content.filter((c) => !forms.has(`${c.form}하다`));
  const seen = new Set<string>();
  const out: GaruLemmaCandidate[] = [];
  for (const c of filtered) {
    if (seen.has(c.form)) continue;
    seen.add(c.form);
    out.push(c);
  }
  return out;
}

/**
 * Garu 形态素 → 词典形精确查 KRDICT。
 * 多内容词（短语划选）时逐要素列出；未命中也占位，避免只剩一个词头。
 */
export function lookupViaGaruLemmas(
  index: Map<string, KrdictLiteEntry>,
  lemmas: GaruLemmaCandidate[],
  phrase = '',
): KrdictLookupHit | null {
  if (!lemmas.length) return null;

  const q = phrase.trim();
  const contentLemmas = dedupeGaruContentLemmas(lemmas);
  const multiPhrase =
    contentLemmas.length >= 2 &&
    Boolean(q) &&
    (/\s/u.test(q) ||
      normalizeKoSurface(q).length > (contentLemmas[0]?.form.length ?? 0) + 1);

  if (multiPhrase) {
    const ordered = [...contentLemmas].sort(
      (a, b) => garuLemmaScore(b) - garuLemmaScore(a),
    );
    const parts: string[] = [];
    const heads: string[] = [];
    const readings: string[] = [];
    let anyHit = false;
    for (const lemma of ordered) {
      const hit = tryExact(index, lemma.form, lemma.note);
      if (hit) {
        anyHit = true;
        parts.push(`${hit.entry.h}：${hit.entry.g}`);
        heads.push(hit.entry.h);
        if (hit.entry.r) readings.push(hit.entry.r);
      } else {
        parts.push(`${lemma.form}：（本地无条目）`);
        heads.push(lemma.form);
      }
    }
    if (!anyHit) return null;
    return {
      matched: q,
      via: `Garu 逐要素（${heads.join('·')}）`,
      entry: {
        f: [q],
        h: q,
        r: readings.join(' · ') || '—',
        p: '短语',
        g: `局部参考：${parts.join(' ｜ ')}`,
      },
    };
  }

  let best: KrdictLookupHit | null = null;
  let bestSc = -1;
  for (const lemma of lemmas) {
    const hit = tryExact(index, lemma.form, lemma.note);
    if (!hit) continue;
    const sc = hitScore(hit, lemma.form.length) + garuLemmaScore(lemma);
    if (sc > bestSc) {
      best = hit;
      bestSc = sc;
    }
  }
  return best;
}

async function lookupViaGaru(
  index: Map<string, KrdictLiteEntry>,
  phrase: string,
): Promise<KrdictLookupHit | null> {
  try {
    const tokens = await analyzeKorean(phrase);
    if (!tokens.length) return null;
    return lookupViaGaruLemmas(index, lemmasFromGaruTokens(tokens), phrase);
  } catch (err) {
    console.warn('[garu-ko] analyze failed, fallback to heuristic', err);
    return null;
  }
}

export async function lookupKrdictLite(phrase: string): Promise<KrdictLookupHit | null> {
  const index = await ensureKrdictLiteLoaded();
  const viaGaru = await lookupViaGaru(index, phrase);
  if (viaGaru) return viaGaru;
  return lookupKrdictAgainstIndex(index, phrase);
}

/** 供构建后回归脚本直接注入 index，避免依赖浏览器 fetch */
export function lookupKrdictAgainstIndex(
  index: Map<string, KrdictLiteEntry>,
  phrase: string,
): KrdictLookupHit | null {
  const raw = phrase.trim();
  if (!raw) return null;

  // 1) 整段（去空白）
  const whole = lookupUnit(index, raw);
  if (whole && normalizeKoSurface(raw).length <= whole.matched.length + 2) {
    return whole;
  }
  if (whole && normalizeKoSurface(raw).length <= 4) return whole;

  // 2) 空白分词：长片段优先（잡혀온 / 잉어만）
  const tokens = splitKoTokens(raw).sort((a, b) => b.length - a.length);
  let bestToken: KrdictLookupHit | null = null;
  let bestTokenScore = -1;
  for (const tok of tokens) {
    const hit = lookupUnit(index, tok);
    if (!hit) continue;
    const sc = hitScore(hit, tok.length);
    if (sc > bestTokenScore) {
      bestToken = { ...hit, via: `词块「${tok}」· ${hit.via}` };
      bestTokenScore = sc;
    }
  }

  // 3) 粘连最长扫描
  const scanned = lookupByLongestScan(index, raw);

  const candidates = [whole, bestToken, scanned].filter(Boolean) as KrdictLookupHit[];
  if (!candidates.length) return null;

  let best = candidates[0];
  let bestSc = hitScore(best, best.matched.length);
  for (const c of candidates.slice(1)) {
    const sc = hitScore(c, c.matched.length);
    if (sc > bestSc) {
      best = c;
      bestSc = sc;
    }
  }
  return best;
}

export function krdictHitToMicroscope(hit: KrdictLookupHit): MicroscopeExplainResult {
  const { entry, matched, via } = hit;
  const surfaceOnly =
    entry.g.includes('本地无整词') || entry.g.startsWith('局部参考');
  const viaGaru = via.startsWith('Garu');
  const conjugated = !surfaceOnly && (matched !== entry.h || via !== '精确');
  return {
    micro_analysis: {
      dictionary_form: entry.h,
      pronunciation: entry.r || '—',
      part_of_speech: entry.p,
      grammar_breakdown: surfaceOnly
        ? viaGaru
          ? `Garu 分段：${via}。短语无整词条目；下列为局部词义，完整主谓宾可点「AI讲解」。`
          : `划选「${matched}」。${entry.g}。完整结构可点「AI讲解」。`
        : conjugated
          ? viaGaru
            ? `Garu 形态分析：${via} → 词典形「${entry.h}」。语境可点「AI讲解」。`
            : `本地假分词：${via} → 词典形「${entry.h}」。语境可点「AI讲解」。`
          : 'KRDICT 本地释义。语境可点「AI讲解」。',
      direct_meaning: entry.g || '—',
    },
  };
}
