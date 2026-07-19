/**
 * JMdict eng-common 精简包：本地即时查词（读音 / 词性 / 英语释义）。
 * 数据：public/dict/jmdict-lite.json.gz
 *
 * 注意：部分静态服务器（含 Vite）会对 .gz 预解压后再返回明文 JSON。
 */

import type { MicroscopeExplainResult } from '../../codec/prompt/buildMicroscopePrompt';

export type JmdictLiteEntry = {
  f: string[];
  h: string;
  r: string;
  p: string;
  g: string;
};

type JmdictLiteFile = {
  v: number;
  src: string;
  date: string | null;
  n: number;
  entries: JmdictLiteEntry[];
};

let loadPromise: Promise<Map<string, JmdictLiteEntry>> | null = null;
let indexRef: Map<string, JmdictLiteEntry> | null = null;
let metaRef: { src: string; date: string | null; n: number } | null = null;

const TRAILING_PARTICLES = /[はがをにでのともへややっー〜～]+$/u;

const DEINFLECT_RULES: { from: RegExp; to: string[] }[] = [
  { from: /させられる$/u, to: ['る'] },
  { from: /させない$/u, to: ['る'] },
  { from: /させ$/u, to: ['る'] },
  { from: /られない$/u, to: ['る'] },
  { from: /られている$/u, to: ['る'] },
  { from: /られる$/u, to: ['る'] },
  { from: /れている$/u, to: ['る'] },
  { from: /ている$/u, to: ['る'] },
  { from: /てる$/u, to: ['る'] },
  { from: /ませんでした$/u, to: ['る'] },
  { from: /ました$/u, to: ['る'] },
  { from: /ます$/u, to: ['る'] },
  { from: /ません$/u, to: ['る'] },
  { from: /でした$/u, to: [''] },
  { from: /だった$/u, to: [''] },
  { from: /なかった$/u, to: ['い', 'る'] },
  { from: /ない$/u, to: ['い', 'る'] },
  { from: /させる$/u, to: ['る'] },
  { from: /れる$/u, to: ['る'] },
  { from: /った$/u, to: ['る', 'つ', 'う'] },
  { from: /って$/u, to: ['る', 'つ', 'う'] },
  { from: /んだ$/u, to: ['ぬ', 'ぶ', 'む'] },
  { from: /んで$/u, to: ['ぬ', 'ぶ', 'む'] },
  { from: /いた$/u, to: ['く'] },
  { from: /いて$/u, to: ['く'] },
  { from: /いだ$/u, to: ['ぐ'] },
  { from: /いで$/u, to: ['ぐ'] },
  { from: /した$/u, to: ['す'] },
  { from: /して$/u, to: ['す', 'する'] },
  { from: /た$/u, to: ['る'] },
  { from: /て$/u, to: ['る'] },
  { from: /だ$/u, to: [''] },
  { from: /で$/u, to: ['る', ''] },
  { from: /な$/u, to: [''] },
  { from: /です$/u, to: [''] },
];

const WEAK_KANA = /^[ぁ-ゖァ-ヶーっッ]$/u;

/**
 * 词尾助词/语气（长的优先）。
 * 用于：整段去尾查词；以及判断「词 | 助词」是否合法切分。
 * 注意：不能用「rest 是否以 が 开头」这种前缀判断——会把「がとう」误当成助词「が」。
 */
const TRAILING_PARTICLE_SEQ = [
  'について',
  'として',
  'ってば',
  'っても',
  'ながら',
  'たり',
  'だって',
  'って',
  'とか',
  'なんて',
  'など',
  'から',
  'まで',
  'より',
  'ほど',
  'です',
  'ます',
  'ました',
  'ません',
  'は',
  'が',
  'を',
  'に',
  'で',
  'の',
  'と',
  'も',
  'へ',
  'や',
  'か',
  'ね',
  'よ',
  'わ',
  'ぞ',
  'さ',
  'な',
  'だ',
] as const;

