/**
 * 振假名解析回归：AI 笔误 去{こ} → {去|こ}；假名基字/送假名不注音
 * 运行：npx tsx scripts/testRubyMarkup.mjs
 */

import { Window } from 'happy-dom';
import {
  applyRubyMarkup,
  normalizeRubyMarkupText,
  sanitizeJpRubyInBodyHtml,
  sanitizeJpRubyTokenForTest,
} from '../src/utils/rubyMarkup.ts';

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
  {
    name: '正确：汉字注音 + 外置假名',
    in: '{淡|あわ}い{色|いろ}の{秋桜|コスモス}',
    norm: '{淡|あわ}い{色|いろ}の{秋桜|コスモス}',
    html:
      '<ruby>淡<rt>あわ</rt></ruby>い<ruby>色<rt>いろ</rt></ruby>の<ruby>秋桜<rt>コスモス</rt></ruby>',
  },
  {
    name: '误包助词：の 不注音',
    in: '{薄紅|うすべに}{の|の}{秋桜|こすもす}',
    norm: '{薄紅|うすべに}{の|の}{秋桜|こすもす}',
    html: '<ruby>薄紅<rt>うすべに</rt></ruby>の<ruby>秋桜<rt>こすもす</rt></ruby>',
  },
  {
    name: '误包送假名：揺れている',
    in: '{揺れている|ゆれている}',
    norm: '{揺れている|ゆれている}',
    html: '<ruby>揺<rt>ゆ</rt></ruby>れている',
  },
  {
    name: '误包送假名：何気ない',
    in: '{何気ない|なにげない}',
    norm: '{何気ない|なにげない}',
    html: '<ruby>何気<rt>なにげ</rt></ruby>ない',
  },
  {
    name: '误包前后假名：くり返す',
    in: '{くり返す|くりかえす}',
    norm: '{くり返す|くりかえす}',
    html: 'くり<ruby>返<rt>かえ</rt></ruby>す',
  },
  {
    name: '片假名基字不注音',
    in: '{アルバム|あるばむ}を',
    norm: '{アルバム|あるばむ}を',
    html: 'アルバムを',
  },
  {
    name: '裸花括号片假名去掉括号',
    in: 'で{アルバム}を',
    norm: 'でアルバムを',
    html: 'でアルバムを',
  },
  {
    name: '送假名裸括号：出{る}',
    in: '{出|で}{る}',
    norm: '{出|で}る',
    html: '<ruby>出<rt>で</rt></ruby>る',
  },
  {
    name: '送假名裸括号：語{る}（无正确读音时去括号）',
    in: '語{る}',
    norm: '語る',
    html: '語る',
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

const peel = sanitizeJpRubyTokenForTest('私の', 'わたしの');
if (peel !== '<ruby>私<rt>わたし</rt></ruby>の') {
  failed += 1;
  console.error('FAIL: peel 私の', peel);
} else {
  console.log('OK: peel 私の');
}

const w = new Window({ url: 'http://localhost/' });
Object.assign(globalThis, {
  window: w,
  document: w.document,
  DOMParser: w.DOMParser,
  NodeFilter: w.NodeFilter,
  HTMLElement: w.HTMLElement,
  Element: w.Element,
  Node: w.Node,
  Text: w.Text,
});

const dirtyHtml =
  '<div class="lyrics-group"><p class="jp-line">' +
  '<ruby>薄紅<rt>うすべに</rt></ruby><ruby>の<rt>の</rt></ruby><ruby>揺れている<rt>ゆれている</rt></ruby>' +
  '</p></div>';
const cleaned = sanitizeJpRubyInBodyHtml(dirtyHtml);
if (
  !cleaned.includes('<ruby>薄紅<rt>うすべに</rt></ruby>') ||
  cleaned.includes('<ruby>の<rt>の</rt></ruby>') ||
  !cleaned.includes('<ruby>揺<rt>ゆ</rt></ruby>れている')
) {
  failed += 1;
  console.error('FAIL: sanitizeJpRubyInBodyHtml', cleaned);
} else {
  console.log('OK: sanitizeJpRubyInBodyHtml');
}

await w.happyDOM.close();

if (failed > 0) {
  process.exit(1);
}
console.log(`\n${cases.length + 2} cases passed.`);
