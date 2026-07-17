/**
 * lyricConfirm 辅助函数单测
 * 运行: npx tsx scripts/testLyricConfirm.mjs
 */
import {
  getLyricConfirmPreview,
  isLyricsOnlyStream,
  isStudyEnrichedStream,
} from '../src/utils/lyricConfirm.ts';

const lyricsOnly = `@0
H|山口百惠|秋樱|jp
L|1|{淡:あわ}い{色:いろ}|淡
L|2|{咲:さ}いた|绽放
@9`;

const withStudy = `@0
H|山口百惠|秋樱|jp
L|1|{淡:あわ}い{色:いろ}|淡
@1
V|1|{秋桜:コスモス}|花|1|例|译
@9`;

assert(isLyricsOnlyStream(lyricsOnly), 'lyrics-only detected');
assert(!isStudyEnrichedStream(lyricsOnly), 'lyrics-only not enriched');
assert(!isLyricsOnlyStream(withStudy), 'with-study not lyrics-only');
assert(isStudyEnrichedStream(withStudy), 'with-study enriched');

const preview = getLyricConfirmPreview(lyricsOnly);
assert(preview, 'preview exists');
assert(preview.title === '秋樱', 'preview title');
assert(preview.artist === '山口百惠', 'preview artist');
assert(preview.lineCount === 2, 'preview lineCount');
assert(preview.lines[0].text === '淡い色', 'ruby stripped in preview');
assert(preview.cleanedStream.includes('@0'), 'cleaned stream kept');

assert(getLyricConfirmPreview('not a stream') === null, 'non-stream → null');

console.log('OK');

function assert(cond, label) {
  if (!cond) {
    console.error('FAIL:', label);
    process.exit(1);
  }
}
