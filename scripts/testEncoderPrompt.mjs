/**
 * Encoder Prompt 禁止词 lint + 语言矩阵样例校验
 * 运行: npx tsx scripts/testEncoderPrompt.mjs
 */
import { buildEncoderPrompt } from '../src/codec/prompt/buildEncoderPrompt.ts';

const FORBIDDEN = /海报|手账|Shufuri|SHUFURI|===BEGIN===|===LYRICS===|===VOCAB===|===GRAMMAR===|Web_Retrieval|Module:/i;

const matrixZh = {
  interfaceLanguage: 'zh',
  learningTargetLanguages: ['jp', 'ko', 'en', 'zh'],
  activeTarget: 'jp',
};

const matrixEn = {
  interfaceLanguage: 'en',
  learningTargetLanguages: ['jp', 'ko', 'en', 'zh'],
  activeTarget: 'jp',
};

for (const lang of ['jp', 'ko', 'en', 'zh']) {
  const prompt = buildEncoderPrompt('歌手', '歌名', {
    includeVocabAndGrammar: true,
    matrix: { ...matrixZh, activeTarget: lang },
  });
  assert(prompt.includes('@0') && prompt.includes('@9'), `${lang} wire envelope`);
  assert(prompt.includes('@1') && prompt.includes('@2'), `${lang} section markers`);
  assert(/\nV\|1\|/.test(prompt), `${lang} vocab sample row`);
  assert(/\nG\|1\|/.test(prompt), `${lang} grammar sample row`);
  assert(/\|1\|[^\n]*\n@9/.test(prompt), `${lang} line ref before close`);
  assert(prompt.includes('STRICT_RAW'), `${lang} strict raw`);
  assert(prompt.includes('Column count integrity'), `${lang} column integrity`);
  assert(prompt.includes('exactly 6 |'), `${lang} V/G pipe count`);
  assert(prompt.includes('exactly 3 |'), `${lang} H/L pipe count`);
  assert(prompt.includes('lyric_line_no'), `${lang} lyric_line_no field`);
  assert(prompt.includes('pedagogical_example'), `${lang} pedagogical_example field`);
  assert(prompt.includes('do NOT copy L line verbatim'), `${lang} no copy L rule`);
  assert(!prompt.includes('V/G column 5'), `${lang} no wrong column 5 rule`);
  assert(!FORBIDDEN.test(prompt), `${lang} no forbidden words`);
  assert(!prompt.includes('JP:') || lang === 'jp', `${lang} isolated template`);
}

const lyricsOnly = buildEncoderPrompt('歌手', '歌名', {
  includeVocabAndGrammar: false,
  matrix: { ...matrixZh, activeTarget: 'jp' },
});
assert(!lyricsOnly.includes('@1\n'), 'lyrics-only omits @1 section');
assert(!/\nV\|/.test(lyricsOnly), 'lyrics-only omits V rows');
assert(lyricsOnly.includes('Column count integrity'), 'lyrics-only has column integrity');
assert(!lyricsOnly.includes('exactly 6 |'), 'lyrics-only omits V/G pipe count');
assert(lyricsOnly.includes('Do NOT emit @1'), 'lyrics-only forbids V/G in strict raw');

const jpEnInterface = buildEncoderPrompt('歌手', '歌名', {
  includeVocabAndGrammar: true,
  matrix: { ...matrixEn, activeTarget: 'jp' },
});
assert(jpEnInterface.includes('cosmos flowers bloomed'), 'en interface jp pedagogical sample');
assert(jpEnInterface.includes('cosmos flower'), 'en interface jp vocab in English');
assert(!jpEnInterface.includes('淡淡的秋樱'), 'en interface jp sample avoids Chinese line gloss');
assert(jpEnInterface.includes('NO Chinese in pedagogical fields'), 'en interface learner rule');

const jpZhInterface = buildEncoderPrompt('歌手', '歌名', {
  includeVocabAndGrammar: true,
  matrix: { ...matrixZh, activeTarget: 'jp' },
});
assert(jpZhInterface.includes('秋樱绽放了'), 'zh interface jp pedagogical trans');
assert(jpZhInterface.includes('Simplified Chinese line translation'), 'zh interface jp line rule');

const compliancePrompt = buildEncoderPrompt('歌手', '歌名', {
  includeVocabAndGrammar: true,
  matrix: { ...matrixZh, activeTarget: 'ko' },
});
assert(compliancePrompt.includes('Stream_Close'), 'stream close block');
assert(compliancePrompt.includes('Source_Integrity'), 'source integrity block');
assert(compliancePrompt.includes('NO hallucination'), 'anti-hallucination');
assert(compliancePrompt.includes('Model_Compliance'), 'model compliance block');
assert(compliancePrompt.includes('Tongyi/Qwen'), 'qwen hint');
assert(compliancePrompt.includes('H_metadata vs L_lyrics'), 'H vs L separation block');
assert(compliancePrompt.includes('NEVER skip L|1'), 'no skip L1 rule');
assert(compliancePrompt.includes('同文歌名'), 'title-equals-L1 sample');
assert(compliancePrompt.includes('do NOT skip L|1'), 'overlap sample clarifies L|1');
assert(compliancePrompt.includes('contiguous 1..N'), 'contiguous L indices in wire schema');
assert(compliancePrompt.includes(`H|col3 is exactly "歌名"`), 'self-check uses prompt title');

const zhPrompt = buildEncoderPrompt('周杰伦', '威廉古堡', {
  includeVocabAndGrammar: true,
  matrix: { ...matrixZh, activeTarget: 'zh' },
});
assert(zhPrompt.includes('[Zh_ruby'), 'zh ruby block');
assert(zhPrompt.includes('Forbidden alternating pattern'), 'zh alternating forbidden');
assert(zhPrompt.includes('{藤:téng}{蔓:màn}{植:zhí}{物:wù}'), 'zh correct ruby sample');
assert(zhPrompt.includes('ZERO CJK characters'), 'zh zero bare hanzi self-check');
assert(zhPrompt.includes('NO {汉字:拼音} ruby in pedagogical_example'), 'zh no example ruby');
assert(zhPrompt.includes('NEVER copy any L line verbatim'), 'zh no lyric copy in examples');
assert(zhPrompt.includes('never {A:py}B{B:py}'), 'zh qwen compliance hint');
assert(zhPrompt.includes('[Zh_grammar'), 'zh grammar label block');
assert(zhPrompt.includes('FORBIDDEN in col3: {满:了}'), 'zh grammar anti-sample');
assert(zhPrompt.includes('NO {汉字:拼音} ruby tokens in grammar_label'), 'zh grammar no ruby');

console.log('OK');

function assert(cond, label) {
  if (!cond) {
    console.error('FAIL:', label);
    process.exit(1);
  }
}
