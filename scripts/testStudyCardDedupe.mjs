/**
 * 学习卡全局去重键与过滤规则
 * 运行: npx tsx scripts/testStudyCardDedupe.mjs
 */
import {
  filterStudyCardDraftsForInsert,
  studyCardCanonicalTerm,
  studyCardDedupeKey,
} from '../src/studyCards/studyCardDedupeKey.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function draft(overrides) {
  return {
    bundleId: 'bundle-a',
    songTitle: '测试歌',
    lang: 'jp',
    kind: 'vocab',
    front: '桜[さくら]',
    back: '<div></div>',
    tags: 'shufuri',
    sourceRaw: '{桜|さくら}',
    ...overrides,
  };
}

// 空白与 ruby 规范化 → 同 key
const keyA = studyCardDedupeKey(draft({ sourceRaw: '{桜|さくら}' }));
const keyB = studyCardDedupeKey(draft({ sourceRaw: '  {桜|さくら}  ' }));
assert(keyA === keyB, 'trimmed ruby variants share dedupe key');

// 语法括注变体 → 同 key（orig 均为 は）
const g1 = studyCardDedupeKey(
  draft({ kind: 'grammar', sourceRaw: 'は（助词）' }),
);
const g2 = studyCardDedupeKey(
  draft({ kind: 'grammar', sourceRaw: 'は(助词)' }),
);
assert(g1 === g2, 'grammar parenthesis variants share dedupe key');
assert(
  studyCardCanonicalTerm('grammar', 'は（助词）', 'jp') === 'は',
  'grammar canonical strips gloss',
);

// vocab vs grammar 同表面形式 → 不同 key
const vocabKey = studyCardDedupeKey(draft({ kind: 'vocab', sourceRaw: 'は' }));
const grammarKey = studyCardDedupeKey(draft({ kind: 'grammar', sourceRaw: 'は（助词）' }));
assert(vocabKey !== grammarKey, 'vocab and grammar differ by kind');

// 不同语种 → 不同 key
const jpKey = studyCardDedupeKey(draft({ lang: 'jp', sourceRaw: 'test' }));
const enKey = studyCardDedupeKey(draft({ lang: 'en', sourceRaw: 'test' }));
assert(jpKey !== enKey, 'lang separates dedupe scope');

// 全局过滤：已有键跳过；同批内第二张也跳过
const existing = new Set([studyCardDedupeKey(draft({ sourceRaw: '{桜|さくら}' }))]);
const batch = [
  draft({ sourceRaw: '{桜|さくら}' }),
  draft({ bundleId: 'bundle-b', sourceRaw: '{桜|さくら}' }),
  draft({ sourceRaw: '{秋桜|コスモス}' }),
];
const { toWrite, skipped } = filterStudyCardDraftsForInsert(batch, existing);
assert(toWrite.length === 1, 'only unseen term is written');
assert(skipped === 2, 'existing + in-batch duplicate are skipped');
assert(toWrite[0].sourceRaw === '{秋桜|コスモス}', 'written card is the new term');

console.log('testStudyCardDedupe: OK');
