/**
 * 两步式 Prompt 阶段断言
 * 运行: npx tsx scripts/testEncoderPromptPhases.mjs
 */
import { buildEncoderPrompt } from '../src/codec/prompt/buildEncoderPrompt.ts';

const matrixZh = {
  interfaceLanguage: 'zh',
  learningTargetLanguages: ['jp', 'ko', 'en', 'zh'],
  activeTarget: 'jp',
};

const confirmed = `@0
H|山口百惠|秋樱|jp
L|1|{淡:あわ}い{色:いろ}の{秋桜:コスモス}|淡淡的秋樱
L|2|{咲:さ}いた|绽放
@9`;

// —— Step1 lyrics：强制仅 H+L，含完整性约束 ——
const lyrics = buildEncoderPrompt('山口百惠', '秋樱', {
  includeVocabAndGrammar: true, // 即使设置为 true，lyrics 阶段也必须忽略
  matrix: matrixZh,
  phase: 'lyrics',
});
assert(lyrics.includes('COMPLETENESS'), 'lyrics phase completeness');
assert(lyrics.includes('Do NOT emit @1'), 'lyrics phase forbids V/G');
assert(!/\nV\|/.test(lyrics), 'lyrics phase no V sample');
assert(!lyrics.includes('[Pedagogical_example'), 'lyrics phase no pedagogical');
assert(lyrics.includes('NEVER stop before the last sung line'), 'lyrics phase stream close');
assert(!lyrics.includes('[Confirmed_Lyrics'), 'lyrics phase no confirmed block');

// —— Step1 retry：追加 RETRY 警告 ——
const retry = buildEncoderPrompt('山口百惠', '秋樱', {
  includeVocabAndGrammar: false,
  matrix: matrixZh,
  phase: 'lyrics',
  retry: true,
});
assert(retry.includes('RETRY'), 'retry flag injected');
assert(retry.includes('COMPLETENESS'), 'retry still has completeness');

// —— Step2 study：回显确认歌词，要求 V/G ——
const study = buildEncoderPrompt('山口百惠', '秋樱', {
  includeVocabAndGrammar: true,
  matrix: matrixZh,
  phase: 'study',
  confirmedLyrics: confirmed,
});
assert(study.includes('[Confirmed_Lyrics'), 'study has confirmed block');
assert(study.includes('{淡:あわ}い{色:いろ}の{秋桜:コスモス}'), 'study echoes lyric text');
assert(study.includes('Do NOT search'), 'study forbids re-search');
assert(/\nV\|1\|/.test(study), 'study has V sample');
assert(/\nG\|1\|/.test(study), 'study has G sample');
assert(study.includes('[Pedagogical_example'), 'study has pedagogical');
assert(!study.includes('COMPLETENESS'), 'study skips lyrics completeness (already confirmed)');

// —— 默认 full：行为与历史一致（不注入 COMPLETENESS / Confirmed） ——
const full = buildEncoderPrompt('山口百惠', '秋樱', {
  includeVocabAndGrammar: true,
  matrix: matrixZh,
});
assert(!full.includes('COMPLETENESS'), 'full phase no completeness (compat)');
assert(!full.includes('[Confirmed_Lyrics'), 'full phase no confirmed');
assert(/\nV\|1\|/.test(full), 'full phase has V');
assert(full.includes('If token budget is tight'), 'full phase soft stream close');

console.log('OK');

function assert(cond, label) {
  if (!cond) {
    console.error('FAIL:', label);
    process.exit(1);
  }
}
