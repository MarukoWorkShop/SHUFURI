/**
 * 中文编辑页 vs 预览页排版对齐：layoutProfile + pipeline lang 一致时，
 * 字号、字色、行距等 typography token 应相同。
 */
import { resolvePosterPipelineLang } from '../src/utils/shufuriPoster/inferPosterLang.ts';
import {
  resolvePosterTypography,
  resolvePinyinAccentColor,
} from '../src/utils/posterTypography/fontResolver.ts';
import {
  GLOSS_COLOR,
  LYRIC_PRIMARY_WEIGHT,
  LYRIC_SECONDARY_WEIGHT,
} from '../src/utils/posterTypography/typographyConstants.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const ZH_SAMPLE = `
<div class="lyrics-group lyrics-group--zh">
  <p class="cn-line">藤蔓植物，爬满了伯爵的坟墓</p>
  <p class="gloss-line">Creeping vines cover the earl's entire tomb</p>
</div>`;

// ---- 1. auto 波轮 + cn-line：编辑与预览应同样推断 zh ----
const editLang = resolvePosterPipelineLang(undefined, ZH_SAMPLE, 'auto');
const previewLang = resolvePosterPipelineLang(undefined, ZH_SAMPLE, 'auto');
assert(editLang === 'zh', `edit lang expected zh, got ${editLang}`);
assert(previewLang === 'zh', `preview lang expected zh, got ${previewLang}`);

// ---- 2. mobilePoster + spacingScale 1：编辑与预览 typography 一致 ----
const editTypo = resolvePosterTypography({
  profile: 'mobilePoster',
  lang: editLang,
  spacingScale: 1,
  colorTheme: 'mono',
});
const previewTypo = resolvePosterTypography({
  profile: 'mobilePoster',
  lang: previewLang,
  spacingScale: 1,
  colorTheme: 'mono',
});

assert(editTypo.layout.zhMainPx === 46, `zhMainPx expected 46, got ${editTypo.layout.zhMainPx}`);
assert(
  editTypo.layout.zhMainPx === editTypo.layout.mainPx,
  'zh main should equal jp mainPx on mobile',
);
assert(
  previewTypo.layout.zhMainPx === editTypo.layout.zhMainPx,
  'preview zhMainPx matches edit',
);

const fields = [
  ['lyricPrimary.fontSize', 'roles.lyricPrimary.fontSize'],
  ['lyricPrimary.fontWeight', 'roles.lyricPrimary.fontWeight'],
  ['lyricPrimary.lineHeight', 'roles.lyricPrimary.lineHeight'],
  ['lyricSecondary.fontSize', 'roles.lyricSecondary.fontSize'],
  ['lyricSecondary.fontWeight', 'roles.lyricSecondary.fontWeight'],
  ['lyricSecondary.lineHeight', 'roles.lyricSecondary.lineHeight'],
  ['lyricSecondary.color', 'roles.lyricSecondary.color'],
  ['rubyAnnotation.color', 'roles.rubyAnnotation.color'],
  ['zhLayout.pinyinColor', 'zhLayout.pinyinColor'],
  ['zhLayout.glossFs', 'zhLayout.glossFs'],
  ['zhLayout.mainLh', 'zhLayout.mainLh'],
  ['zhLayout.glossLh', 'zhLayout.glossLh'],
];

for (const [label, path] of fields) {
  const parts = path.split('.');
  let a = editTypo;
  let b = previewTypo;
  for (const p of parts) {
    a = a[p];
    b = b[p];
  }
  assert(a === b, `${label}: edit=${a} preview=${b}`);
}

assert(editTypo.roles.lyricPrimary.fontWeight === LYRIC_PRIMARY_WEIGHT, 'cn weight 400');
assert(editTypo.roles.lyricSecondary.fontWeight === LYRIC_SECONDARY_WEIGHT, 'gloss weight 300');
assert(editTypo.roles.lyricSecondary.color === GLOSS_COLOR, 'gloss color');
assert(
  editTypo.zhLayout.pinyinColor === resolvePinyinAccentColor('mono'),
  'pinyin color mono',
);

// ---- 3. 旧路径（B5 + 未推断 jp）应与编辑明显不同 ----
const brokenTypo = resolvePosterTypography({
  profile: 'clipPosterPrint',
  lang: 'jp',
  spacingScale: 1,
  colorTheme: 'mono',
});
assert(
  brokenTypo.layout.zhMainPx !== editTypo.layout.zhMainPx,
  'old B5/jp path should differ from edit zh mobile',
);
assert(!brokenTypo.zhLayout, 'jp pipeline should not have zhLayout');

console.log('testZhEditPreviewAlign: OK');