/** 常见语法残片：不要当独立词条（して→仕手、て→手） */
const GRAMMAR_SURFACE_BLOCKLIST = new Set([
  'て',
  'で',
  'た',
  'だ',
  'して',
  'してる',
  'していて',
  'ます',
  'です',
  'ました',
  'ません',
]);

const KANA_ONLY = /^[ぁ-んー]+$/u;

/** 去掉末尾一连串助词：ありがとうって → ありがとう + って */
function stripTrailingParticles(q: string): { stem: string; tail: string } {
  let stem = q;
  const parts: string[] = [];
  let guard = 0;
  while (stem.length > 0 && guard++ < 12) {
    let hit: string | null = null;
    for (const p of TRAILING_PARTICLE_SEQ) {
      if (stem.length > p.length && stem.endsWith(p)) {
        hit = p;
        break;
      }
    }
    if (!hit) break;
    parts.unshift(hit);
    stem = stem.slice(0, -hit.length);
  }
  return { stem, tail: parts.join('') };
}

/**
 * rest 是否「整段都是助词串」（って / ってよ / だよ 等）。
 * 「がとうって」→ false（が 后面还粘着词干）。
 */
function restIsParticleTail(rest: string): boolean {
  if (!rest) return true;
  let cur = rest;
  let guard = 0;
  while (cur.length > 0 && guard++ < 12) {
    let hit: string | null = null;
    for (const p of TRAILING_PARTICLE_SEQ) {
      if (cur.startsWith(p)) {
        hit = p;
        break;
      }
    }
    if (!hit) return false;
    cur = cur.slice(hit.length);
  }
  return cur.length === 0;
}

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

/** 同一字形多义时，优先「词头 = 该字形」的条目（風→かぜ，而非振り的异写） */
function preferEntry(a: JmdictLiteEntry, b: JmdictLiteEntry, form: string): JmdictLiteEntry {
  const aHead = a.h === form ? 1 : 0;
  const bHead = b.h === form ? 1 : 0;
  if (aHead !== bHead) return bHead > aHead ? b : a;
  // 其次：读音更「像」常用（更长短平，弱启发）
  if (a.r.length !== b.r.length) return a.r.length <= b.r.length ? a : b;
  return a;
}

function buildIndex(file: JmdictLiteFile): Map<string, JmdictLiteEntry> {
  const map = new Map<string, JmdictLiteEntry>();
  for (const entry of file.entries) {
    for (const form of entry.f) {
      if (!form) continue;
      const prev = map.get(form);
      if (!prev) map.set(form, entry);
      else map.set(form, preferEntry(prev, entry, form));
    }
  }
  return map;
}

export function getJmdictLiteMeta(): { src: string; date: string | null; n: number } | null {
  return metaRef;
}

