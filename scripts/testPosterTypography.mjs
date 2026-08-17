import { resolvePosterTypography } from '../src/utils/posterTypography/fontResolver.ts';
import { compilePosterCss } from '../src/utils/posterTypography/cssCompiler.ts';
import {
  JP_RUBY_COLOR,
  JP_RUBY_RT_EM_MOBILE,
  JP_RUBY_RT_EM_PRINT,
  JP_ZH_LINE_WEIGHT,
  LYRIC_PRIMARY_WEIGHT,
} from '../src/utils/posterTypography/typographyConstants.ts';
import {
  KOZMIN_PRO_REGULAR_FAMILY,
  KO_POSTER_TITLE_FONT_FAMILY,
  ZH_POSTER_TITLE_FONT_FAMILY,
  ZH_SONGTI_FONT_FAMILY,
} from '../src/utils/shufuriPoster/fonts.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** 非日语 profile：mainPx = zhMainPx = titleFsPx（仍用 BASE_MAIN 26） */
const PROFILE_SCALE_GOLDEN = [
  { profile: 'mobilePoster', mainPx: 46, auxPx: 32 },
  { profile: 'squarePoster', mainPx: 40, auxPx: 28 },
  { profile: 'clipPosterPrint', mainPx: 17, auxPx: 12 },
];

/** 日语导出层级：基准 24/14.4，随 elasticFontBase 缩放（相对初版 20/12 ×1.2） */
const JP_PROFILE_SCALE_GOLDEN = [
  { profile: 'mobilePoster', mainPx: 43, auxPx: 26 },
  { profile: 'squarePoster', mainPx: 37, auxPx: 22 },
  { profile: 'clipPosterPrint', mainPx: 16, auxPx: 10 },
];

for (const { profile, mainPx, auxPx } of PROFILE_SCALE_GOLDEN) {
  const zh = resolvePosterTypography({ profile, lang: 'zh', spacingScale: 1 });

  assert(zh.layout.mainPx === mainPx, `${profile} zh mainPx expected ${mainPx}, got ${zh.layout.mainPx}`);
  assert(zh.layout.auxPx === auxPx, `${profile} zh auxPx expected ${auxPx}, got ${zh.layout.auxPx}`);
  assert(zh.layout.titleFsPx === mainPx, `${profile} titleFsPx expected ${mainPx}, got ${zh.layout.titleFsPx}`);
  assert(zh.layout.zhMainPx === mainPx, `${profile} zhMainPx expected ${mainPx}, got ${zh.layout.zhMainPx}`);
  assert(
    zh.roles.lyricPrimary.fontSize === zh.layout.mainPx,
    `${profile} zh lyricPrimary should match mainPx`,
  );
}

for (const { profile, mainPx, auxPx } of JP_PROFILE_SCALE_GOLDEN) {
  const jp = resolvePosterTypography({ profile, lang: 'jp', spacingScale: 1 });
  assert(jp.layout.mainPx === mainPx, `${profile} jp mainPx expected ${mainPx}, got ${jp.layout.mainPx}`);
  assert(jp.layout.auxPx === auxPx, `${profile} jp auxPx expected ${auxPx}, got ${jp.layout.auxPx}`);
  assert(jp.roles.lyricPrimary.fontSize === mainPx, `${profile} jp lyricPrimary size`);
  assert(jp.roles.lyricSecondary.fontSize === auxPx, `${profile} jp lyricSecondary size`);
  assert(
    Math.abs(
      jp.layout.mainRtEm -
        (profile === 'mobilePoster' ? JP_RUBY_RT_EM_MOBILE : JP_RUBY_RT_EM_PRINT),
    ) < 1e-9,
    `${profile} jp ruby rtEm restored`,
  );
  const expectedGap = `${Math.round(18 * ({ mobilePoster: 32, squarePoster: 28, clipPosterPrint: 12 }[profile] / 18))}px`;
  assert(jp.layout.groupMb === expectedGap, `${profile} jp group gap ${expectedGap}, got ${jp.layout.groupMb}`);
  assert(jp.layout.jpLh === 1.72, `${profile} jp lyric line-height 1.72`);
}

