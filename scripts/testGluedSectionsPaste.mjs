/**
 * 自测：记录流 V/G 段解析
 * 运行: npx tsx scripts/testGluedSectionsPaste.mjs
 */
import { compileDocument } from '../src/codec/compileDocument.ts';

const raw = `@0
H|山口百惠|秋樱|jp
L|1|{淡:あわ}い{色:いろ}|淡淡的
@1
V|1|{秋桜:コスモス}|秋樱|1|
@2
G|1|ば形（假定形）|详解|1|译
@9`;

const parsed = compileDocument(raw);
const vocabCount = (parsed.bodyHtml.match(/class="lyrics-vocab-item"/g) || []).length;
const grammarCount = (parsed.bodyHtml.match(/class="lyrics-grammar-item"/g) || []).length;

const ok =
  parsed.bodyHtml.includes('lyrics-vocabulary') &&
  parsed.bodyHtml.includes('lyrics-grammar') &&
  vocabCount === 1 &&
  grammarCount === 1 &&
  parsed.title === '秋樱';

if (!ok) {
  console.error('FAIL');
  process.exit(1);
}
console.log('OK');
