/**
 * 振假名解析回归：AI 笔误 去{こ} → {去|こ}
 * 运行：npx tsx scripts/testRubyMarkup.mjs
 */

import { applyRubyMarkup, normalizeRubyMarkupText } from '../src/utils/rubyMarkup.ts';

const cases = [
  {
    name: 'AI 双字词笔误：第二字缺管道',
    in: '{過|か}去{こ}',
    norm: '{過|か}{去|こ}',
    html: '<ruby>過<rt>か</rt></ruby><ruby>去<rt>こ</rt></ruby>',
  },
  {
    name: 'AI 笔误：真実',
    in: '{真|しん}実{じつ}',
    norm: '{真|しん}{実|じつ}',
    html: '<ruby>真<rt>しん</rt></ruby><ruby>実<rt>じつ</rt></ruby>',
  },
  {
    name: '整词标注',
    in: '{過去|かこ}',
    norm: '{過去|かこ}',
    html: '<ruby>過去<rt>かこ</rt></ruby>',
  },
  {
    name: '词尾假名在外',
    in: '{匂|にお}い',
    norm: '{匂|にお}い',
    html: '<ruby>匂<rt>にお</rt></ruby>い',
  },
  {
    name: '整词后接假名',
    in: '過去{かこ}を',
    norm: '{過去|かこ}を',
    html: '<ruby>過去<rt>かこ</rt></ruby>を',
  },
];

let failed = 0;
for (const c of cases) {
  const norm = normalizeRubyMarkupText(c.in);
  const html = applyRubyMarkup(c.in);
  if (norm !== c.norm || html !== c.html) {
    failed += 1;
    console.error('FAIL:', c.name);
    console.error('  in:  ', c.in);
    console.error('  norm:', norm, 'expected:', c.norm);
    console.error('  html:', html, 'expected:', c.html);
  } else {
    console.log('OK:', c.name);
  }
}

if (failed > 0) {
  process.exit(1);
}
console.log(`\n${cases.length} cases passed.`);
