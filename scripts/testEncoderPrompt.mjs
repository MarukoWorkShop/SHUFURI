/**
 * Encoder Prompt 禁止词 lint
 * 运行: npx tsx scripts/testEncoderPrompt.mjs
 */
import { buildEncoderPrompt } from '../src/codec/prompt/buildEncoderPrompt.ts';

const FORBIDDEN = /海报|手账|Shufuri|SHUFURI|===BEGIN===|===LYRICS===|===VOCAB===|===GRAMMAR===|Web_Retrieval|Module:/i;

const matrix = {
  interfaceLanguage: 'zh',
  learningTargetLanguages: ['jp', 'ko', 'en', 'zh'],
  activeTarget: 'jp',
};

for (const lang of ['jp', 'ko', 'en', 'zh']) {
  const prompt = buildEncoderPrompt('歌手', '歌名', {
    includeVocabAndGrammar: true,
    matrix: { ...matrix, activeTarget: lang },
  });
  assert(prompt.includes('@0') && prompt.includes('@9'), `${lang} wire envelope`);
  assert(prompt.includes('@1') && prompt.includes('@2'), `${lang} section markers`);
  assert(/\nV\|1\|/.test(prompt), `${lang} vocab sample row`);
  assert(/\nG\|1\|/.test(prompt), `${lang} grammar sample row`);
  assert(/\|1\|\n@9/.test(prompt), `${lang} line ref before close`);
  assert(prompt.includes('STRICT_RAW') || prompt.includes('禁止'), `${lang} strict raw`);
  assert(!FORBIDDEN.test(prompt), `${lang} no forbidden words`);
  assert(!prompt.includes('JP:') || lang === 'jp', `${lang} isolated template`);
}

const lyricsOnly = buildEncoderPrompt('歌手', '歌名', {
  includeVocabAndGrammar: false,
  matrix: { ...matrix, activeTarget: 'jp' },
});
assert(!lyricsOnly.includes('@1'), 'lyrics-only omits @1');
assert(!/\nV\|/.test(lyricsOnly), 'lyrics-only omits V rows');

console.log('OK');

function assert(cond, label) {
  if (!cond) {
    console.error('FAIL:', label);
    process.exit(1);
  }
}
