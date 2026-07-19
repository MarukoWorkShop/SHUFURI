/**
 * 韩语 lite 回归
 * 用法：npx tsx scripts/smokeKrdictLite.mts
 */
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { koLookupCandidates } from '../src/services/dict/koSurfaceNormalize.ts';
import {
  lookupKrdictAgainstIndex,
  type KrdictLiteEntry,
} from '../src/services/dict/krdictLite.ts';

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
  return map;
}

const cases = [
  { q: '노래를', expectHead: /노래/ },
  { q: '사랑해서', expectHead: /사랑/ },
  { q: '먹었습니다', expectHead: /먹/ },
  { q: '포수에게 잡혀온 잉어만', expectHead: /잡히다|잉어/ },
  { q: '잡혀온', expectHead: /잡히다/ },
  { q: '잉어만', expectHead: /잉어/ },
];

const buf = await readFile(GZ);
const json = gunzipSync(buf).toString('utf8');
const file = JSON.parse(json) as { n: number; entries: KrdictLiteEntry[] };
console.log(`loaded entries=${file.n} gzip=${(buf.length / 1e6).toFixed(2)}MB`);
const index = buildIndex(file.entries);

let failed = 0;
for (const c of cases) {
  const hit = lookupKrdictAgainstIndex(index, c.q);
  if (!hit || !c.expectHead.test(hit.entry.h)) {
    console.error('FAIL', c.q, hit);
    failed++;
  } else {
    console.log('OK', c.q, '→', hit.entry.h, `(${hit.via})`, hit.entry.g.slice(0, 40));
  }
}

const cand = koLookupCandidates('노래를');
if (!cand.some((x) => x.form === '노래')) {
  console.error('FAIL candidates missing 노래', cand);
  failed++;
} else {
  console.log('OK candidates 노래를 includes 노래');
}

process.exit(failed ? 1 : 0);
