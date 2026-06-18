/**
 * 词卡：V/G 例句行号引用
 * 运行: npx tsx scripts/testMatchLyricCitation.mjs
 */
import { readFileSync } from 'fs';
import { compileDocument } from '../src/codec/compileDocument.ts';
import { extractStudyCardsFromRaw } from '../src/studyCards/extractStudyCards.ts';

const samplePath = new URL('./fixtures/akizakura-enc.txt', import.meta.url);
const raw = readFileSync(samplePath, 'utf8');

const parsed = compileDocument(raw);

assert(parsed.bodyHtml.includes('ゆれます'), '海报词解：思い出用歌词句');
assert(!parsed.bodyHtml.includes('浮かんだ'), '海报词解：不含 AI 造句');
assert(parsed.bodyHtml.includes('vocab-ex-ja') && parsed.bodyHtml.includes('側'), '海报语法：行号例句');

const cards = extractStudyCardsFromRaw(raw, { bundleId: 'test', title: '秋樱', artist: '山口百惠' });
const vocabOmoide = cards.find((c) => c.kind === 'vocab' && c.sourceRaw?.includes('想'));
const grammarBa = cards.find((c) => c.kind === 'grammar');

assert(vocabOmoide?.lyricJaRaw?.includes('ゆれます'), '词卡：思い出出典为歌词');
assert(grammarBa?.lyricJaRaw?.includes('側'), '词卡：语法行号例句');

console.log('OK');

function assert(cond, label) {
  if (!cond) {
    console.error('FAIL:', label);
    process.exit(1);
  }
}
