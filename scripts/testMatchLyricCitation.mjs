/**
 * 词卡：lyric_line_no 引用 + 海报 pedagogical 分离
 * 运行: npx tsx scripts/testMatchLyricCitation.mjs
 */
import { readFileSync } from 'fs';
import { compileDocument } from '../src/codec/compileDocument.ts';
import { extractStudyCardsFromRaw } from '../src/studyCards/extractStudyCards.ts';

const samplePath = new URL('./fixtures/akizakura-enc.txt', import.meta.url);
const raw = readFileSync(samplePath, 'utf8');

const parsed = compileDocument(raw);

assert(parsed.bodyHtml.includes('回忆浮上心头'), '海报词解：教学造句释义');
assert(/lyrics-vocab-item[\s\S]*?回忆浮上心头/.test(parsed.bodyHtml), '海报词解区教学造句');
assert(!/lyrics-vocab-item[\s\S]*?ゆれます/.test(parsed.bodyHtml), '海报词解区非歌词行4');
assert(parsed.bodyHtml.includes('vocab-ex-ja') && parsed.bodyHtml.includes('側'), '海报语法：教学造句');

const cards = extractStudyCardsFromRaw(raw, { bundleId: 'test', title: '秋樱', artist: '山口百惠' });
const vocabOmoide = cards.find((c) => c.kind === 'vocab' && c.sourceRaw?.includes('想'));
const grammarBa = cards.find((c) => c.kind === 'grammar');

assert(vocabOmoide?.lyricJaRaw?.includes('ゆれます'), '词卡：思い出出典为歌词行4');
assert(grammarBa?.lyricJaRaw?.includes('側'), '词卡：语法出典为歌词行7');

const badLyricNo = raw.replace(
  'V|2|{想:おも}い{出:だ}|回忆，回想|4|',
  'V|2|{想:おも}い{出:だ}|回忆，回想|0|',
);
const cardsBadNo = extractStudyCardsFromRaw(badLyricNo, { bundleId: 'test-bad-no' });
assert(cardsBadNo.length >= 2, 'lyric_line_no=0 时仍应生成词汇卡');

console.log('OK');

function assert(cond, label) {
  if (!cond) {
    console.error('FAIL:', label);
    process.exit(1);
  }
}
