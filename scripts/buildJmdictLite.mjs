/**
 * 从 jmdict-simplified「eng-common」构建浏览器用精简词典。
 * 产出：public/dict/jmdict-lite.json.gz
 *
 * 用法：
 *   node scripts/buildJmdictLite.mjs
 *   node scripts/buildJmdictLite.mjs /path/to/jmdict-eng-common-*.json
 */
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_GZ = join(ROOT, 'public/dict/jmdict-lite.json.gz');
const DEFAULT_URL =
  'https://github.com/scriptin/jmdict-simplified/releases/download/3.6.2%2B20260713141310/jmdict-eng-common-3.6.2%2B20260713141310.json.zip';

const POS = {
  n: '名词',
  pn: '代名词',
  vs: 'サ变动词',
  vt: '他动词',
  vi: '自动词',
  'adj-i': 'い形容词',
  'adj-na': 'な形容词',
  'adj-no': 'の形容词',
  'adj-pn': '连体词',
  'adj-t': 'たる形容词',
  'adj-f': '名词性形容词',
  'adj-ix': 'い形容词',
  adv: '副词',
  'adv-to': 'と副词',
  aux: '助动词',
  'aux-v': '助动词',
  'aux-adj': '助动词',
  conj: '接续词',
  cop: '断定词',
  ctr: '助数词',
  exp: '惯用表达',
  int: '感叹词',
  num: '数词',
  pref: '接头',
  suf: '接尾',
  prt: '助词',
  v1: '一段动词',
  v5u: '五段动词',
  v5k: '五段动词',
  v5g: '五段动词',
  v5s: '五段动词',
  v5t: '五段动词',
  v5n: '五段动词',
  v5b: '五段动词',
  v5m: '五段动词',
  v5r: '五段动词',
  vk: 'カ变动词',
  vz: 'ズル动词',
  'v5aru': '五段动词',
  'v5k-s': '五段动词',
  'v5r-i': '五段动词',
  'vs-i': 'サ变动词',
  'vs-s': 'サ变动词',
};

function posLabel(tags) {
  const seen = [];
  for (const t of tags) {
    const lab = POS[t];
    if (!lab || seen.includes(lab)) continue;
    seen.push(lab);
    if (seen.length >= 2) break;
  }
  return seen.length ? seen.join('·') : tags[0] || '词';
}

function buildLite(data) {
  const entries = [];
  for (const w of data.words || []) {
    const kanjiList = (w.kanji || []).map((k) => k.text).filter(Boolean);
    const kanaList = (w.kana || []).map((k) => k.text).filter(Boolean);
    if (!kanjiList.length && !kanaList.length) continue;
    const senses = w.sense || [];
    if (!senses.length) continue;

    const head = kanjiList[0] || kanaList[0];
    const reading = kanaList[0] || '';
    const pos = posLabel(senses[0].partOfSpeech || []);
    const glosses = [];
    for (const s of senses.slice(0, 2)) {
      for (const g of (s.gloss || []).slice(0, 3)) {
        const t = String(g.text || '').trim();
        if (t && !glosses.includes(t)) glosses.push(t);
        if (glosses.length >= 3) break;
      }
      if (glosses.length >= 3) break;
    }

    const forms = [];
    for (const t of [...kanjiList, ...kanaList]) {
      if (t && !forms.includes(t)) forms.push(t);
      if (forms.length >= 6) break;
    }

    entries.push({
      f: forms,
      h: head,
      r: reading,
      p: pos,
      g: glosses.join('; '),
    });
  }

  return {
    v: 1,
    src: `jmdict-eng-common-${data.version || 'unknown'}`,
    date: data.dictDate || null,
    n: entries.length,
    entries,
  };
}

async function loadSourceJson(pathOrUrl) {
  if (pathOrUrl && !/^https?:/i.test(pathOrUrl)) {
    return JSON.parse(await readFile(pathOrUrl, 'utf8'));
  }

  const url = pathOrUrl || DEFAULT_URL;
  console.log('Downloading', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  // Prefer unzip via system if zip; else treat as json
  if (url.endsWith('.zip') || buf[0] === 0x50) {
    const tmp = join(ROOT, 'tmp-jmdict-src.zip');
    await writeFile(tmp, buf);
    const { execFileSync } = await import('node:child_process');
    const outDir = join(ROOT, 'tmp-jmdict-src');
    execFileSync('rm', ['-rf', outDir], { stdio: 'inherit' });
    execFileSync('mkdir', ['-p', outDir], { stdio: 'inherit' });
    execFileSync('unzip', ['-o', tmp, '-d', outDir], { stdio: 'inherit' });
    const { readdirSync } = await import('node:fs');
    const jsonName = readdirSync(outDir).find((n) => n.endsWith('.json'));
    if (!jsonName) throw new Error('No JSON in zip');
    const json = JSON.parse(await readFile(join(outDir, jsonName), 'utf8'));
    execFileSync('rm', ['-rf', tmp, outDir], { stdio: 'inherit' });
    return json;
  }

  return JSON.parse(buf.toString('utf8'));
}

async function main() {
  const arg = process.argv[2];
  const data = await loadSourceJson(arg);
  const lite = buildLite(data);
  const json = JSON.stringify(lite);
  await mkdir(dirname(OUT_GZ), { recursive: true });
  await pipeline(Readable.from([json]), createGzip({ level: 9 }), createWriteStream(OUT_GZ));
  console.log(`Wrote ${OUT_GZ}`);
  console.log(`entries=${lite.n} uncompressed≈${(json.length / 1e6).toFixed(2)}MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
