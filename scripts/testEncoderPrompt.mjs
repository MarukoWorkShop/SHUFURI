/**
 * Encoder Prompt 禁止词 lint + 语言矩阵样例校验
 * 运行: npx tsx scripts/testEncoderPrompt.mjs
 */
import { buildEncoderPrompt } from '../src/codec/prompt/buildEncoderPrompt.ts';

const FORBIDDEN = /海报|手账|Shufuri|SHUFURI|===BEGIN===|===LYRICS===|===VOCAB===|===GRAMMAR===|Web_Retrieval|Module:/i;
const MAX_ZH_PROMPT_CHARS = 12000;
const MAX_DUPLICATE_LINE_COUNT = 2;

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

function normalizeLine(line) {
  return line.replace(/\s+/g, ' ').trim().toLowerCase();
}

function lintDuplicateLines(prompt, minLen = 24) {
  const counts = new Map();
  for (const raw of prompt.split('\n')) {
    const line = normalizeLine(raw);
    if (line.length < minLen) continue;
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  const dupes = [...counts.entries()].filter(([, n]) => n > MAX_DUPLICATE_LINE_COUNT);
  if (dupes.length > 0) {
    throw new Error(`duplicate prompt lines > ${MAX_DUPLICATE_LINE_COUNT}: ${dupes[0][0]}`);
  }
}

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
  assert(prompt.includes('[Wire_Schema]'), `${lang} wire schema`);
  assert(prompt.includes('exactly 6 |'), `${lang} V/G pipe count`);
  assert(prompt.includes('exactly 3 |'), `${lang} H/L pipe count`);
  assert(prompt.includes('lyric_line_no'), `${lang} lyric_line_no field`);
  assert(prompt.includes('pedagogical_example'), `${lang} pedagogical_example field`);
  assert(prompt.includes('pedagogical_translation'), `${lang} pedagogical_translation field`);
  assert(prompt.includes('[Pedagogical_example'), `${lang} pedagogical example block`);
  if (lang === 'jp') {
    assert(prompt.includes('[Jp_ruby]'), `${lang} jp ruby block`);
  } else {
    assert(!prompt.includes('[Jp_ruby]'), `${lang} no jp ruby block`);
  }
  assert(prompt.includes('[Study_cards'), `${lang} study cards citation block`);
  assert(prompt.includes('Study cards NEVER use pedagogical_example'), `${lang} study vs poster split`);
  assert(prompt.includes('FORBIDDEN: copying'), `${lang} no lyric copy in pedagogical`);
  assert(!prompt.includes('NEVER copy lyric lines'), `${lang} learner deduped col6 rule`);
  assert(prompt.includes('differs from every L|n|col3'), `${lang} self check col6 vs lyrics`);
  assert(!prompt.includes('[Zh_pedagogical]'), `${lang} no dead zh pedagogical ref`);
  assert(!prompt.includes('V/G column 5'), `${lang} no wrong column 5 rule`);
  assert(!FORBIDDEN.test(prompt), `${lang} no forbidden words`);
  assert(!prompt.includes('JP:') || lang === 'jp', `${lang} isolated template`);
  assert(prompt.includes('H col4 (lang code)'), `${lang} H col4 lang code`);
  assert(!prompt.includes('H column 3 MUST be'), `${lang} no wrong H col3 lang`);
  assert(!prompt.includes('[Integrity]'), `${lang} no legacy integrity block`);
  assert(prompt.includes('[Self_Check'), `${lang} self check block`);
  assert(prompt.includes('search web for'), `${lang} lyrics search instruction`);
  assert(prompt.includes('not memory recall'), `${lang} self check anti-memory`);
  assert(!prompt.includes('[Sample — H title equals'), `${lang} no overlap sample block`);
  assert(!prompt.includes('EX_ZH MUST'), `${lang} no EX_ZH in learner`);
  lintDuplicateLines(prompt);
}

const lyricsOnly = buildEncoderPrompt('歌手', '歌名', {
  includeVocabAndGrammar: false,
  matrix: { ...matrixZh, activeTarget: 'jp' },
});
assert(!lyricsOnly.includes('@1\n'), 'lyrics-only omits @1 section');
assert(!/\nV\|/.test(lyricsOnly), 'lyrics-only omits V rows');
assert(lyricsOnly.includes('[Wire_Schema]'), 'lyrics-only has wire schema');
assert(!lyricsOnly.includes('exactly 6 |'), 'lyrics-only omits V/G pipe count');
assert(!lyricsOnly.includes('[Pedagogical_example'), 'lyrics-only omits pedagogical block');
assert(lyricsOnly.includes('Do NOT emit @1'), 'lyrics-only forbids V/G in strict raw');
assert(!lyricsOnly.includes('[Zh_pedagogical]'), 'lyrics-only no dead zh pedagogical ref');

const jpEnInterface = buildEncoderPrompt('歌手', '歌名', {
  includeVocabAndGrammar: true,
  matrix: { ...matrixEn, activeTarget: 'jp' },
});
assert(jpEnInterface.includes('cosmos flowers bloomed'), 'en interface jp pedagogical sample');
assert(jpEnInterface.includes('cosmos flower'), 'en interface jp vocab in English');
assert(!jpEnInterface.includes('淡淡的秋樱'), 'en interface jp sample avoids Chinese line gloss');
assert(jpEnInterface.includes('NO Chinese in pedagogical fields'), 'en interface learner rule');
assert(jpEnInterface.includes('L column 4 = natural English line translation'), 'jp active only one L col4 rule');
assert(!jpEnInterface.includes('jp/ko: column 4'), 'jp active no multi-lang L col4 list');