export async function ensureJmdictLiteLoaded(): Promise<Map<string, JmdictLiteEntry>> {
  if (indexRef) return indexRef;
  if (!loadPromise) {
    loadPromise = (async () => {
      const res = await fetch('/dict/jmdict-lite.json.gz');
      if (!res.ok) throw new Error(`本地词典加载失败（HTTP ${res.status}）`);
      const text = await bufferToDictJson(await res.arrayBuffer());
      const file = JSON.parse(text) as JmdictLiteFile;
      if (!file?.entries?.length) throw new Error('本地词典数据为空');
      metaRef = { src: file.src, date: file.date, n: file.n };
      indexRef = buildIndex(file);
      return indexRef;
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }
  return loadPromise;
}

function candidatesForToken(raw: string): string[] {
  const q = raw.replace(/\s+/g, '').trim();
  if (!q) return [];
  const out: string[] = [];
  const push = (s: string) => {
    if (s && !out.includes(s)) out.push(s);
  };
  push(q);
  push(q.replace(TRAILING_PARTICLES, ''));
  for (const { from, to } of DEINFLECT_RULES) {
    if (!from.test(q)) continue;
    for (const ending of to) {
      const base = q.replace(from, ending);
      push(base);
      push(base.replace(TRAILING_PARTICLES, ''));
    }
  }
  return out;
}

function isAcceptableLemma(surface: string, matched: string): boolean {
  if (!matched) return false;
  if (matched === surface) return true;
  if (WEAK_KANA.test(matched) && surface.length > 1) return false;
  if (matched.length >= 2) return true;
  if (surface.length === 1) return matched === surface;
  return false;
}

/**
 * 假切分检测：
 * - 「つま|びく」「あり|がとう」：假名词拦腰截断 → 拒绝
 * - 「ありがとう|って」：词 + 完整助词串 → 允许
 * - 「風|つまびく」：汉字词后接假名下一词 → 允许
 * - 「散った→散る」：整段活用还原 → 允许
 */
function isFalsePrefixCut(surface: string, matched: string, restAfterSurface: string): boolean {
  if (matched === surface) {
    if (!restAfterSurface) return false;
    // 后面全是助词串（って / よ 等）→ 合法
    if (restIsParticleTail(restAfterSurface)) return false;
    // 假名词后面还粘着非助词假名 → 切早了（あり|がとう）
    if (KANA_ONLY.test(surface) && /^[ぁ-んー]/u.test(restAfterSurface)) return true;
    return false;
  }
  if (candidatesForToken(surface).includes(matched)) return false;
  return true;
}

function scoreLemma(surface: string, matched: string): number {
  let s = matched.length * 10;
  if (matched === surface) s += 1000;
  if (matched.length >= 2 && matched.length < surface.length) s += 80; // 活用
  return s;
}

type InternalHit = {
  entry: JmdictLiteEntry;
  matched: string;
  surface: string;
};

function bestLemmaForSurface(
  index: Map<string, JmdictLiteEntry>,
  surface: string,
): InternalHit | null {
  let best: InternalHit | null = null;
  let bestScore = -1;
  for (const c of candidatesForToken(surface)) {
    if (!isAcceptableLemma(surface, c)) continue;
    const entry = index.get(c);
    if (!entry) continue;
    const sc = scoreLemma(surface, c);
    if (sc > bestScore) {
      bestScore = sc;
      best = { entry, matched: c, surface };
    }
  }
  return best;
}

/**
 * 自左向右最长匹配；拒绝「つま|びく」「にし|て」这类假切分。
 * 无法匹配则跳过 1 字（宁可漏词，不要乱猜）。
 */
function segmentPhrase(index: Map<string, JmdictLiteEntry>, phrase: string): InternalHit[] {
  const q = phrase.replace(/\s+/g, '').trim();
  if (!q) return [];

  const hits: InternalHit[] = [];
  let i = 0;
  while (i < q.length) {
    let best: InternalHit | null = null;
    let bestLen = 0;
    let bestScore = -1;
    const maxLen = Math.min(12, q.length - i);

    for (let len = maxLen; len >= 1; len--) {
      const surface = q.slice(i, i + len);
      const rest = q.slice(i + len);

      if (GRAMMAR_SURFACE_BLOCKLIST.has(surface)) continue;
      // 多字划选里：不把单个假名当成词（く→句、て→手）
      if (surface.length === 1 && WEAK_KANA.test(surface) && q.length > 1) continue;

      const hit = bestLemmaForSurface(index, surface);
      if (!hit) continue;
      if (isFalsePrefixCut(surface, hit.matched, rest)) continue;
      if (WEAK_KANA.test(hit.matched) && q.length > 1) continue;

      const sc = len * 100 + scoreLemma(surface, hit.matched);
      if (sc > bestScore) {
        bestScore = sc;
        best = hit;
        bestLen = len;
      }
    }

    if (best && bestLen > 0) {
      hits.push(best);
      i += bestLen;
    } else {
      i += 1;
    }
  }

  return hits;
}

export type JmdictLookupHit = {
  entry: JmdictLiteEntry;
  matched: string;
};

function toHit(h: InternalHit): JmdictLookupHit {
  return { entry: h.entry, matched: h.matched };
}

export async function lookupJmdictLite(phrase: string): Promise<JmdictLookupHit | null> {
  const index = await ensureJmdictLiteLoaded();
  const q = phrase.replace(/\s+/g, '').trim();
  if (!q) return null;

  if (GRAMMAR_SURFACE_BLOCKLIST.has(q)) return null;

  // 0) 整段精确命中优先（吐息 整词 > 拆成 息）
  const exact = index.get(q);
  if (exact) return { entry: exact, matched: q };

  // 1) Kuromoji：整段覆盖；禁止用子串冒充划选词
  try {
    const kuro = await lookupViaKuromoji(index, q);
    if (kuro) return kuro;
  } catch (err) {
    console.warn('[kuromoji]', err);
  }

  // 2) 先剥词尾助词再整词查：ありがとうって → ありがとう
  const { stem, tail } = stripTrailingParticles(q);
  if (stem && stem !== q) {
    const stemExact = index.get(stem);
    if (stemExact) {
      return {
        matched: tail ? `${stem}+${tail}` : stem,
        entry: stemExact,
      };
    }
    const stemHit = bestLemmaForSurface(index, stem);
    if (stemHit && !isFalsePrefixCut(stem, stemHit.matched, '')) {
      return {
        matched: tail ? `${stemHit.matched}+${tail}` : stemHit.matched,
        entry: stemHit.entry,
      };
    }
  }

  // 3) 整段活用
  const whole = bestLemmaForSurface(index, q);
  if (whole && !isFalsePrefixCut(q, whole.matched, '')) return toHit(whole);

  // 4) 分段：必须覆盖整段（或剩余仅为助词）；多段也不合并词头
  const parts = segmentPhrase(index, q).filter(
    (p) => !(WEAK_KANA.test(p.matched) && q.length > 1),
  );
  if (parts.length === 0) return null;
  const covered = parts.map((p) => p.surface).join('');
  const rest = q.slice(covered.length);
  if (!(covered === q || (covered && restIsParticleTail(rest)))) {
    return null;
  }
  if (parts.length === 1 && !rest) return toHit(parts[0]!);
  // 多段命中：保留划选原文，局部释义仅作参考
  const partial = parts.map((p) => `${p.entry.h}：${p.entry.g}`).join(' ｜ ');
  return {
    matched: q,
    entry: {
      f: [q],
      h: q,
      r: parts.map((p) => p.entry.r).filter(Boolean).join(''),
      p: parts.map((p) => p.entry.p).filter(Boolean)[0] || '词',
      g: `局部参考：${partial}`,
    },
  };
}

function katakanaToHiragana(s: string): string {
  return s.replace(/[\u30A1-\u30F6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60),
  );
}

/** 本地无整词时：保留划选原文 + Kuromoji 读音，避免用子串词头 */
function surfacePreservingHit(
  q: string,
  tokens: Array<{
    surface_form: string;
    reading: string;
    pronunciation: string;
    pos: string;
  }>,
  partialGloss?: string,
): JmdictLookupHit {
  const reading = tokens
    .map((t) => t.reading || t.pronunciation || '')
    .filter((r) => r && r !== '*')
    .map(katakanaToHiragana)
    .join('');
  const content = tokens.find((t) => t.pos && t.pos !== '助詞' && t.pos !== '助動詞' && t.pos !== '記号');
  const pos = content?.pos || tokens[0]?.pos || '词';
  return {
    matched: q,
    entry: {
      f: [q],
      h: q,
      r: reading || '—',
      p: pos,
      g: partialGloss || '本地无整词条目（可点 AI讲解）',
    },
  };
}

async function lookupViaKuromoji(
  index: Map<string, JmdictLiteEntry>,
  q: string,
): Promise<JmdictLookupHit | null> {
  const { tokenizeJapanese, isContentPos, isSkippablePos } = await import('./kuromojiTokenizer');
  const tokens = await tokenizeJapanese(q);
  if (!tokens.length) return null;

  const joined = tokens.map((t) => t.surface_form).join('');
  // 分词与划选不一致：仍保留划选原文
  if (joined !== q) return surfacePreservingHit(q, tokens);

  const contentTokens = tokens.filter((t) => isContentPos(t.pos));
  const particleTokens = tokens.filter((t) => t.pos === '助詞' || t.pos === '助動詞');

  const resolveTokenHit = (t: (typeof tokens)[number]): InternalHit | null => {
    if (isSkippablePos(t.pos)) return null;
    const preferBasic = t.pos === '動詞' || t.pos.startsWith('形容');
    const forms = preferBasic
      ? [t.basic_form, t.surface_form]
      : [t.surface_form, t.basic_form];
    for (const f of forms) {
      if (!f || f === '*') continue;
      const entry = index.get(f);
      if (entry) return { entry, matched: f, surface: t.surface_form };
    }
    const lemma =
      bestLemmaForSurface(index, t.surface_form) ||
      (t.basic_form && t.basic_form !== '*'
        ? bestLemmaForSurface(index, t.basic_form)
        : null);
    return lemma ? { ...lemma, surface: t.surface_form } : null;
  };

  // 单内容词（可带助词）：词 + て 等
  if (contentTokens.length <= 1) {
    const t = contentTokens[0] || tokens.find((x) => !isSkippablePos(x.pos));
    if (!t) return surfacePreservingHit(q, tokens);
    const hit = resolveTokenHit(t);
    const contentSurface = t.surface_form;
    const withParticles = contentSurface + particleTokens.map((p) => p.surface_form).join('');

    // 划选 == 该内容词（或词+助词）且词典命中 → 正常返回
    if (hit && (contentSurface === q || withParticles === q)) {
      if (particleTokens.length > 0 && withParticles === q) {
        return {
          entry: hit.entry,
          matched: `${hit.matched}+${particleTokens.map((p) => p.surface_form).join('')}`,
        };
      }
      return { entry: hit.entry, matched: hit.matched };
    }

    // 划选更长/是复合词但词典只有子串（吐息→息）→ 保留划选
    if (hit && hit.matched.length < q.length && q.includes(hit.matched)) {
      return surfacePreservingHit(q, tokens, `${hit.entry.h}：${hit.entry.g}`);
    }

    return surfacePreservingHit(q, tokens, hit ? `${hit.entry.h}：${hit.entry.g}` : undefined);
  }

  // 多内容词：划选视为一个学习单位，不合并成「励ます·呉れる·人」
  const hits: InternalHit[] = [];
  for (const t of contentTokens) {
    const hit = resolveTokenHit(t);
    if (hit) hits.push(hit);
  }
  const partial = hits.map((h) => `${h.entry.h}：${h.entry.g}`).join(' ｜ ');
  return surfacePreservingHit(
    q,
    tokens,
    partial ? `局部参考：${partial}` : undefined,
  );
}

export function jmdictHitToMicroscope(hit: JmdictLookupHit): MicroscopeExplainResult {
  const { entry, matched } = hit;
  const surfaceOnly =
    entry.g.includes('本地无整词') || entry.g.startsWith('局部参考');
  const multi = !surfaceOnly && entry.g.includes(' ｜ ');
  const particleNote = matched.includes('+');
  const conjugated = !multi && !particleNote && !surfaceOnly && matched !== entry.h;
  return {
    micro_analysis: {
      dictionary_form: entry.h,
      pronunciation: entry.r || '—',
      part_of_speech: entry.p,
      grammar_breakdown: surfaceOnly
        ? `划选「${matched}」。${entry.g}。可点「AI讲解」补中文义。`
        : multi
          ? `Kuromoji 分段：${matched}。语境可点「AI讲解」。`
          : particleNote
            ? `Kuromoji：${matched.replace(/\+/g, '」+「')}。本地 JMdict；语境可点「AI讲解」。`
            : conjugated
              ? `Kuromoji 活用 → 词典形「${entry.h}」。可点「AI讲解」。`
              : 'Kuromoji + JMdict 本地释义。语境可点「AI讲解」。',
      direct_meaning: entry.g || '—',
    },
  };
}
