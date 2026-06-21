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
