/**
 * 真实豆包输出：秋樱 25 行 + 8 词 + 5 语法
 * 运行: npx tsx scripts/testUserAkizakuraPaste.mjs
 */
import { readFileSync } from 'fs';
import { compileDocument } from '../src/codec/compileDocument.ts';
import { extractStudyCardsFromRaw } from '../src/studyCards/extractStudyCards.ts';
import { cleanDoubaoPaste } from '../src/utils/cleanDoubaoPaste.ts';

const raw = readFileSync(new URL('./fixtures/akizakura-user-paste.txt', import.meta.url), 'utf8');
const cleaned = cleanDoubaoPaste(raw);
const parsed = compileDocument(cleaned, { interfaceLanguage: 'zh' });

assert(parsed.title === '秋樱', 'title');
assert(parsed.artist === '山口百惠', 'artist');
assert(parsed.document.lyrics.length === 25, '25 lyrics');
assert(parsed.document.vocab.length === 8, '8 vocab');
assert(parsed.document.grammar.length === 5, '5 grammar');
assert((parsed.bodyHtml.match(/lyrics-group/g) || []).length === 25, '25 lyrics-group');
assert(parsed.bodyHtml.includes('<ruby>紅<rt>べに</rt></ruby>'), 'ruby L1');
assert(parsed.bodyHtml.includes('lyrics-vocabulary'), 'vocab section');
assert(parsed.bodyHtml.includes('lyrics-grammar'), 'grammar section');

const cards = extractStudyCardsFromRaw(cleaned, {
  bundleId: 'test',
  title: '秋樱',
  artist: '山口百惠',
});
assert(cards.length === 13, '13 study cards');
assert(cards.some((c) => c.kind === 'vocab' && c.lyricJaRaw?.includes('秋桜')), 'vocab line ref L1');

console.log('OK');

function assert(cond, label) {
  if (!cond) {
    console.error('FAIL:', label);
    process.exit(1);
  }
}
