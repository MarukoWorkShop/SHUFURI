/**
 * 浏览器端韩语形态分析（garu-ko WASM）。
 * 模型：public/dict/garu/base.gmdl（~1.4MB）；WASM 由 npm 包打包。
 * 失败时由 krdictLite 回退到假分词。
 */

export type GaruKoToken = {
  text: string;
  pos: string;
  start: number;
  end: number;
};

export type GaruLemmaCandidate = {
  form: string;
  pos: string;
  surface: string;
  note: string;
};

type GaruInstance = {
  analyze: (text: string) => { tokens: GaruKoToken[] };
  destroy: () => void;
  isLoaded: () => boolean;
};

const MODEL_URL = './dict/garu/base.gmdl';

let loadPromise: Promise<GaruInstance> | null = null;
let garuRef: GaruInstance | null = null;

/** 内容词 POS（用于查词典；助词/词尾不优先） */
const CONTENT_POS = new Set([
  'NNG',
  'NNP',
  'NNB',
  'NR',
  'NP',
  'VV',
  'VA',
  'VX',
  'MAG',
  'MAJ',
  'XR',
]);

export function isGaruKoReady(): boolean {
  return garuRef != null && garuRef.isLoaded();
}

/** 预加载（开启划词时调用） */
export function ensureGaruKoLoaded(): Promise<GaruInstance> {
  if (garuRef?.isLoaded()) return Promise.resolve(garuRef);
  if (!loadPromise) {
    loadPromise = (async () => {
      const { Garu } = await import('garu-ko/browser');
      const instance = (await Garu.load({ modelUrl: MODEL_URL })) as GaruInstance;
      garuRef = instance;
      return instance;
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }
  return loadPromise;
}

export async function analyzeKorean(text: string): Promise<GaruKoToken[]> {
  const q = text.replace(/\s+/g, ' ').trim();
  if (!q) return [];
  const garu = await ensureGaruKoLoaded();
  const result = garu.analyze(q);
  return result?.tokens ?? [];
}

/**
 * 将 Garu 形态素还原为 KRDICT 可查词典形。
 * VV/VA/VX：词干 +「다」；NNG/XR + XSV「하」→「…하다」。
 * 另：었잖아 整块误标时补剥代词；受益补助「주」保留 주다。
 */
export function lemmasFromGaruTokens(tokens: GaruKoToken[]): GaruLemmaCandidate[] {
  const out: GaruLemmaCandidate[] = [];
  const seen = new Set<string>();

  const push = (form: string, pos: string, surface: string, note: string) => {
    const trimmed = form.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push({ form: trimmed, pos, surface, note });
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const next = tokens[i + 1];

    // 너였잖아 被标成整块 NNG 时：剥确认语气
    if (/였잖아요?$/u.test(t.text) && t.text.length > 3) {
      const stem = t.text.replace(/였잖아요?$/u, '');
      if (stem) push(stem, 'NP', t.text, 'Garu 剥였잖아');
    }
    if (/이잖아요?$/u.test(t.text) && t.text.length > 3) {
      const stem = t.text.replace(/이잖아요?$/u, '');
      if (stem) push(stem, 'NP', t.text, 'Garu 剥이잖아');
    }

    if (
      (t.pos === 'NNG' || t.pos === 'XR') &&
      next?.pos === 'XSV' &&
      next.text === '하'
    ) {
      push(`${t.text}하다`, 'VV', `${t.text}${next.text}`, 'Garu N+하→하다');
      push(t.text, t.pos, t.text, `Garu ${t.pos}`);
      continue;
    }

    // 영원하 + ㄴ → 영원하다（形容词）
    if (
      (t.pos === 'NNG' || t.pos === 'XR') &&
      next?.pos === 'XSA' &&
      next.text === '하'
    ) {
      push(`${t.text}하다`, 'VA', `${t.text}${next.text}`, 'Garu N+하→하다(形)');
      push(t.text, t.pos, t.text, `Garu ${t.pos}`);
      continue;
    }

    if (t.pos === 'VV' || t.pos === 'VA' || t.pos === 'VX') {
      const lemma = t.text.endsWith('다') ? t.text : `${t.text}다`;
      push(lemma, t.pos, t.text, `Garu ${t.pos}→다`);
      continue;
    }

    if (CONTENT_POS.has(t.pos)) {
      push(t.text, t.pos, t.text, `Garu ${t.pos}`);
    }
  }

  return out;
}

/** 供 Node smoke：直接注入 analyze 结果，不依赖浏览器 fetch 模型路径 */
export function lemmasFromAnalyzeText(
  analyze: (text: string) => { tokens: GaruKoToken[] },
  text: string,
): GaruLemmaCandidate[] {
  const q = text.replace(/\s+/g, ' ').trim();
  if (!q) return [];
  return lemmasFromGaruTokens(analyze(q).tokens ?? []);
}
