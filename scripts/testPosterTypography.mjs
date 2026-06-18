import { resolvePosterTypography } from '../src/utils/posterTypography/fontResolver.ts';
import {
  LYRIC_PRIMARY_WEIGHT,
  LYRIC_SECONDARY_WEIGHT,
} from '../src/utils/posterTypography/typographyConstants.ts';
import { KOZMIN_PRO_REGULAR_FAMILY, KO_POSTER_TITLE_FONT_FAMILY, ZH_POSTER_TITLE_FONT_FAMILY } from '../src/utils/shufuriPoster/fonts.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** 三 profile 黄金快照：mainPx = zhMainPx = titleFsPx */
const PROFILE_SCALE_GOLDEN = [
  { profile: 'mobilePoster', mainPx: 46, auxPx: 32 },
  { profile: 'squarePoster', mainPx: 40, auxPx: 28 },
  { profile: 'clipPosterPrint', mainPx: 17, auxPx: 12 },
];

for (const { profile, mainPx, auxPx } of PROFILE_SCALE_GOLDEN) {
  const jp = resolvePosterTypography({ profile, lang: 'jp', spacingScale: 1 });
  const zh = resolvePosterTypography({ profile, lang: 'zh', spacingScale: 1 });

  assert(jp.layout.mainPx === mainPx, `${profile} jp mainPx expected ${mainPx}, got ${jp.layout.mainPx}`);
  assert(jp.layout.auxPx === auxPx, `${profile} jp auxPx expected ${auxPx}, got ${jp.layout.auxPx}`);
  assert(jp.layout.titleFsPx === mainPx, `${profile} titleFsPx expected ${mainPx}, got ${jp.layout.titleFsPx}`);
  assert(zh.layout.zhMainPx === mainPx, `${profile} zhMainPx expected ${mainPx}, got ${zh.layout.zhMainPx}`);
  assert(
    zh.roles.lyricPrimary.fontSize === jp.roles.lyricPrimary.fontSize,
    `${profile} zh/jp lyricPrimary should match`,
  );
  assert(
    zh.layout.zhMainPx === jp.layout.mainPx,
    `${profile} zhMainPx should equal mainPx`,
  );
}

const mobileJp = resolvePosterTypography({ profile: 'mobilePoster', lang: 'jp', spacingScale: 1 });
assert(
  mobileJp.roles.lyricPrimary.fontFamily === KOZMIN_PRO_REGULAR_FAMILY,
  'jp lyricPrimary uses KozMin Pro Light (Kozuka Mincho Pro R stack)',
);
assert(
  mobileJp.roles.lyricPrimary.fontWeight === LYRIC_PRIMARY_WEIGHT,
  'lyricPrimary weight 400',
);
assert(
  mobileJp.roles.lyricSecondary.fontWeight === LYRIC_SECONDARY_WEIGHT,
  'lyricSecondary weight 300',
);
assert(
  mobileJp.roles.rubyAnnotation.fontFamily.includes('Kozuka Mincho Pro EL'),
  'jp ruby uses ExtraLight',
);

const zhTight = resolvePosterTypography({ profile: 'mobilePoster', lang: 'zh', spacingScale: 0.9 });
const jpTight = resolvePosterTypography({ profile: 'mobilePoster', lang: 'jp', spacingScale: 0.9 });
assert(
  zhTight.roles.lyricPrimary.fontSize === jpTight.roles.lyricPrimary.fontSize,
  'zh/jp stay matched at spacingScale 0.9',
);
assert(
  zhTight.layout.zhMainPx === zhTight.roles.lyricPrimary.fontSize,
  'zhMainPx equals lyricPrimary',
);

const mobileEn = resolvePosterTypography({ profile: 'mobilePoster', lang: 'en', spacingScale: 1 });
assert(mobileEn.roles.lyricPrimary.fontWeight === 400, 'en lyricPrimary weight 400');
assert(
  mobileEn.roles.lyricPrimary.fontFamily === KOZMIN_PRO_REGULAR_FAMILY,
  'en lyricPrimary uses KozMin Pro Light',
);
assert(
  mobileEn.roles.lyricSecondary.fontFamily === KOZMIN_PRO_REGULAR_FAMILY,
  'en gloss-line uses KozMin Pro Light',
);

const mobileZh = resolvePosterTypography({ profile: 'mobilePoster', lang: 'zh', spacingScale: 1 });
assert(
  mobileZh.roles.lyricSecondary.fontFamily === KOZMIN_PRO_REGULAR_FAMILY,
  'zh gloss-line uses KozMin Pro Light',
);

const mobileKo = resolvePosterTypography({ profile: 'mobilePoster', lang: 'ko', spacingScale: 1 });
assert(mobileKo.roles.lyricPrimary.fontWeight === 400, 'ko lyricPrimary weight 400');
assert(mobileKo.roles.studyTerm.lineHeight === 1.25, 'ko studyTerm compact lh');
assert(mobileKo.roles.studyExample.fontSize === 32, 'ko studyExample uses auxPx');

const mobileJpStudy = resolvePosterTypography({ profile: 'mobilePoster', lang: 'jp', spacingScale: 1 });
assert(mobileJpStudy.roles.studyExample.fontSize === 32, 'jp studyExample uses auxPx');
assert(mobileJpStudy.roles.studyExample.lineHeight === 1.48, 'jp studyExample jpLh');
assert(mobileJpStudy.roles.studyTerm.fontSize === 46, 'jp studyTerm uses mainPx');
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
  'ko posterTitle stacks Songti SC before Batang for Han',
);
assert(
  mobileKo.roles.posterTitle.fontFamily.includes('HCR Batang'),
  'ko posterTitle keeps Batang for Hangul fallback',
);

console.log('testPosterTypography: OK');
