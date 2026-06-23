/**
 * pedagogical_example 不得抄歌词 — 编译前 lint
 * 运行: npx tsx scripts/testPedagogicalLint.mjs
 */
import { parseStream } from '../src/codec/parseStream.ts';
import { compileDocument } from '../src/codec/compileDocument.ts';
import {
  stripRubyPlain,
  warnPedagogicalLyricCopies,
} from '../src/codec/validatePedagogicalExamples.ts';

function captureWarn(fn) {
  const messages = [];
  const orig = console.warn;
  console.warn = (...args) => messages.push(args.join(' '));
  try {
    fn();
  } finally {
    console.warn = orig;
  }
  return messages;
}

const goodStream = `@0
H|歌手|歌名|jp
L|1|{淡:あわ}い{色:いろ}の{秋桜:コスモス}|淡い色の秋桜
@1
V|1|{秋桜:コスモス}|大波斯菊|1|{秋桜:コスモス}が{咲:さ}いた|秋桜が咲いた
@9`;

const badCopyStream = `@0
H|歌手|歌名|jp
L|1|{淡:あわ}い{色:いろ}の{秋桜:コスモス}|淡い色の秋桜
@1
V|1|{秋桜:コスモス}|大波斯菊|1|{淡:あわ}い{色:いろ}の{秋桜:コスモス}|抄歌词
@9`;

assert(stripRubyPlain('{淡:あわ}い{色:いろ}') === '淡い色', 'stripRubyPlain');

const goodDoc = parseStream(goodStream);
const goodWarns = captureWarn(() => warnPedagogicalLyricCopies(goodDoc));
assert(goodWarns.length === 0, 'new col6 sentence — no warn');

const badDoc = parseStream(badCopyStream);
const badWarns = captureWarn(() => warnPedagogicalLyricCopies(badDoc));
assert(badWarns.some((m) => m.includes('copies L lyric')), 'copied col6 — warn');

const compileWarns = captureWarn(() => compileDocument(badCopyStream));
assert(compileWarns.some((m) => m.includes('pedagogical_example')), 'compileDocument hooks lint');

console.log('OK');

function assert(cond, label) {
  if (!cond) {
    console.error('FAIL:', label);
    process.exit(1);
  }
}
