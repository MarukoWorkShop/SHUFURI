/**
 * 自测：秋樱 ENC 记录流
 * 运行: npx tsx scripts/testAkizakuraPaste.mjs
 */
import { readFileSync } from 'fs';
import { compileDocument } from '../src/codec/compileDocument.ts';

const samplePath = new URL('./fixtures/akizakura-enc.txt', import.meta.url);
const raw = readFileSync(samplePath, 'utf8');

const parsed = compileDocument(raw);

const groupCount = (parsed.bodyHtml.match(/class="lyrics-group"/g) || []).length;
const vocabCount = (parsed.bodyHtml.match(/class="lyrics-vocab-item"/g) || []).length;
const grammarCount = (parsed.bodyHtml.match(/class="lyrics-grammar-item"/g) || []).length;

console.log('starts with:', raw.split('\n')[0]);
console.log('title:', parsed.title, 'artist:', parsed.artist);
console.log('lyrics-group in html:', groupCount);
console.log('vocab items:', vocabCount);
console.log('grammar items:', grammarCount);

const ok =
  groupCount === 20 &&
  parsed.title === '秋樱' &&
  parsed.artist === '山口百惠' &&
  vocabCount === 2 &&
  grammarCount === 1;

if (!ok) {
  console.error('FAIL');
  process.exit(1);
}
console.log('OK');
