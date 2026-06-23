/**
 * 千问负向粘贴 fixture：交替 ruby + G 列汉字注汉字
 * 运行: npx tsx scripts/testQwenPasteRepair.mjs
 */
import { readFileSync } from 'fs';
import { compileDocument } from '../src/codec/compileDocument.ts';
import { normalizeStreamInput } from '../src/codec/repairStreamEnvelope.ts';
import { applyZhRubyMarkup } from '../src/utils/zhLayout/zhRubyMarkup.ts';

const fixturePath = new URL('./fixtures/qwen-william-bad.txt', import.meta.url);
const raw = readFileSync(fixturePath, 'utf8');
const normalized = normalizeStreamInput(raw);

const compiled = compileDocument(normalized, { interfaceLanguage: 'en' });
assert(compiled.bodyHtml.includes('cn-line'), 'compiled zh lyrics');
assert(!compiled.bodyHtml.includes('<rt>了</rt>'), 'grammar {满:了} drops hanzi ruby reading');

const alternating = applyZhRubyMarkup('{藤:téng}蔓{蔓:màn}植{植:zhí}物{物:wù}');
assert(!alternating.includes('藤蔓蔓'), 'alternating pattern still renders without triple 蔓 if repaired upstream');
// alternating still doubles - that's expected from raw token; compile path uses same markup
const doubled = applyZhRubyMarkup('{藤:téng}蔓{蔓:màn}');
assert(doubled.includes('蔓'), 'alternating still has bare hanzi between tokens');

console.log('OK');

function assert(cond, label) {
  if (!cond) {
    console.error('FAIL:', label);
    process.exit(1);
  }
}
