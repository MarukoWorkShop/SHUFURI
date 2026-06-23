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

const zhRaw = `@0
H|测试|晴天|zh
L|1|{故:gù}{事:shì}{的:de}{小:xiǎo}{黄:huáng}{花:huā}|故事的小黄花
L|2|{窗:chuāng}外{有:you}一{只:zhī}{鸟:niǎo}|窗外有一只鸟
@1
V|1|{黄:huáng}{花:huā}|小黄花|1|窗外开着小黄花|路边开着小黄花
@2
G|1|的（的）|表示领属|1|这是老师的书|这是老师的教材
@9`;
const zhCards = extractStudyCardsFromRaw(zhRaw, { bundleId: 'test-zh', title: '晴天', lang: 'zh' });
const zhVocab = zhCards.find((c) => c.kind === 'vocab');
assert(zhVocab?.lyricJaRaw?.includes('故'), 'zh 词卡：例句来自歌词行1而非 col6');
assert(!zhVocab?.lyricJaRaw?.includes('窗外开着'), 'zh 词卡：不使用 pedagogical col6');

const koRaw = `@0
H|아이유|Blueming|ko
L|1|우리만의 블루밍|我们专属的 blooming
@1
V|1|블루밍|blooming|1|꽃이 블루밍했다|the flowers bloomed
@9`;
const koCards = extractStudyCardsFromRaw(koRaw, { bundleId: 'test-ko', title: 'Blueming', lang: 'ko' });
assert(koCards[0]?.lyricJaRaw?.includes('우리만의'), 'ko 词卡：例句来自歌词行1');

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
