/**
 * 首页每日歌词摘录
 * 运行: npx tsx scripts/testHomeDailyLyricQuote.mjs
 */
import { Window } from 'happy-dom';
import { compileDocument } from '../src/codec/compileDocument.ts';
import { readFileSync } from 'fs';
import {
  createSeededRng,
  extractHomeLyricLines,
  pickHomeLyricExcerpt,
} from '../src/services/homeDailyLyricQuote.ts';

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;
globalThis.DOMParser = window.DOMParser;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const samplePath = new URL('./fixtures/akizakura-user-paste.txt', import.meta.url);
const raw = readFileSync(samplePath, 'utf8');
const compiled = compileDocument(raw);

const lines = extractHomeLyricLines(compiled.bodyHtml);
assert(lines.length >= 10, `应提取主歌行，got ${lines.length}`);
assert(!lines.some((l) => l.includes('回忆')), '不应含词解区教学句');
assert(lines[0]?.includes('秋桜') || lines[0]?.includes('コスモス'), '首行来自歌词');

const shortLines = ['一行', '两行', '三行'];
const shortExcerpt = pickHomeLyricExcerpt(shortLines, createSeededRng('test'));
assert(shortExcerpt?.lines.length === 3, '不足 4 行应整首展示');
assert(shortExcerpt?.startIndex === 0, '短歌 startIndex 为 0');

const rng = createSeededRng('excerpt-test');
const excerpt = pickHomeLyricExcerpt(lines, rng);
assert(excerpt, '长歌应能截取');
assert(excerpt.lines.length >= 1 && excerpt.lines.length <= 4, `句数 1–4，got ${excerpt.lines.length}`);
assert(
  lines.slice(excerpt.startIndex, excerpt.startIndex + excerpt.lines.length).join('|') ===
    excerpt.lines.join('|'),
  '应为连续行',
);

const dailyA = createSeededRng('2026-06-18');
const dailyB = createSeededRng('2026-06-18');
const dailyC = createSeededRng('2026-06-19');
assert(dailyA() === dailyB(), '同日 seed 可复现');
assert(dailyA() !== dailyC(), '不同日 seed 应不同');

console.log('testHomeDailyLyricQuote: OK');
