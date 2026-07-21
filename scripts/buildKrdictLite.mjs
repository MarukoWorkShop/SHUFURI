/**
 * 从国立国语院 한국어기초사전（KRDICT）XML 构建浏览器用精简韩中词典。
 * 数据镜像：https://github.com/spellcheck-ko/korean-dict-nikl （CC-BY-SA 2.0 KR）
 * 产出：public/dict/krdict-lite.json.gz
 *
 * 用法：
 *   node scripts/buildKrdictLite.mjs
 *   node scripts/buildKrdictLite.mjs /path/to/krdict-xml-dir
 *
 * 首次优先：若本机已有 XML 目录可传参跳过下载：
 *   node scripts/buildKrdictLite.mjs /path/to/krdict-xml
 * 或 shallow clone 后构建：
 *   git clone --depth 1 https://github.com/spellcheck-ko/korean-dict-nikl.git tmp/korean-dict-nikl
 *   node scripts/buildKrdictLite.mjs tmp/korean-dict-nikl/krdict
 *
 * 无本地源时脚本会下载 ~390MB XML 到 tmp/krdict-xml/（已 gitignore），带重试。
 */

import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_GZ = join(ROOT, 'public/dict/krdict-lite.json.gz');
const CACHE_DIR = join(ROOT, 'tmp/krdict-xml');
const RAW_BASE =
  'https://raw.githubusercontent.com/spellcheck-ko/korean-dict-nikl/master/krdict';
const XML_FILES = [
  '001.xml',
  '002.xml',
  '003.xml',
  '004.xml',
  '005.xml',
  '006.xml',
  '007.xml',
  '008.xml',
  '009.xml',
  '010.xml',
  '011.xml',
];

const LEVEL_RANK = { 초급: 0, 중급: 1, 고급: 2 };

const POS_ZH = {
  명사: '名词',
  대명사: '代词',
  수사: '数词',
  동사: '动词',
  형용사: '形容词',
  관형사: '冠形词',
  부사: '副词',
  감탄사: '感叹词',
  조사: '助词',
  의존명사: '依存名词',
  보조동사: '补助动词',
  보조형용사: '补助形容词',
  어미: '词尾',
  접사: '词缀',
  품사없음: '词',
};

function feat(block, att) {
  const re = new RegExp(
    `<feat\\s+att="${att}"\\s+val="([^"]*)"\\s*/>|<feat\\s+att="${att}"\\s+val='([^']*)'\\s*/>`,
  );
  const m = block.match(re);
  return m ? (m[1] ?? m[2] ?? '').trim() : '';
}

function decodeXml(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");
}

function extractEquivalentGloss(entry, language) {
  const eqBlocks = entry.match(/<Equivalent>[\s\S]*?<\/Equivalent>/g) || [];
  for (const eq of eqBlocks) {
    if (!eq.includes(`val="${language}"`) && !eq.includes(`val='${language}'`)) {
      continue;
    }
    const lemma = decodeXml(feat(eq, 'lemma'));
    const def = decodeXml(feat(eq, 'definition'));
    const parts = [];
    if (lemma) parts.push(lemma.split(/[;；,，]/)[0].trim());
    if (def) parts.push(def.replace(/\s+/g, ' ').trim());
    const g = parts.filter(Boolean).join('；');
    if (g) return g.slice(0, 80);
  }
  return '';
}

/** 韩语 Sense 释义（无外语 Equivalent 时的兜底） */
function extractKoreanSenseGloss(entry) {
  const senseBlocks = entry.match(/<Sense\b[\s\S]*?<\/Sense>/g) || [];
  for (const sense of senseBlocks) {
    const def = decodeXml(feat(sense, 'definition'));
    if (def) return `（韩义）${def.replace(/\s+/g, ' ').trim()}`.slice(0, 80);
  }
  // 少数条目 definition 不在 Sense 包裹内
  const loose = entry.match(
    /<Sense\b[^>]*>\s*<feat\s+att="definition"\s+val="([^"]*)"/,
  );
  if (loose?.[1]) {
    return `（韩义）${decodeXml(loose[1]).replace(/\s+/g, ' ').trim()}`.slice(0, 80);
  }
  return '';
}

/**
 * 释义优先级：中文 Equivalent → 英语 Equivalent → 韩语 Sense。
 * 不再因缺少中文义丢弃整条（此前会导致 항상／하나 等基础词缺失）。
 */
function extractGloss(entry) {
  return (
    extractEquivalentGloss(entry, '중국어') ||
    extractEquivalentGloss(entry, '영어') ||
    extractKoreanSenseGloss(entry) ||
    ''
  );
}

function glossRank(g) {
  if (!g) return 9;
  if (g.startsWith('（韩义）')) return 2;
  // 英义粗判：无 CJK 且含拉丁字母
  if (/[A-Za-z]/.test(g) && !/[\u4e00-\u9fff]/.test(g)) return 1;
  return 0; // 中文优先
}

