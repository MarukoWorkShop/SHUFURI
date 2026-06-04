/**
 * 自测：---END===VOCAB=== 等区段粘连
 * 运行: npx tsx scripts/testGluedSectionsPaste.mjs
 */
import { readFileSync } from 'fs';
import { cleanDoubaoPaste } from '../src/utils/cleanDoubaoPaste.ts';
import { parseStructuredLyricsText } from '../src/utils/structuredLyricsParser.ts';

const samplePath = new URL('./fixtures/akizakura-glued-sections.txt', import.meta.url);
const raw = readFileSync(samplePath, 'utf8');

const cleaned = cleanDoubaoPaste(raw);
const parsed = parseStructuredLyricsText(cleaned);

const vocabCount = (parsed.bodyHtml.match(/class="lyrics-vocab-item"/g) || []).length;
const grammarCount = (parsed.bodyHtml.match(/class="lyrics-grammar-item"/g) || []).length;
const hasVocabSection = parsed.bodyHtml.includes('lyrics-vocabulary');
const hasGrammarSection = parsed.bodyHtml.includes('lyrics-grammar');

console.log('has VOCAB section:', hasVocabSection, 'items:', vocabCount);
console.log('has GRAMMAR section:', hasGrammarSection, 'items:', grammarCount);
console.log('title:', parsed.title, 'artist:', parsed.artist);

const ok =
  hasVocabSection &&
  hasGrammarSection &&
  vocabCount === 1 &&
  grammarCount === 1 &&
  parsed.title === '秋樱';

if (!ok) {
  console.error('FAIL');
  console.error('cleaned tail:\n', cleaned.slice(-400));
  process.exit(1);
}
console.log('OK');
