/**
 * 显微镜 AI讲解 Prompt：按歌曲语种分轨 + 分子式/胶囊解析 + 防串行
 * 用法：npx tsx scripts/testMicroscopeAiPrompt.mjs
 */
import {
  buildGrammarPointLessonPrompt,
  buildMicroscopeAiExplainPrompt,
  examTagForLanguage,
  langCodeToMicroscopeLanguage,
  parseAiExplainParts,
  parseGrammarCapsules,
  parseGrammarExamples,
  parseGrammarFormula,
  parseGrammarPointLesson,
  textContainsGrammarTerm,
} from '../src/codec/prompt/buildMicroscopePrompt.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(langCodeToMicroscopeLanguage('ko') === 'Korean', 'ko → Korean');
assert(langCodeToMicroscopeLanguage('jp') === 'Japanese', 'jp → Japanese');
assert(examTagForLanguage('English') === '英语考试', 'en exam');
assert(examTagForLanguage('Japanese') === 'JLPT', 'jp exam');

const ko = buildMicroscopeAiExplainPrompt({
  language: 'Korean',
  title: '테스트',
  artist: 'A',
  targetPhrase: '걱정 마',
  surroundingLine: '걱정 마 내가 있잖아',
  interfaceLanguage: 'zh',
  localLemma: {
    dictionary_form: '걱정하다',
    pronunciation: '걱정하다',
    part_of_speech: '动词',
    direct_meaning: '担心',
  },
});

const jp = buildMicroscopeAiExplainPrompt({
  language: 'Japanese',
  title: 'テスト',
  artist: 'A',
  targetPhrase: '心配しないで',
  surroundingLine: '心配しないで',
  interfaceLanguage: 'zh',
});

const en = buildMicroscopeAiExplainPrompt({
  language: 'English',
  title: 'Test',
  artist: 'A',
  targetPhrase: 'not quite hold',
  surroundingLine: 'Like a dream I can reach but not quite hold',
  interfaceLanguage: 'zh',
});

assert(ko.includes('只能谈韩语'), 'ko lang lock');
assert(ko.includes('말다'), 'ko grammar example');
assert(ko.includes('TOPIK'), 'ko exam tag TOPIK');
assert(!ko.includes('てしまう→ちゃう'), 'ko must not teach JP contractions');
assert(!ko.includes('〜ておく→とく'), 'ko must not teach JP とく');
assert(ko.includes('严禁使用日语'), 'ko anti-jp');
assert(!ko.includes('[信じ|'), 'ko must not include JP formula example');
assert(ko.includes('禁止写：JLPT'), 'ko forbids JLPT in anti-cross');
// JLPT 只允许出现在「禁止」列表，不得作为可输出胶囊格式
assert(!/【语法胶囊】[\s\S]*JLPT\|/.test(ko), 'ko capsule format is not JLPT');
assert(!ko.includes('JLPT|…'), 'ko output template not JLPT');

assert(jp.includes('只能谈日语'), 'jp lang lock');
assert(jp.includes('てしまう→ちゃう') || jp.includes('ます形'), 'jp grammar examples');
assert(jp.includes('JLPT'), 'jp exam tag JLPT');
assert(jp.includes('禁止用韩语') || jp.includes('严禁韩语'), 'jp anti-ko');
assert(jp.includes('对比防坑'), 'jp grammar contrast');
assert(jp.includes('Ateji') || jp.includes('借字') || jp.includes('さだめ'), 'jp slang hint');
assert(jp.includes('【歌词黑话】'), 'jp has slang section');
assert(jp.includes('词尾') || jp.includes('潜台词') || jp.includes('微妙语气'), 'jp mood emphasis');
assert(jp.includes('【外来语原词】'), 'jp has loanword section');
assert(jp.includes('片假名外来语') || jp.includes('源语言'), 'jp loanword rules');
assert(!jp.includes('[나|'), 'jp must not include KO formula example');
assert(jp.includes('禁止写：TOPIK'), 'jp forbids TOPIK');
assert(!jp.includes('TOPIK|…'), 'jp output template not TOPIK');