const jpZhInterface = buildEncoderPrompt('歌手', '歌名', {
  includeVocabAndGrammar: true,
  matrix: { ...matrixZh, activeTarget: 'jp' },
});
assert(jpZhInterface.includes('秋樱绽放了'), 'zh interface jp pedagogical trans');
assert(jpZhInterface.includes('L column 4 = Simplified Chinese line translation'), 'zh interface jp line rule');

const compliancePrompt = buildEncoderPrompt('歌手', '歌名', {
  includeVocabAndGrammar: true,
  matrix: { ...matrixZh, activeTarget: 'ko' },
});
assert(compliancePrompt.includes('Stream_Close'), 'stream close block');
assert(compliancePrompt.includes('Source_Integrity'), 'source integrity block');
assert(compliancePrompt.includes('Model_Compliance'), 'model compliance block');
assert(compliancePrompt.includes('H_metadata vs L_lyrics'), 'H vs L separation block');
assert(compliancePrompt.includes('NEVER skip L|1'), 'no skip L1 rule');
assert(compliancePrompt.includes('同文歌名'), 'overlap inline example');
assert(compliancePrompt.includes('contiguous 1..N'), 'contiguous L indices in wire schema');

const ocrPrompt = buildEncoderPrompt('歌手', '歌名', {
  includeVocabAndGrammar: true,
  matrix: { ...matrixZh, activeTarget: 'ko' },
  ocrContext: { songTitle: 'OCR标题', firstLyricLine: '首句' },
});
assert(ocrPrompt.includes('Context hints do NOT override'), 'ocr override guard');
assert(ocrPrompt.indexOf('[Source_Integrity]') < ocrPrompt.indexOf('[Context]'), 'ocr after source');
assert(ocrPrompt.includes('Anchor line'), 'ocr anchor in source integrity');

const zhPrompt = buildEncoderPrompt('周杰伦', '威廉古堡', {
  includeVocabAndGrammar: true,
  matrix: { ...matrixZh, activeTarget: 'zh' },
});
assert(zhPrompt.includes('[Zh_ruby'), 'zh ruby block');
assert(zhPrompt.includes('[Pedagogical_example]'), 'zh column map refs pedagogical block');
assert(!zhPrompt.includes('[Zh_pedagogical]'), 'zh no dead pedagogical ref');
assert(zhPrompt.includes('[Zh_column_map]'), 'zh column map');
assert(zhPrompt.includes('{藤:téng}{蔓:màn}'), 'zh correct ruby pattern in samples or rules');
assert(zhPrompt.includes('NO {汉字:拼音} ruby in grammar_label'), 'zh grammar no ruby');
assert(zhPrompt.includes('plain Hanzi only'), 'zh pedagogical plain hanzi note');
assert(zhPrompt.length < MAX_ZH_PROMPT_CHARS, 'zh prompt length budget');
assert(zhPrompt.includes('L column 4 = leave empty'), 'zh active only zh L col4 rule');
assert(!zhPrompt.includes('jp/ko: column 4'), 'zh active no multi-lang L col4 list');

const zhZhIfacePrompt = buildEncoderPrompt('周杰伦', '威廉古堡', {
  includeVocabAndGrammar: true,
  matrix: { ...matrixZh, activeTarget: 'zh' },
});
assert(zhZhIfacePrompt.includes('像（比喻标记）'), 'zh iface grammar chinese parens');
assert(!zhZhIfacePrompt.includes('像 (simile marker)'), 'zh iface no english grammar example');

const zhEnIfacePrompt = buildEncoderPrompt('周杰伦', '威廉古堡', {
  includeVocabAndGrammar: true,
  matrix: { ...matrixEn, activeTarget: 'zh' },
});
assert(zhEnIfacePrompt.includes('像 (simile marker)'), 'en iface grammar english parens');

const zhSampleMatch = zhZhIfacePrompt.match(/V\|1\|[^\n]+/);
assert(zhSampleMatch, 'zh sample V row');
const zhVFields = zhSampleMatch[0].split('|');
assert(zhVFields[6] !== zhVFields[7], 'zh sample V col6 != col7');

const qwenPrompt = buildEncoderPrompt('周杰伦', '威廉古堡', {
  includeVocabAndGrammar: true,
  matrix: { ...matrixZh, activeTarget: 'zh' },
  modelHint: 'qwen',
});
assert(qwenPrompt.includes('Tongyi/Qwen'), 'qwen model hint injected');

const deepseekPrompt = buildEncoderPrompt('周杰伦', '威廉古堡', {
  includeVocabAndGrammar: true,
  matrix: { ...matrixZh, activeTarget: 'zh' },
  modelHint: 'deepseek',
});
assert(deepseekPrompt.includes('search official lyrics'), 'deepseek search hint');
assert(!deepseekPrompt.includes('Tongyi/Qwen'), 'deepseek no qwen hint');

console.log('OK');

function assert(cond, label) {
  if (!cond) {
    console.error('FAIL:', label);
    process.exit(1);
  }
}
