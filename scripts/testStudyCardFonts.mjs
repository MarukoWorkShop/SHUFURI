/**
 * 词卡语种字体规则
 * 运行: npx tsx scripts/testStudyCardFonts.mjs
 */
import { studyCardMeaningUsesSongti } from '../src/studyCards/studyCardFonts.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(studyCardMeaningUsesSongti('表示领属'), 'han meaning');
assert(studyCardMeaningUsesSongti('  与 must 不同 '), 'han with spaces');
assert(!studyCardMeaningUsesSongti('modal verb have to'), 'latin meaning');
assert(!studyCardMeaningUsesSongti(''), 'empty');

console.log('testStudyCardFonts: OK');