assert(!ko.includes('【外来语原词】'), 'ko must not have JP loanword section');
assert(!en.includes('【外来语原词】'), 'en must not have JP loanword section');

const jpLoan = buildMicroscopeAiExplainPrompt({
  language: 'Japanese',
  title: 'テスト',
  artist: 'A',
  targetPhrase: 'カルパッチョパエリアオードブル',
  surroundingLine: 'カルパッチョパエリアオードブル',
  interfaceLanguage: 'zh',
});
assert(jpLoan.includes('【硬性】'), 'katakana focus forces loanword block');
assert(jpLoan.includes('不得写「—」'), 'force non-dash');

assert(en.includes('只能谈英语'), 'en lang lock');
assert(en.includes('英语考试'), 'en exam tag');
assert(en.includes('[can|'), 'en formula example');
assert(en.includes('对比防坑'), 'en grammar contrast');
assert(en.includes('【歌词黑话】'), 'en has slang section');
assert(en.includes('idiom') || en.includes('俚语'), 'en slang hint');
assert(!en.includes('[나|'), 'en must not include KO formula');
assert(!en.includes('[信じ|'), 'en must not include JP formula');
assert(!en.includes('「건」'), 'en must not include KO capsule keys');
assert(!en.includes('「ちゃう」'), 'en must not include JP capsule keys');
assert(en.includes('禁止写：JLPT'), 'en forbids JLPT');
assert(en.includes('严禁日语·韩语语法'), 'en anti jp/ko');
assert(!en.includes('英语考试') || en.includes('英语考试|…'), 'en capsule template');

assert(ko.includes('对比防坑'), 'ko grammar contrast');
assert(ko.includes('네→니') || ko.includes('눈'), 'ko slang hint');
assert(ko.includes('【歌词黑话】'), 'ko has slang section');

const formula = parseGrammarFormula(
  '[나|代词·我] + [바라다|动词·期盼] + [~는|定语词尾] + [건|것은缩略]',
);
assert(formula.length === 4, 'formula token count');
assert(formula[0].surface === '나' && formula[3].label.includes('缩略'), 'formula fields');

const capsules = parseGrammarCapsules(
  'TOPIK|건|韩语中常见的 것 口语缩略现象\nJLPT|ちゃう|串行应丢\nTOPIK|—|本句无独立高频语法点',
  'TOPIK',
);
assert(capsules.length === 1, 'skip empty + wrong exam');
assert(capsules[0].term === '건', 'capsule term');

const jpCapsules = parseGrammarCapsules(
  `JLPT|な|な形容词连体形修饰名词
JLPT|裏腹|N2·裏腹な／裏腹だ表里不一
JLPT|—|本划选无专属JLPT考点`,
  'JLPT',
);
assert(jpCapsules.length === 1, 'drop generic + empty JP capsules');
assert(jpCapsules[0].term === '裏腹', 'keep specific lexeme capsule');

assert(jp.includes('无专属JLPT') || jp.includes('专属JLPT'), 'jp capsule specificity rules');
assert(jp.includes('硬性禁止') || jp.includes('泛化词类'), 'jp forbids generic capsules');

const parts = parseAiExplainParts(
  `【语境释义】我所期盼的事
【语法分子式】[나|代词·我] + [건|것은缩略]
【语法拆解】건 ← 것은；别与「것은」正式体混用
【语法胶囊】
TOPIK|건|韩语中常见的 것 口语缩略现象
JLPT|てしまう|串行
【歌词意境】迫切里带着一点自我安慰
【歌词黑话】口语把「것은」缩成「건」，歌词里更轻快`,
  { language: 'Korean' },
);
assert(parts.formula.length === 2, 'parsed formula');
assert(parts.capsules.length === 1, 'drop cross-exam capsule');
assert(parts.capsules[0].title.includes('口语缩略'), 'parsed capsule');
assert(parts.grammar.includes('것은'), 'parsed grammar');
assert(parts.mood.includes('迫切'), 'parsed mood');
assert(parts.slang.includes('건'), 'parsed slang');

