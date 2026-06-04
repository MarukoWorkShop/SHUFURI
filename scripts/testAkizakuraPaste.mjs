/**
 * 自测：豆包 Python 污染 + 秋樱完整结构化文本
 * 运行: npx tsx scripts/testAkizakuraPaste.mjs
 */
import { readFileSync } from 'fs';
import { cleanDoubaoPaste } from '../src/utils/cleanDoubaoPaste.ts';
import { parseStructuredLyricsText } from '../src/utils/structuredLyricsParser.ts';

const samplePath = new URL('./fixtures/akizakura-doubao-paste.txt', import.meta.url);
const raw = readFileSync(samplePath, 'utf8');

const cleaned = cleanDoubaoPaste(raw);
const parsed = parseStructuredLyricsText(cleaned);

const pairCount = (cleaned.match(/---PAIR---/gi) || []).length;
const groupCount = (parsed.bodyHtml.match(/class="lyrics-group"/g) || []).length;
const vocabCount = (parsed.bodyHtml.match(/class="lyrics-vocab-item"/g) || []).length;
const grammarCount = (parsed.bodyHtml.match(/class="lyrics-grammar-item"/g) || []).length;

console.log('cleaned starts with:', cleaned.split('\n')[0]);
console.log('title:', parsed.title, 'artist:', parsed.artist);
console.log('---PAIR--- in cleaned:', pairCount);
console.log('lyrics-group in html:', groupCount);
console.log('vocab items:', vocabCount);
console.log('grammar items:', grammarCount);

const ok =
  groupCount === 20 &&
  parsed.title === '秋樱' &&
  parsed.artist === '山口百惠' &&
  !/^import\s/.test(cleaned.split('\n')[0]);

if (!ok) {
  console.error('FAIL');
  process.exit(1);
}
console.log('OK');
