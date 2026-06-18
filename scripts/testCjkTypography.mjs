import {
  lineViolatesCjkRules,
  cjkFontScale,
  cjkLetterSpacingEm,
} from '../src/utils/shufuriPoster/cjkTypography.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(lineViolatesCjkRules('墙'), 'single hanzi is orphan');
assert(lineViolatesCjkRules('。'), 'single punct is orphan');
assert(!lineViolatesCjkRules('墙上爬满了'), 'normal line ok');
assert(lineViolatesCjkRules('，绿色'), 'head punct forbidden');
assert(lineViolatesCjkRules('藤蔓（'), 'tail open punct forbidden');

assert(cjkFontScale(1) === 1, 'scale 1 font');
assert(cjkFontScale(0.9) < 1, 'scale 0.9 shrinks font');
assert(cjkLetterSpacingEm(1) === '0', 'scale 1 ls');
assert(parseFloat(cjkLetterSpacingEm(0.9)) < 0, 'scale 0.9 tightens ls');

console.log('testCjkTypography: OK');
