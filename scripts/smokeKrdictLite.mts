/**
 * 韩语 lite 回归（假分词 + Garu 形态分析）
 * 用法：npx tsx scripts/smokeKrdictLite.mts
 */
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Garu } from 'garu-ko';
import { lemmasFromGaruTokens } from '../src/services/dict/garuKoTokenizer.ts';
import { koLookupCandidates } from '../src/services/dict/koSurfaceNormalize.ts';
import {
  lookupKrdictAgainstIndex,
  lookupViaGaruLemmas,
  type KrdictLiteEntry,
} from '../src/services/dict/krdictLite.ts';
import { mergeKrdictSeedPatches } from '../src/services/dict/krdictSeedPatches.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GZ = join(ROOT, 'public/dict/krdict-lite.json.gz');

function buildIndex(entries: KrdictLiteEntry[]): Map<string, KrdictLiteEntry> {
  const map = new Map<string, KrdictLiteEntry>();
  for (const e of entries) {
    for (const form of e.f) {
      if (!form || map.has(form)) continue;
      map.set(form, e);
    }
  }
  mergeKrdictSeedPatches(map);
  return map;
}

const heuristicCases = [
  { q: '노래를', expectHead: /노래/ },
  { q: '사랑해서', expectHead: /사랑/ },
  { q: '먹었습니다', expectHead: /먹/ },
  { q: '포수에게 잡혀온 잉어만', expectHead: /잡히다|잉어/ },
  { q: '잡혀온', expectHead: /잡히다/ },
  { q: '잉어만', expectHead: /잉어/ },
  { q: '하나', expectHead: /하나/ },
  { q: '항상', expectHead: /항상/ },
  { q: '곁', expectHead: /곁/ },
  { q: '지키다', expectHead: /지키/ },
];

/** Garu 应还原到更精确的词典形；短语划选给局部参考 */
const garuCases = [
  { q: '노래를', expectHead: '노래' },
  { q: '사랑해서', expectHead: '사랑하다' },
  { q: '먹었습니다', expectHead: '먹다' },
  { q: '잡혀온', expectHead: '잡히다' },
  { q: '잉어만', expectHead: '잉어' },
  { q: '배가 아파서 약을 먹었다', expectHead: /아프다|먹다|약|배|局部参考/ },
  { q: '예뻐서', expectHead: '예쁘다' },
  { q: '날 믿어준', expectMulti: /믿다|나/ },
  { q: '날 믿어준 너였잖아', expectMulti: /믿다|나|너/ },
  { q: '너였잖아', expectHead: /너/ },
  { q: '믿어준', expectHead: /믿다/ },
  { q: '하나', expectHead: '하나' },
  { q: '영원한 행복을', expectMulti: /영원하다|행복/ },
  { q: '행복', expectHead: '행복' },
  { q: '항상', expectHead: '항상' },
  { q: '너의 곁에서', expectMulti: /너|곁/ },
];

const heuristicExtra = [
  { q: '믿어준', expectHead: /믿/ },
  { q: '날', expectForm: '나' },
  { q: '너였잖아', expectForm: '너' },
];

const buf = await readFile(GZ);
const json = gunzipSync(buf).toString('utf8');
const file = JSON.parse(json) as { n: number; entries: KrdictLiteEntry[] };
console.log(`loaded entries=${file.n} gzip=${(buf.length / 1e6).toFixed(2)}MB`);
const index = buildIndex(file.entries);

let failed = 0;

for (const c of heuristicCases) {
  const hit = lookupKrdictAgainstIndex(index, c.q);
  if (!hit || !c.expectHead.test(hit.entry.h)) {
    console.error('FAIL heuristic', c.q, hit);
    failed++;
  } else {
    console.log('OK heuristic', c.q, '→', hit.entry.h, `(${hit.via})`);
  }
}

for (const c of heuristicExtra) {
  if (c.expectForm) {
    const cand = koLookupCandidates(c.q);
    if (!cand.some((x) => x.form === c.expectForm)) {
      console.error('FAIL candidates', c.q, 'missing', c.expectForm, cand);
      failed++;
    } else {
      console.log('OK candidates', c.q, 'includes', c.expectForm);
    }
    continue;
  }
  const hit = lookupKrdictAgainstIndex(index, c.q);
  if (!hit || !c.expectHead?.test(hit.entry.h)) {
    console.error('FAIL heuristicExtra', c.q, hit);
    failed++;
  } else {
    console.log('OK heuristicExtra', c.q, '→', hit.entry.h, `(${hit.via})`);
  }
}

const cand = koLookupCandidates('노래를');
if (!cand.some((x) => x.form === '노래')) {
  console.error('FAIL candidates missing 노래', cand);
  failed++;
} else {
  console.log('OK candidates 노래를 includes 노래');
}

const garu = await Garu.load();
for (const c of garuCases) {
  const tokens = garu.analyze(c.q).tokens;
  const lemmas = lemmasFromGaruTokens(tokens);
  const hit = lookupViaGaruLemmas(index, lemmas, c.q);
  let ok = false;
  if (c.expectMulti) {
    const blob = `${hit?.entry.h ?? ''} ${hit?.entry.g ?? ''} ${hit?.via ?? ''}`;
    ok = Boolean(hit && c.expectMulti.test(blob));
  } else if (typeof c.expectHead === 'string') {
    ok = Boolean(hit && hit.entry.h === c.expectHead);
  } else if (c.expectHead) {
    const blob = `${hit?.entry.h ?? ''} ${hit?.entry.g ?? ''}`;
    ok = Boolean(hit && c.expectHead.test(blob));
  }
  if (!ok) {
    console.error(
      'FAIL garu',
      c.q,
      'tokens=',
      tokens.map((t) => `${t.text}/${t.pos}`).join('|'),
      'lemmas=',
      lemmas.map((l) => l.form),
      'hit=',
      hit,
    );
    failed++;
  } else {
    console.log(
      'OK garu',
      c.q,
      '→',
      hit!.entry.h,
      `(${hit!.via})`,
      c.expectMulti ? hit!.entry.g.slice(0, 60) : '',
    );
  }
}
garu.destroy();

process.exit(failed ? 1 : 0);
