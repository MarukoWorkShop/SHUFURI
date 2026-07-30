/**
 * 韩语划选表面形轻量规范化（假分词）：助词剥离 + 常见词尾还原。
 * 无词典依赖，便于单测。Garu 失败时作回退。
 */

/** 宾格缩约（날=나+를）→ 代词词典形 */
export const KO_OBJECT_CONTRACTS: Record<string, string> = {
  날: '나',
  널: '너',
  뭘: '무엇',
  이걸: '이것',
  그걸: '그것',
  저걸: '저것',
  우릴: '우리',
  절: '저',
  날로: '나',
};

/** 长的优先 */
export const KO_TRAILING_PARTICLES = [
  '부터',
  '까지',
  '에서',
  '으로',
  '로서',
  '로써',
  '에게',
  '한테',
  '께서',
  '이랑',
  '하고',
  '이나',
  '을',
  '를',
  '이',
  '가',
  '은',
  '는',
  '에',
  '의',
  '와',
  '과',
  '도',
  '만',
  '로',
  '요',
] as const;

type ConjRule = { from: RegExp; to: string; note: string };

/** 常见连接/活用词尾 → 尝试还原到词典形尾「다」或「하다」（长后缀优先） */
export const KO_CONJ_RULES: ConjRule[] = [
  { from: /해서요$/u, to: '하다', note: '해서요→하다' },
  { from: /해서$/u, to: '하다', note: '해서→하다' },
  { from: /었습니다$/u, to: '다', note: '었습니다→다' },
  { from: /았습니다$/u, to: '다', note: '았습니다→다' },
  { from: /였습니다$/u, to: '다', note: '였습니다→다' },
  { from: /습니다요$/u, to: '다', note: '습니다요→다' },
  { from: /습니다$/u, to: '다', note: '습니다→다' },
  { from: /ㅂ니다$/u, to: '다', note: 'ㅂ니다→다' },
  { from: /이에요$/u, to: '다', note: '이에요→다' },
  { from: /예요$/u, to: '다', note: '예요→다' },
  // 确认语气：너였잖아 → 너 / …이다
  { from: /였잖아요$/u, to: '이다', note: '였잖아요→이다' },
  { from: /였잖아$/u, to: '이다', note: '였잖아→이다' },
  { from: /이잖아요$/u, to: '이다', note: '이잖아요→이다' },
  { from: /이잖아$/u, to: '이다', note: '이잖아→이다' },
  { from: /잖아요$/u, to: '다', note: '잖아요→다' },
  { from: /잖아$/u, to: '다', note: '잖아→다' },
  { from: /아요$/u, to: '다', note: '아요→다' },
  { from: /어요$/u, to: '다', note: '어요→다' },
  { from: /아서$/u, to: '다', note: '아서→다' },
  { from: /어서$/u, to: '다', note: '어서→다' },
  { from: /여서$/u, to: '다', note: '여서→다' },
  // 受益/定语：믿어준 → 믿다；잡아준 → 잡다
  { from: /어줬어$/u, to: '다', note: '어줬어→다' },
  { from: /아줬어$/u, to: '다', note: '아줬어→다' },
  { from: /해줬어$/u, to: '하다', note: '해줬어→하다' },
  { from: /어줬$/u, to: '다', note: '어줬→다' },
  { from: /아줬$/u, to: '다', note: '아줬→다' },
  { from: /해줬$/u, to: '하다', note: '해줬→하다' },
  { from: /어준$/u, to: '다', note: '어준→다' },
  { from: /아준$/u, to: '다', note: '아준→다' },
  { from: /여준$/u, to: '다', note: '여준→다' },
  { from: /해준$/u, to: '하다', note: '해준→하다' },
  { from: /어줄$/u, to: '다', note: '어줄→다' },
  { from: /아줄$/u, to: '다', note: '아줄→다' },
  { from: /해줄$/u, to: '하다', note: '해줄→하다' },
  // 定语修饰：잡혀온 → 잡히다；먹어온 → 먹다
  { from: /혀온$/u, to: '히다', note: '혀온→히다' },
  { from: /아온$/u, to: '다', note: '아온→다' },
  { from: /어온$/u, to: '다', note: '어온→다' },
  { from: /여온$/u, to: '다', note: '여온→다' },
  { from: /힌$/u, to: '히다', note: '힌→히다' },
  { from: /된$/u, to: '되다', note: '된→되다' },
  { from: /었다$/u, to: '다', note: '었다→다' },
  { from: /았다$/u, to: '다', note: '았다→다' },
  { from: /였다$/u, to: '다', note: '였다→다' },
  { from: /는다$/u, to: '다', note: '는다→다' },
  { from: /ㄴ다$/u, to: '다', note: 'ㄴ다→다' },
  { from: /은$/u, to: '다', note: '은→다' },
  { from: /인$/u, to: '다', note: '인→다' },
  { from: /고$/u, to: '다', note: '고→다' },
  { from: /며$/u, to: '다', note: '며→다' },
  { from: /면$/u, to: '다', note: '면→다' },
];