function parseEntry(entry) {
  const lemmaBlock = entry.match(/<Lemma>[\s\S]*?<\/Lemma>/)?.[0] || '';
  const head = decodeXml(feat(lemmaBlock, 'writtenForm'));
  if (!head) return null;

  const posKo = feat(entry, 'partOfSpeech') || '품사없음';
  const level = feat(entry, 'vocabularyLevel') || '';
  const pronBlock =
    entry.match(/<WordForm>[\s\S]*?<feat att="type" val="발음"[\s\S]*?<\/WordForm>/)?.[0] ||
    entry.match(/<WordForm>[\s\S]*?<\/WordForm>/)?.[0] ||
    '';
  const reading = decodeXml(feat(pronBlock, 'pronunciation')) || head;
  const gloss = extractGloss(entry);
  if (!gloss) return null;

  const forms = [head];
  // 하다 动词也索引去掉 하다 的词根，利于前缀命中
  if (head.endsWith('하다') && head.length > 2) {
    const stem = head.slice(0, -2);
    if (stem && !forms.includes(stem)) forms.push(stem);
  }

  return {
    f: forms,
    h: head,
    r: reading,
    p: POS_ZH[posKo] || posKo || '词',
    g: gloss,
    _level: level,
    _glossRank: glossRank(gloss),
  };
}

async function downloadWithRetry(url, dest, retries = 5) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      console.log(i === 0 ? `Downloading ${url}` : `Retry ${i}/${retries - 1} ${url}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Download failed ${url}: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(dest, buf);
      console.log('wrote', dest.split('/').pop(), `${(buf.length / 1e6).toFixed(1)}MB`);
      return;
    } catch (err) {
      lastErr = err;
      console.warn('download error:', err?.cause?.code || err?.message || err);
      // 部分失败时删掉残缺文件
      try {
        const { unlink } = await import('node:fs/promises');
        await unlink(dest);
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw lastErr;
}

async function ensureXmlCached(dir) {
  await mkdir(dir, { recursive: true });
  for (const name of XML_FILES) {
    const dest = join(dir, name);
    if (existsSync(dest)) {
      const { statSync } = await import('node:fs');
      const sz = statSync(dest).size;
      if (sz > 1_000_000) {
        console.log('cached', name, `${(sz / 1e6).toFixed(1)}MB`);
        continue;
      }
      console.log('cached too small, re-download', name);
    }
    const url = `${RAW_BASE}/${name}`;
    await downloadWithRetry(url, dest);
  }
}

function* entryBlocks(xml) {
  const re = /<LexicalEntry[\s\S]*?<\/LexicalEntry>/g;
  let m;
  while ((m = re.exec(xml))) {
    yield m[0];
  }
}

async function buildFromDir(dir) {
  const byHead = new Map();
  const files = (await readdir(dir)).filter((n) => n.endsWith('.xml')).sort();
  if (!files.length) throw new Error(`No XML in ${dir}`);

  for (const name of files) {
    console.log('Parsing', name);
    const xml = await readFile(join(dir, name), 'utf8');
    let n = 0;
    for (const block of entryBlocks(xml)) {
      n++;
      const row = parseEntry(block);
      if (!row) continue;
      const prev = byHead.get(row.h);
      if (!prev) {
        byHead.set(row.h, row);
        continue;
      }
      const pr = LEVEL_RANK[prev._level] ?? 9;
      const cr = LEVEL_RANK[row._level] ?? 9;
      if (cr < pr) {
        byHead.set(row.h, row);
        continue;
      }
      if (cr === pr && (row._glossRank ?? 9) < (prev._glossRank ?? 9)) {
        byHead.set(row.h, row);
      }
    }
    console.log('  blocks', n, 'unique so far', byHead.size);
  }

  const ranked = [...byHead.values()].sort((a, b) => {
    const la = LEVEL_RANK[a._level] ?? 9;
    const lb = LEVEL_RANK[b._level] ?? 9;
    if (la !== lb) return la - lb;
    const ga = a._glossRank ?? 9;
    const gb = b._glossRank ?? 9;
    if (ga !== gb) return ga - gb;
    return a.h.localeCompare(b.h, 'ko');
  });

  // 收录有释义的条目（中文优先，其次英语，再次韩语 Sense）；上限防爆
  const MAX = 80000;
  const picked = ranked.slice(0, MAX).map(({ _level, _glossRank, ...rest }) => rest);

  return {
    v: 1,
    src: 'krdict-nikl-cc-by-sa-2.0-kr',
    date: new Date().toISOString().slice(0, 10),
    license: 'CC-BY-SA 2.0 KR',
    attribution: '국립국어원 한국어기초사전 (Korean Basic Dictionary)',
    n: picked.length,
    entries: picked,
  };
}

async function main() {
  const argDir = process.argv[2];
  let dir = argDir;
  if (!dir) {
    await ensureXmlCached(CACHE_DIR);
    dir = CACHE_DIR;
  }

  const lite = await buildFromDir(dir);
  const json = JSON.stringify(lite);
  await mkdir(dirname(OUT_GZ), { recursive: true });
  await pipeline(Readable.from([json]), createGzip({ level: 9 }), createWriteStream(OUT_GZ));
  console.log(`Wrote ${OUT_GZ}`);
  console.log(
    `entries=${lite.n} uncompressed≈${(json.length / 1e6).toFixed(2)}MB gzip≈file`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