const mobileJp = resolvePosterTypography({ profile: 'mobilePoster', lang: 'jp', spacingScale: 1 });
assert(
  mobileJp.roles.lyricPrimary.fontFamily === KOZMIN_PRO_REGULAR_FAMILY,
  'jp lyricPrimary uses KozMin Pro Regular (Kozuka Mincho Pro R stack)',
);
assert(
  mobileJp.roles.lyricPrimary.fontWeight === LYRIC_PRIMARY_WEIGHT,
  'lyricPrimary weight 400',
);
assert(
  mobileJp.roles.lyricSecondary.fontWeight === JP_ZH_LINE_WEIGHT,
  'jp lyricSecondary (zh-line) weight 400',
);
assert(
  mobileJp.roles.lyricSecondary.fontWeight === 400,
  'jp translation weight restored to 400',
);
assert(
  mobileJp.roles.rubyAnnotation.fontFamily.includes('Kozuka Mincho Pro R'),
  'jp ruby uses KozMin Pro R',
);
assert(
  mobileJp.roles.rubyAnnotation.color === JP_RUBY_COLOR,
  'jp ruby color #888',
);
assert(
  mobileJp.roles.rubyAnnotation.ruby?.rtColor === JP_RUBY_COLOR,
  'jp ruby rt color #888',
);

const zhTight = resolvePosterTypography({ profile: 'mobilePoster', lang: 'zh', spacingScale: 0.9 });
assert(
  zhTight.layout.zhMainPx === zhTight.roles.lyricPrimary.fontSize,
  'zhMainPx equals lyricPrimary',
);

const mobileEn = resolvePosterTypography({ profile: 'mobilePoster', lang: 'en', spacingScale: 1 });
assert(mobileEn.roles.lyricPrimary.fontWeight === 400, 'en lyricPrimary weight 400');
assert(
  mobileEn.roles.lyricPrimary.fontFamily === KOZMIN_PRO_REGULAR_FAMILY,
  'en lyricPrimary uses KozMin Pro Regular',
);
assert(
  mobileEn.roles.lyricSecondary.fontFamily === KOZMIN_PRO_REGULAR_FAMILY,
  'en gloss-line uses KozMin Pro Regular',
);

const mobileZh = resolvePosterTypography({ profile: 'mobilePoster', lang: 'zh', spacingScale: 1 });
assert(
  mobileZh.roles.lyricPrimary.fontFamily === ZH_SONGTI_FONT_FAMILY,
  'zh lyricPrimary (.cn-line) uses Source Han Serif SC',
);
assert(
  mobileZh.roles.lyricSecondary.fontFamily === KOZMIN_PRO_REGULAR_FAMILY,
  'zh gloss-line uses KozMin Pro Regular',
);

const mobileKo = resolvePosterTypography({ profile: 'mobilePoster', lang: 'ko', spacingScale: 1 });
assert(mobileKo.roles.lyricPrimary.fontWeight === 400, 'ko lyricPrimary weight 400');
assert(mobileKo.roles.studyTerm.lineHeight === 1.25, 'ko studyTerm compact lh');
assert(mobileKo.roles.studyExample.fontSize === 32, 'ko studyExample uses auxPx');

const mobileJpStudy = resolvePosterTypography({ profile: 'mobilePoster', lang: 'jp', spacingScale: 1 });
assert(
  mobileJpStudy.roles.studyExample.fontSize === mobileJpStudy.layout.auxPx,
  'jp studyExample uses auxPx',
);
assert(
  mobileJpStudy.roles.studyExample.lineHeight === mobileJpStudy.layout.jpLh,
  'jp studyExample uses jpLh',
);
assert(
  mobileJpStudy.roles.studyTerm.fontSize === mobileJpStudy.layout.mainPx,
  'jp studyTerm uses mainPx',
);
assert(
  mobileJpStudy.roles.studyTerm.fontSize === mobileJpStudy.roles.grammarPointShell.fontSize ||
    mobileJpStudy.roles.studyTerm.fontSize > mobileJpStudy.roles.grammarPointShell.fontSize,
  'studyTerm mainPx > grammarPointShell auxPx',
);

