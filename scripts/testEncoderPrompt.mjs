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

console.log('OK');

function assert(cond, label) {
  if (!cond) {
    console.error('FAIL:', label);
    process.exit(1);
  }
}