export function normalizeKoSurface(raw: string): string {
  return raw.replace(/\s+/g, '').trim();
}

/** 按空白切分的划选片段（保留各词，便于短语命中） */
export function splitKoTokens(raw: string): string[] {
  return raw
    .split(/\s+/u)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** 剥一层最长匹配助词；返回 stem + 剥掉的助词 */
export function stripOneKoParticle(q: string): { stem: string; particle: string } | null {
  if (q.length < 2) return null;
  for (const p of KO_TRAILING_PARTICLES) {
    if (q.length > p.length && q.endsWith(p)) {
      return { stem: q.slice(0, -p.length), particle: p };
    }
  }
  return null;
}

/** 连续剥助词（最多 max 次） */
export function stripKoParticles(
  q: string,
  max = 2,
): { stem: string; particles: string[] } {
  let stem = q;
  const particles: string[] = [];
  for (let i = 0; i < max; i++) {
    const hit = stripOneKoParticle(stem);
    if (!hit || !hit.stem) break;
    particles.unshift(hit.particle);
    stem = hit.stem;
  }
  return { stem, particles };
}

/** 应用一条词尾规则，得到候选词典形 */
export function applyKoConjRules(q: string): { form: string; note: string }[] {
  const out: { form: string; note: string }[] = [];
  const seen = new Set<string>();
  const push = (form: string, note: string) => {
    if (!form || form === q || seen.has(form)) return;
    seen.add(form);
    out.push({ form, note });
  };

  for (const rule of KO_CONJ_RULES) {
    if (!rule.from.test(q)) continue;
    const form = q.replace(rule.from, rule.to);
    push(form, rule.note);
  }

  // 었/았/였 + 다 已在规则中；单独残留「먹었」→「먹다」
  if (/[었았였]$/u.test(q) && q.length >= 2) {
    push(`${q.slice(0, -1)}다`, '었/았/였→다');
  }

  // 너였잖아 → 剥确认语气后留下「너」
  if (/였잖아요?$/u.test(q) && q.length > 3) {
    const stem = q.replace(/였잖아요?$/u, '');
    if (stem) push(stem, '剥였잖아');
  }
  if (/이잖아요?$/u.test(q) && q.length > 3) {
    const stem = q.replace(/이잖아요?$/u, '');
    if (stem) push(stem, '剥이잖아');
  }

  return out;
}

/**
 * 生成查词候选（精确表面形优先，再缩约/助词剥离、词尾还原）。
 * 不含前缀枚举（前缀由查词侧对 index 探测）。
 */
export function koLookupCandidates(raw: string): { form: string; note: string }[] {
  const q = normalizeKoSurface(raw);
  if (!q) return [];
  const out: { form: string; note: string }[] = [];
  const seen = new Set<string>();
  const push = (form: string, note: string) => {
    if (!form || seen.has(form)) return;
    seen.add(form);
    out.push({ form, note });
  };

  push(q, 'exact');

  const contracted = KO_OBJECT_CONTRACTS[q];
  if (contracted) {
    push(contracted, `缩约宾格 ${q}→${contracted}`);
  }

  const { stem, particles } = stripKoParticles(q);
  if (stem !== q) {
    push(stem, particles.length ? `剥助词 ${particles.join('+')}` : '剥助词');
    const stemContract = KO_OBJECT_CONTRACTS[stem];
    if (stemContract) {
      push(stemContract, `剥助词+缩约→${stemContract}`);
    }
    for (const c of applyKoConjRules(stem)) {
      push(c.form, `${particles.join('+') || '剥助词'}+${c.note}`);
    }
  }

  for (const c of applyKoConjRules(q)) {
    push(c.form, c.note);
    const again = stripKoParticles(c.form);
    if (again.stem !== c.form) {
      push(again.stem, `${c.note}+剥助词`);
    }
  }

  return out;
}