const loanParts = parseAiExplainParts(
  `【语境释义】菜单上并列的三种西餐名
【外来语原词】
カルパッチョ ← 意大利语 Carpaccio → 生牛肉片
パエリア ← 西班牙语 Paella → 海鲜饭
オードブル ← 法语 hors d'oeuvre → 开胃小食
【语法分子式】[カルパッチョ|外来名词] + [パエリア|外来名词]
【语法拆解】均为无变形外来语名词并列
【语法胶囊】
JLPT|—|本句无独立高频语法点
【歌词意境】—
【歌词黑话】—`,
  { language: 'Japanese' },
);
assert(loanParts.loanwords.length === 3, 'parsed 3 loanwords');
assert(loanParts.loanwords[0].original === 'Carpaccio', 'carpaccio original');
assert(loanParts.loanwords[0].sourceLang.includes('意大利'), 'italian source');
assert(loanParts.loanwords[2].gloss.includes('开胃'), 'hors gloss');

assert(
  !textContainsGrammarTerm('あれこれと思い出をたどったら', '~で'),
  'false positive で in unrelated lyric',
);
assert(
  textContainsGrammarTerm('この花は道端で咲いてる', '~で'),
  'true positive で',
);

const filtered = parseGrammarExamples(
  `1. 《秋樱》｜あれこれと思い出をたどったら｜回想
2. 《世界に一つだけの花》｜道端で咲いてる｜路边开
3. 《测试》｜学校で待つ｜在学校等`,
  '~で',
);
assert(filtered.length === 2, 'parse drops lines without で');
assert(filtered.every((x) => x.text.includes('で')), 'all kept contain で');

const lesson = parseGrammarPointLesson(
  `【通常含义】差一点、不完全
【如何使用】常修饰动词或形容词，表程度未满
【情感语气】遗憾、未完成感
【例句】《造句》｜I'm not quite ready.｜我还没完全准备好`,
  'not quite',
);
assert(lesson.meaning.includes('差一点'), 'lesson meaning');
assert(lesson.usage.includes('修饰'), 'lesson usage');
assert(lesson.emotion.includes('遗憾'), 'lesson emotion');
assert(lesson.example?.text.includes('not quite'), 'lesson example');
assert(lesson.example?.via === 'crafted', 'crafted via');

const lessonPrompt = buildGrammarPointLessonPrompt({
  language: 'English',
  exam: '英语考试',
  term: 'not quite',
  title: '程度副词修饰动词的用法',
  songTitle: 'Test Song',
  artist: 'A',
  seedExample: {
    source: 'Counting Stars',
    text: "I'm not quite ready to go",
    zh: '我还没完全准备好离开',
  },
});
assert(lessonPrompt.includes('【系统角色】'), 'lesson role');
assert(lessonPrompt.includes('精通流行歌词语境的微型讲义生成器'), 'lesson role body');
assert(lessonPrompt.includes('触发检索键: not quite'), 'lesson keyword');
assert(lessonPrompt.includes('关联考试标签: 英语考试'), 'lesson exam');
assert(lessonPrompt.includes('可选现成种子例句'), 'lesson seed header');
assert(lessonPrompt.includes("I'm not quite ready to go"), 'lesson seed body');
assert(lessonPrompt.includes('【通常含义】用最通俗的语言'), 'lesson out meaning');
assert(lessonPrompt.includes('【如何使用】说明接续规则'), 'lesson out usage');
assert(lessonPrompt.includes('【情感语气】用拟人化或情绪词'), 'lesson out emotion');
assert(lessonPrompt.includes('【例句】严格格式'), 'lesson out example');
assert(lessonPrompt.includes('《造句》'), 'lesson allows crafted');
assert(!lessonPrompt.includes('恰好 3 条'), 'no force 3 examples');

console.log('OK microscope AI prompts language-split + anti-cross + lesson');
console.log('--- sample lesson prompt (English / not quite) ---');
console.log(lessonPrompt);
