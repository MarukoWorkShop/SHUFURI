/**
 * codec HTML 结构 + normalize 包裹（导出分页前置条件）
 * 运行: npx tsx scripts/testPaginateCodecBody.mjs
 */
import { readFileSync } from 'fs';
import { compileDocument } from '../src/codec/compileDocument.ts';
import { normalizeLyricsBodyHtml } from '../src/services/lyricsHtml.ts';

const raw = readFileSync(new URL('./fixtures/akizakura-enc.txt', import.meta.url), 'utf8');
const { bodyHtml } = compileDocument(raw, { interfaceLanguage: 'zh' });
const normalized = normalizeLyricsBodyHtml(bodyHtml);

assert(normalized.includes('clip-body'), 'wrap clip-body');
assert((normalized.match(/lyrics-group/g) || []).length >= 20, 'lyrics-group preserved');
assert(normalized.includes('h3 class="grammar-point-title"'), 'grammar h3 shell');
assert(normalized.includes('grammar-title-ja'), 'grammar title span');
assert(normalized.includes('grammar-ex-ja'), 'grammar example class');
assert(!normalized.includes('grammar-line1'), 'no legacy grammar-line1');

console.log('OK');

function assert(cond, label) {
  if (!cond) {
    console.error('FAIL:', label);
    process.exit(1);
  }
}
