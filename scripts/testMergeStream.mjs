/**
 * mergeConfirmedLyricsWithStudy 单测
 * 运行: npx tsx scripts/testMergeStream.mjs
 */
import { mergeConfirmedLyricsWithStudy } from '../src/codec/mergeStream.ts';
import { parseStream } from '../src/codec/parseStream.ts';

const confirmed = `@0
H|山口百惠|秋樱|jp
L|1|{淡:あわ}い{色:いろ}の{秋桜:コスモス}|淡淡的秋樱
L|2|{咲:さ}いた|绽放
@9`;

// 第二步粘贴：AI 回显了 H+L（可能被篡改），并补了 V/G
const study = `@0
H|山口百惠|秋樱|jp
L|1|篡改的歌词|错误翻译
L|2|又是错的|错
@1
V|1|{秋桜:コスモス}|大波斯菊|1|{秋桜:コスモス}が{咲:さ}いた|秋樱绽放了
V|2|{淡:あわ}い|淡的|9|例句|例
@2
G|1|の（的）|表示领属|1|{秋桜:コスモス}の{花:はな}|秋樱的花
@9`;

const r = mergeConfirmedLyricsWithStudy(confirmed, study);

// 歌词必须来自 confirmed，屏蔽 study 的篡改
assert(r.merged.includes('{淡:あわ}い{色:いろ}の{秋桜:コスモス}|淡淡的秋樱'), '歌词逐字回显 confirmed');
assert(!r.merged.includes('篡改的歌词'), '屏蔽 study 篡改的歌词');
assert(r.lyricCount === 2, `lyricCount=2 (got ${r.lyricCount})`);
assert(r.vocabCount === 2, `vocabCount=2 (got ${r.vocabCount})`);
assert(r.grammarCount === 1, `grammarCount=1 (got ${r.grammarCount})`);

// V|2 的 col5=9 越界 → 清空并计入 droppedRefs
assert(r.droppedRefs === 1, `droppedRefs=1 (got ${r.droppedRefs})`);
assert(r.merged.includes('V|2|{淡:あわ}い|淡的||例句|例'), 'V2 越界引用被清空');

// 结果可被完整解析
const doc = parseStream(r.merged);
assert(doc.lyrics.length === 2, 'parsed lyrics 2');
assert(doc.vocab.length === 2, 'parsed vocab 2');
assert(doc.grammar.length === 1, 'parsed grammar 1');
assert(doc.closed, 'parsed closed');

// 仅 V/G 粘贴（无 H），也能合并
const studyVGOnly = `@1
V|1|term|meaning|1|example|trans
@2
G|1|label|detail|2|gex|gtrans
@9`;
const r2 = mergeConfirmedLyricsWithStudy(confirmed, studyVGOnly);
const doc2 = parseStream(r2.merged);
assert(doc2.lyrics.length === 2, 'VG-only: lyrics 2');
assert(doc2.vocab.length === 1, 'VG-only: vocab 1');
assert(doc2.grammar.length === 1, 'VG-only: grammar 1');

// V/G 序号重排为连续
const studyGap = `@1
V|5|a|b|1|c|d
V|8|e|f|2|g|h
@9`;
const r3 = mergeConfirmedLyricsWithStudy(confirmed, studyGap);
assert(/\nV\|1\|/.test(r3.merged) && /\nV\|2\|/.test(r3.merged), 'V 序号重排 1..N');

// 字段内字面量 | 转义往返
const studyPipe = `@1
V|1|a\\|b|mean|1|ex|tr
@9`;
const r4 = mergeConfirmedLyricsWithStudy(confirmed, studyPipe);
const doc4 = parseStream(r4.merged);
assert(doc4.vocab[0].term === 'a|b', 'escaped pipe round-trip');

// 缺 L 抛错
let threw = false;
try {
  mergeConfirmedLyricsWithStudy('@0\nH|a|b|jp\n@9', study);
} catch {
  threw = true;
}
assert(threw, '无 L 行时抛错');

console.log('OK');

function assert(cond, label) {
  if (!cond) {
    console.error('FAIL:', label);
    process.exit(1);
  }
}
