/**
 * 漏网汉字空 ruby 兜底回归
 * 运行：npx tsx scripts/testWrapUncoveredKanji.mjs
 */

import { Window } from 'happy-dom';
import { wrapUncoveredKanjiAsRuby, INK_EMPTY_RT_ATTR } from '../src/utils/inkFineTune/wrapUncoveredKanjiAsRuby.ts';
import { annotateInkEditTargets } from '../src/utils/inkFineTune/annotateInkEditTargets.ts';
import { applyRubyEdit } from '../src/utils/inkFineTune/applyInkEdit.ts';
import { prepareBodyHtmlForPreview } from '../src/utils/inkEditUtils.ts';
import { compilePosterCss } from '../src/utils/posterTypography/cssCompiler.ts';
import { resolvePosterTypography } from '../src/utils/posterTypography/fontResolver.ts';

const window = new Window({ url: 'https://localhost/' });
globalThis.DOMParser = window.DOMParser;
globalThis.NodeFilter = window.NodeFilter;
globalThis.DocumentFragment = window.DocumentFragment;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function jpGroup(jpInner) {
  return `<div class="lyrics-group"><p class="jp-line">${jpInner}</p><p class="zh-line">译</p></div>`;
}

// --- 1. 漏标汉字被包成空 ruby ---
{
  const input = jpGroup(`<ruby>深<rt>ふか</rt></ruby>く祈るわ`);
  // 有 ruby → infer=jp；「祈」漏标
  const out = wrapUncoveredKanjiAsRuby(input);
  assert(out.includes(`<ruby ${INK_EMPTY_RT_ATTR}="1">祈<rt></rt></ruby>`), '漏标「祈」应包空 ruby');
  assert(out.includes('<ruby>深<rt>ふか</rt></ruby>'), '已有 ruby 应保留');
  assert(!out.includes('<ruby><ruby>'), '不得嵌套 ruby');
  console.log('OK: wrap uncovered 祈');
}

// --- 2. 连续汉字 run 整段包裹 ---
{
  const input = jpGroup(`<ruby>月<rt>つき</rt></ruby>魑魅魍魉`);
  const out = wrapUncoveredKanjiAsRuby(input);
  assert(
    out.includes(`<ruby ${INK_EMPTY_RT_ATTR}="1">魑魅魍魉<rt></rt></ruby>`),
    '连续汉字应整段包裹',
  );
  console.log('OK: long kanji run');
}

// --- 3. 假名/标点/拉丁不包 ---
{
  const input = jpGroup(`<ruby>風<rt>かぜ</rt></ruby>abc…を`);
  const out = wrapUncoveredKanjiAsRuby(input);
  assert(out.includes('abc…を'), '假名标点拉丁应原样');
  assert(!/<ruby[^>]*>abc/.test(out), '拉丁不应包进 ruby');
  console.log('OK: skip kana/latin');
}

// --- 4. 幂等 ---
{
  const input = jpGroup(`<ruby>散<rt>ち</rt></ruby>った琥珀`);
  const once = wrapUncoveredKanjiAsRuby(input);
  const twice = wrapUncoveredKanjiAsRuby(once);
  assert(once === twice, '二次 wrap 应幂等');
  assert(!twice.includes('<ruby><ruby>'), '幂等不得嵌套');
  console.log('OK: idempotent');
}

// --- 5. 非 jp（中文标记）不改动 ---
{
  const zh = `<div class="lyrics-group lyrics-group--zh"><p class="jp-line">深散</p><p class="cn-line">译</p></div>`;
  const out = wrapUncoveredKanjiAsRuby(zh);
  assert(out === zh, 'zh 管线不应 wrap');
  console.log('OK: skip zh pipeline');
}

// --- 6. 无 ruby 的 jp-line 被推断为 en，不 wrap（英语复用 jp-line）---
{
  const en = jpGroup(`Hello世界`);
  const out = wrapUncoveredKanjiAsRuby(en);
  assert(out === en, '无 ruby 的 jp-line 推断为 en，不 wrap');
  console.log('OK: skip en-like jp-line');
}

// --- 7. prepareBodyHtmlForPreview 注入 data-ink-r ---
{
  const input = jpGroup(`<ruby>深<rt>ふか</rt></ruby>く散る`);
  const prepared = prepareBodyHtmlForPreview(input);
  assert(prepared.includes('data-ink-g="0"'), '应有 group 索引');
  assert(prepared.includes(`${INK_EMPTY_RT_ATTR}="1"`), 'prepare 应含空 ruby');
  assert(/ruby[^>]*data-ink-r="1"/.test(prepared) || prepared.includes('data-ink-r="1"'), '空 ruby 应被编号');
  const empty = prepared.match(new RegExp(`<ruby[^>]*${INK_EMPTY_RT_ATTR}[^>]*>散<rt></rt></ruby>`));
  assert(empty, '「散」应为空可编辑 ruby');
  console.log('OK: prepareBodyHtmlForPreview annotates');
}

// --- 8. 长汉字块整段回写 + 清除 empty 标记 ---
{
  const input = jpGroup(`<ruby>月<rt>つき</rt></ruby>最高裁判所`);
  let html = annotateInkEditTargets(wrapUncoveredKanjiAsRuby(input));
  // 空 ruby 应为 index 1
  const edited = applyRubyEdit(html, 0, 1, '最高裁判所', 'さいこうさいばんしょ');
  assert(edited.includes('<ruby data-ink-r="1">最高裁判所<rt>さいこうさいばんしょ</rt></ruby>')
    || (edited.includes('最高裁判所<rt>さいこうさいばんしょ</rt>') && !edited.includes(`${INK_EMPTY_RT_ATTR}="1">最高裁判所`)),
    '长块整段回写');
  assert(!edited.includes(`${INK_EMPTY_RT_ATTR}="1"`), '补音后应清除 data-ink-empty-rt');
  console.log('OK: applyRubyEdit long block clears empty attr');
}

// --- 9. 海报 CSS 含空 rt 隐藏规则 ---
{
  const resolved = resolvePosterTypography({ profile: 'mobilePoster', lang: 'jp', spacingScale: 1 });
  const css = compilePosterCss(resolved, { unit: 'px', showRuby: true, includeFontFaces: false });
  assert(
    css.includes('data-ink-empty-rt') && css.includes('rt:empty'),
    'cssCompiler 应隐藏空 rt',
  );
  console.log('OK: cssCompiler empty-rt hide');
}

console.log('\ntestWrapUncoveredKanji: all passed.');
