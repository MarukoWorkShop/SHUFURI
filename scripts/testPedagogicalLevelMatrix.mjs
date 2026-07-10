/**
 * 词解/语法分级矩阵 + Prompt 块
 * 运行: npx tsx scripts/testPedagogicalLevelMatrix.mjs
 */
import { buildEncoderPrompt } from '../src/codec/prompt/buildEncoderPrompt.ts';
import { buildPedagogicalLevelBlock } from '../src/codec/prompt/pedagogicalLevel.ts';
import {
  PEDAGOGICAL_LEVEL_MATRIX,
  PEDAGOGICAL_LEVEL_ORDER,
  DEFAULT_PEDAGOGICAL_LEVEL,
  resolvePedagogicalLevel,
  pedagogicalLevelFrameworkDetail,
  pedagogicalLevelSettingsIntro,
} from '../src/services/pedagogicalLevel.ts';

const FRAMEWORK_MARKERS = {
  jp: 'JLPT',
  ko: 'TOPIK',
  en: 'CEFR',
  zh: 'HSK',
};

const BASELINE_JP_LEN = 5186;
const MAX_LEVEL_BLOCK_DELTA = 800;

for (const lang of ['jp', 'ko', 'en', 'zh']) {
  for (const level of PEDAGOGICAL_LEVEL_ORDER) {
    const spec = PEDAGOGICAL_LEVEL_MATRIX[lang][level];
    assert(spec.framework, `${lang}/${level} framework`);
    assert(spec.vocab, `${lang}/${level} vocab`);
    assert(spec.grammar, `${lang}/${level} grammar`);
    assert(spec.counts, `${lang}/${level} counts`);
    assert(spec.exampleStyle, `${lang}/${level} exampleStyle`);
    assert(spec.avoid, `${lang}/${level} avoid`);
  }
}

for (const lang of Object.keys(FRAMEWORK_MARKERS)) {
  const block = buildPedagogicalLevelBlock(lang, 'intermediate');
  assert(block.includes('[Pedagogical_Level]'), `${lang} block tag`);
  assert(block.includes(FRAMEWORK_MARKERS[lang]), `${lang} framework marker`);
  assert(block.includes('Level: intermediate'), `${lang} level line`);
}

assert(resolvePedagogicalLevel(undefined) === DEFAULT_PEDAGOGICAL_LEVEL, 'default intermediate');

assert(
  pedagogicalLevelSettingsIntro('zh').includes('JLPT / TOPIK / CEFR / HSK'),
  'zh settings intro',
);
assert(
  pedagogicalLevelFrameworkDetail('elementary', 'zh').includes('JLPT N5–N4'),
  'zh elementary detail',
);
assert(
  pedagogicalLevelFrameworkDetail('advanced', 'en').startsWith('Advanced:'),
  'en advanced detail',
);

const matrix = {
  interfaceLanguage: 'zh',
  learningTargetLanguages: ['jp', 'ko', 'en', 'zh'],
  activeTarget: 'jp',
};

const withLevel = buildEncoderPrompt('歌手', '歌名', {
  includeVocabAndGrammar: true,
  pedagogicalLevel: 'elementary',
  matrix,
});
assert(withLevel.includes('[Pedagogical_Level]'), 'prompt has level block');
assert(withLevel.includes('JLPT N5–N4'), 'jp elementary framework in prompt');
assert(withLevel.includes('[Pedagogical_Level]; [Sample] illustrates format only'), 'self check level');

const withoutVocab = buildEncoderPrompt('歌手', '歌名', {
  includeVocabAndGrammar: false,
  pedagogicalLevel: 'advanced',
  matrix,
});
assert(!withoutVocab.includes('[Pedagogical_Level]'), 'lyrics-only omits level block');

const defaultPrompt = buildEncoderPrompt('歌手', '歌名', {
  includeVocabAndGrammar: true,
  matrix,
});
assert(defaultPrompt.includes('Level: intermediate'), 'omitted level defaults intermediate');

const delta = defaultPrompt.length - BASELINE_JP_LEN;
assert(delta > 400 && delta < MAX_LEVEL_BLOCK_DELTA, `jp prompt delta ${delta} within budget`);

console.log('testPedagogicalLevelMatrix: OK');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
