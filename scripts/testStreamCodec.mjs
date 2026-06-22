/**
 * 流式密文 codec 单元测试
 * 运行: npx tsx scripts/testStreamCodec.mjs
 */
import { readFileSync } from 'fs';
import { splitStreamColumns } from '../src/codec/splitStreamColumns.ts';
import { normalizeCodecRuby } from '../src/codec/normalizeCodecRuby.ts';
import { parseStream } from '../src/codec/parseStream.ts';
import { resolveExampleRef } from '../src/codec/resolveExampleRef.ts';
import { compileDocument } from '../src/codec/compileDocument.ts';
import { stripMarkdownFences } from '../src/codec/stripStreamEnvelope.ts';
import {
  autoAppendStreamCloseIfNeeded,
  normalizeStreamInput,
  truncateAfterStreamClose,
} from '../src/codec/repairStreamEnvelope.ts';

const encPath = new URL('./fixtures/akizakura-enc.txt', import.meta.url);
const enc = readFileSync(encPath, 'utf8');

assert(splitStreamColumns('L|1|含字面量\\|竖线|gloss')[2] === '含字面量|竖线', 'unescape column pipe');
assert(splitStreamColumns('V|1|term|mean|4|ped|trans').length === 7, 'seven V/G fields');

assert(normalizeCodecRuby('{秋桜:コスモス}') === '{秋桜|コスモス}', 'codec ruby normalize');

const fenced = '```text\n@0\nH|a|b|jp\n@9\n```';
assert(stripMarkdownFences(fenced).startsWith('@0'), 'strip fences');

const doc = parseStream(enc);
assert(doc.header.lang === 'jp', 'header lang');
assert(doc.lyrics.length === 20, '20 lyric lines');
assert(doc.vocab.length === 2, '2 vocab rows');
assert(doc.grammar.length === 1, '1 grammar row');
assert(doc.closed, 'closed with @9');
assert(doc.vocab[1]?.lyricLineNo === '4', 'vocab lyric line no');
assert(doc.vocab[1]?.pedagogicalExample.includes('浮'), 'vocab pedagogical example');
assert(doc.grammar[0]?.lyricLineNo === '7', 'grammar lyric line no');

const ex = resolveExampleRef('4', '', doc.lyrics);
assert(ex.cite === 'lyric' && ex.primary.includes('ゆれます'), 'line ref 4 lyric');

try {
  resolveExampleRef('999', '', doc.lyrics);
  fail('invalid line ref should throw');
} catch {
  // ok
}

const compiled = compileDocument(enc);
assert(compiled.bodyHtml.includes('class="lyrics-group"'), 'lyrics-group wrapper');
assert(compiled.bodyHtml.includes('class="zh-line"'), 'zh-line secondary');
assert(compiled.bodyHtml.includes('回忆浮上心头'), 'poster vocab pedagogical translation');
assert(/lyrics-vocab-item[\s\S]*?vocab-ex-zh[\s\S]*?回忆浮上心头/.test(compiled.bodyHtml), 'vocab item pedagogical');
assert(!/lyrics-vocab-item[\s\S]*?ゆれます/.test(compiled.bodyHtml), 'vocab item not lyric line 4');
assert(compiled.bodyHtml.includes('只要在身边就好'), 'poster grammar pedagogical translation');
assert(compiled.title === '秋樱', 'title');

const qwenNoClose = `@0
H|잔나비|주저하는 연인들을 위해|ko
L|1|나는 읽기 쉬운 마음이야|我是一颗很容易被读懂的心
@1
V|1|훑다|扫视、翻阅|2|책을 훑어보다|浏览书籍
@2
G|1|grammar（语法）|说明|1|example|例句`;
const qwenFixed = normalizeStreamInput(qwenNoClose);
assert(qwenFixed.endsWith('@9'), 'auto-append @9 for qwen-style paste');
assert(parseStream(qwenNoClose).closed, 'parse qwen without @9 after repair');

const withPostscript = `@0
H|a|b|ko
L|1|hello|你好
@9
以上是根据歌曲整理的内容`;
assert(!truncateAfterStreamClose(withPostscript).includes('以上'), 'truncate after @9');
assert(parseStream(withPostscript).closed, 'parse with postscript after @9');

const partialWithProse = `@0
H|a|b|ko
L|1|hello|你好

希望对您有帮助`;
assert(!autoAppendStreamCloseIfNeeded(partialWithProse).includes('@9'), 'no append when prose tail');

const doubaoIntact = enc.trim();
assert(normalizeStreamInput(doubaoIntact) === doubaoIntact, 'doubao fixture unchanged');

console.log('OK');

function assert(cond, label) {
  if (!cond) {
    console.error('FAIL:', label);
    process.exit(1);
  }
}
function fail(label) {
  console.error('FAIL:', label);
  process.exit(1);
}