const mobileEnStudy = resolvePosterTypography({ profile: 'mobilePoster', lang: 'en', spacingScale: 1 });
assert(mobileEnStudy.roles.studyTerm.fontSize === mobileEnStudy.layout.mainPx, 'en studyTerm uses mainPx');
assert(mobileEnStudy.roles.studyExample.fontSize === mobileEnStudy.layout.auxPx, 'en studyExample uses auxPx');

const mobileZhStudy = resolvePosterTypography({ profile: 'mobilePoster', lang: 'zh', spacingScale: 1 });
assert(mobileZhStudy.zhLayout.glossFs === 32, 'zh study aux/gloss fs');
assert(mobileZhStudy.zhLayout.cnFs === 46, 'zh study term fs');

for (const [lang, family] of [
  ['jp', KOZMIN_PRO_REGULAR_FAMILY],
  ['en', KOZMIN_PRO_REGULAR_FAMILY],
  ['ko', KO_POSTER_TITLE_FONT_FAMILY],
  ['zh', ZH_POSTER_TITLE_FONT_FAMILY],
]) {
  const t = resolvePosterTypography({ profile: 'mobilePoster', lang, spacingScale: 1 });
  assert(
    t.roles.posterTitle.fontFamily === family,
    `posterTitle ${lang} font`,
  );
  assert(t.roles.posterTitle.fontWeight === 400, `posterTitle ${lang} weight 400`);
  assert(t.roles.posterArtist.fontFamily === family, `posterArtist ${lang} font`);
}

assert(
  mobileKo.roles.posterTitle.fontFamily.includes('Songti SC'),
  'ko posterTitle stacks Songti SC before system serif for Han',
);
assert(
  mobileKo.roles.posterTitle.fontFamily.includes('AppleMyungjo'),
  'ko posterTitle keeps AppleMyungjo for Hangul fallback',
);

console.log('testPosterTypography: OK');

// --- showRuby + preview density ---
const jpRubyOn = resolvePosterTypography({ profile: 'mobilePoster', lang: 'jp', spacingScale: 1, showRuby: true });
const jpRubyOff = resolvePosterTypography({ profile: 'mobilePoster', lang: 'jp', spacingScale: 1, showRuby: false });
assert(jpRubyOn.flags.showRuby === true, 'showRuby on flag');
assert(jpRubyOff.flags.showRuby === false, 'showRuby off flag');
assert(jpRubyOff.flags.isCompact === true, 'jp hide ruby uses compact layout');
assert(jpRubyOff.layout.jpLh < jpRubyOn.layout.jpLh, 'hide ruby tightens jp line height');

const scaledFont = resolvePosterTypography({
  profile: 'clipPosterPrint',
  lang: 'jp',
  spacingScale: 1,
  userFontScale: 1.1,
  userLineHeightScale: 1,
});
const scaledLine = resolvePosterTypography({
  profile: 'clipPosterPrint',
  lang: 'jp',
  spacingScale: 1,
  userFontScale: 1,
  userLineHeightScale: 1.1,
});
const printBase = resolvePosterTypography({ profile: 'clipPosterPrint', lang: 'jp', spacingScale: 1 });
assert(scaledFont.layout.mainPx > printBase.layout.mainPx, 'userFontScale grows mainPx');
assert(scaledLine.layout.jpLh > printBase.layout.jpLh, 'userLineHeightScale grows jpLh');

const resolvedOff = resolvePosterTypography({ profile: 'mobilePoster', lang: 'jp', showRuby: false });
const cssOff = compilePosterCss(resolvedOff, { unit: 'px', showRuby: false, includeFontFaces: false });
assert(cssOff.includes('data-ruby-visible="false"'), 'ruby hide CSS targets data attribute');
assert(cssOff.includes('display: none'), 'ruby hide CSS hides rt');

console.log('testPosterTypography (ruby + density): OK');

const cssMobile = compilePosterCss(mobileJp, { unit: 'px', showRuby: true, includeFontFaces: false });
assert(
  cssMobile.includes('flex: 0 1 100%') && !/\.fv-title-artist[^}]*white-space:\s*nowrap/.test(cssMobile),
  'artist line must wrap (no nowrap)',
);

console.log('testPosterTypography (title artist wrap): OK');
