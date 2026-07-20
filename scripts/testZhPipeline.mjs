import { buildEncoderPrompt } from '../src/codec/prompt/buildEncoderPrompt.ts';
import { buildLanguageMatrixContext } from '../src/services/languageMatrix/index.ts';
import { compileDocument } from '../src/codec/compileDocument.ts';
import { applyZhRubyMarkup, expandZhRubyForTest } from '../src/utils/zhLayout/zhRubyMarkup.ts';

const ZH_SAMPLE_BULK = `@0
H|测试|整词拆分|zh
L|1|{爬满了伯爵的坟墓:pá mǎn le bó jué de fén mù}|
@9`;

const ZH_SAMPLE_ZH = `@0
H|周杰伦|威廉古堡|zh
L|1|{森:sēn}林{里:lǐ}的{城堡:chéngbǎo}|
@1
V|1|{城堡:chéngbǎo}|大型防御性建筑|1|{那:nà}{座:zuò}{古:gǔ}{老:lǎo}{的:de}{城:chéng}{堡:bǎo}{矗:chù}{立:lì}{在:zài}{山:shān}{顶:dǐng}|古老的城堡矗立在山顶
@9`;

const ZH_SAMPLE_EN = `@0
H|周杰伦|威廉古堡|zh
L|1|{森:sēn}林{里:lǐ}的{城堡:chéngbǎo}|In the forest castle
@9`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const matrixZh = buildLanguageMatrixContext({
  colorTheme: 'mono',
  defaultIncludeVocabAndGrammar: true,
  interfaceLanguage: 'zh',
  learningTargetLanguages: ['zh'],
  lyricsLanguage: 'zh',
  interactionSoundsEnabled: true,
});

const promptZh = buildEncoderPrompt('周杰伦', '威廉古堡', {
  includeVocabAndGrammar: true,
  matrix: matrixZh,
});
assert(!promptZh.includes('JP:'), 'zh prompt must not contain JP:');
assert(!promptZh.includes('Rule_1'), 'zh prompt must not use JP ruby rules');
assert(promptZh.includes('[Lang: zh]'), 'zh prompt must target zh');
assert(promptZh.includes('Interface: zh'), 'zh native gloss rule');

const matrixEn = { ...matrixZh, interfaceLanguage: 'en' };
const promptEn = buildEncoderPrompt('周杰伦', '威廉古堡', {
  includeVocabAndGrammar: false,
  matrix: matrixEn,
});
assert(promptEn.includes('gloss'), 'en interface zh song must mention gloss');

const parsed = compileDocument(ZH_SAMPLE_ZH, { interfaceLanguage: 'zh' });
assert(parsed.lang === 'zh', 'parsed lang must be zh');
assert(parsed.bodyHtml.includes('cn-line'), 'must emit cn-line');
assert(parsed.bodyHtml.includes('vocab-word-cn'), 'zh vocab uses vocab-word-cn class');
assert(parsed.bodyHtml.includes('<ruby>'), 'must emit ruby markup');
assert(parsed.bodyHtml.includes('古老的城堡'), 'pedagogical example plain hanzi');
assert(/<p class="vocab-ex-cn">[\s\S]*?<ruby>/.test(parsed.bodyHtml), 'vocab example has pinyin ruby');
assert(parsed.bodyHtml.includes('<rt>chéng</rt>') || parsed.bodyHtml.includes('chéngbǎo') || /vocab-ex-cn[\s\S]*?<rt>/.test(parsed.bodyHtml), 'vocab example rt has latin pinyin');
assert(!parsed.bodyHtml.includes('gloss-line'), 'zh interface sample has no gloss line');

const parsedEn = compileDocument(ZH_SAMPLE_EN, { interfaceLanguage: 'en' });
assert(parsedEn.bodyHtml.includes('gloss-line'), 'en gloss sample must have gloss-line');

const bulkHtml = applyZhRubyMarkup('{爬满了伯爵的坟墓|pá mǎn le bó jué de fén mù}');
const rubyCount = (bulkHtml.match(/<ruby>/g) || []).length;
assert(rubyCount >= 1, 'bulk ruby markup');
assert(expandZhRubyForTest('森', 'sēn').includes('sēn'), 'expand zh ruby');
assert(!expandZhRubyForTest('满', '了').includes('<rt>'), 'hanzi-only reading skips ruby');
assert(expandZhRubyForTest('满', '了').includes('满'), 'hanzi-only reading keeps base');

const grammarBad = compileDocument(
  `@0
H|测试|语法|zh
@1
G|1|{满:了} (resultative complement)|indicates completion|2|{爬:pá}{满:mǎn}{了:le}{坟:fén}{墓:mù}|crawled all over
@9`,
  { interfaceLanguage: 'en' },
);
assert(!grammarBad.bodyHtml.includes('<rt>了</rt>'), 'grammar label rejects hanzi ruby reading');
assert(/<p class="grammar-ex-cn">[\s\S]*?<rt>pá<\/rt>/.test(grammarBad.bodyHtml), 'grammar example keeps latin pinyin');

const vocabBadEx = compileDocument(
  `@0
H|测试|例句|zh
@1
V|1|{荒:huāng}{芜:wú}|荒凉|1|{郊:郊}{外:外}{的:的}荒芜|郊外荒芜
@9`,
  { interfaceLanguage: 'zh' },
);
assert(!/<p class="vocab-ex-cn">[\s\S]*?<rt>郊<\/rt>/.test(vocabBadEx.bodyHtml), 'vocab example drops Hanzi-as-reading');
assert(vocabBadEx.bodyHtml.includes('郊外'), 'vocab example keeps base Hanzi when reading invalid');

const bulkParsed = compileDocument(ZH_SAMPLE_BULK, { interfaceLanguage: 'zh' });
assert(bulkParsed.bodyHtml.includes('cn-line'), 'bulk zh line compiled');

console.log('OK');
