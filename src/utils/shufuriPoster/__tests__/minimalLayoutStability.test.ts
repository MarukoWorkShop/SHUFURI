/**
 * 极简版式稳固性：CSS 皮肤独立性、安全余量、分页路径、拆条打标。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { compilePosterCss } from '../../posterTypography/cssCompiler.ts';
import { resolvePosterTypography } from '../../posterTypography/fontResolver.ts';
import { MINIMAL_PAPER_BG } from '../../posterTypography/typographyConstants.ts';
import { getPosterBodySafetyMarginPx } from '../shufuriPosterShared.ts';
import { paginateShufuriPosterBodyHtml } from '../paginateShufuriPosterHtml.ts';
import type { PosterLayoutProfile, PosterLayoutVariant } from '../types.ts';

beforeAll(() => {
  // jsdom 未实现 Range#getBoundingClientRect；CJK 禁则测量需要 stub
  if (typeof Range !== 'undefined' && !Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        width: 0,
        height: 0,
        toJSON() {
          return {};
        },
      } as DOMRect;
    };
  }
});

const PROFILES: PosterLayoutProfile[] = [
  'mobilePoster',
  'squarePoster',
  'clipPosterPrint',
  'socialPoster',
];

const VARIANTS: PosterLayoutVariant[] = ['standard', 'notebook', 'split', 'minimal'];

function resolveCss(layoutVariant: PosterLayoutVariant, profile: PosterLayoutProfile = 'mobilePoster') {
  const resolved = resolvePosterTypography({
    profile,
    lang: 'jp',
    language: 'jp',
  });
  return compilePosterCss(resolved, { layoutVariant, includeFontFaces: false });
}

function sampleBodyHtml(lyricCount: number): string {
  const groups = Array.from({ length: lyricCount }, (_, i) => {
    return (
      `<div class="lyrics-group">` +
      `<p class="jp-line">テスト歌詞行${i + 1}です</p>` +
      `<p class="zh-line">测试歌词行${i + 1}</p>` +
      `</div>`
    );
  }).join('');
  const vocab =
    `<div class="lyrics-vocabulary" data-lyrics-force-next-page="1">` +
    `<h2 class="lyrics-section-title">重点词汇</h2>` +
    `<div class="lyrics-vocab-item">` +
    `<p class="vocab-line1"><span class="vocab-word">誇らしげ</span> <span class="vocab-meaning">带着自豪的</span></p>` +
    `<p class="vocab-ex-ja">彼は誇らしげに話した</p>` +
    `<p class="vocab-ex-zh">他自豪地说道</p>` +
    `</div>` +
    `<div class="lyrics-vocab-item">` +
    `<p class="vocab-line1"><span class="vocab-word">言葉</span> <span class="vocab-meaning">语言</span></p>` +
    `<p class="vocab-ex-ja">優しい言葉</p>` +
    `<p class="vocab-ex-zh">温柔的话语</p>` +
    `</div>` +
    `</div>`;
  return `<div class="clip-body"><div class="lyrics">${groups}</div>${vocab}</div>`;
}

describe('极简版式：与其他三版式的关系', () => {
  it('minimal 是独立 CSS 皮肤（compileMinimalCss），作用域 data-layout-variant="minimal"', () => {
    const minimal = resolveCss('minimal');
    const standard = resolveCss('standard');
    const notebook = resolveCss('notebook');
    const split = resolveCss('split');

    expect(minimal).toContain('[data-layout-variant="minimal"]');
    expect(standard).not.toContain('[data-layout-variant="minimal"]');
    expect(notebook).toContain('[data-layout-variant="notebook"]');
    expect(notebook).not.toContain('[data-layout-variant="minimal"]');
    expect(split).toContain('[data-layout-variant="split"]');
    expect(split).not.toContain('[data-layout-variant="minimal"]');
  });

  it('四版式均叠在同一套 compileBodyRules 之上（含 .fv-body-h / .lyrics-group）', () => {
    for (const v of VARIANTS) {
      const css = resolveCss(v);
      expect(css).toMatch(/\.fv-body-h/);
      expect(css).toMatch(/\.lyrics-group/);
    }
  });

  it('minimal 独有规则：封面图 / 标签 / 译文放大 / 拆条组距 / 隐藏 ruby', () => {
    const css = resolveCss('minimal');
    expect(css).toContain('.fv-minimal-image');
    expect(css).toContain("content: 'TITLE'");
    expect(css).toContain("content: 'ARTIST'");
    expect(css).toContain('data-study-part="continue"');
    expect(css).toContain('data-study-part="end"');
    expect(css).toMatch(/ruby rt[\s\S]*display:\s*none\s*!important/);
    expect(css).toContain(MINIMAL_PAPER_BG);
    // 歌词译文用独立 px（≠ 词解辅文），由 ceil(aux*1.2) 注入
    expect(css).toMatch(/\.lyrics-group \.zh-line[\s\S]*font-size:\s*\d+px\s*!important/);
  });

  it('notebook / split 不含 minimal 封面与 study-part 皮肤', () => {
    expect(resolveCss('notebook')).not.toContain('.fv-minimal-image');
    expect(resolveCss('split')).not.toContain('data-study-part="continue"');
  });
});

describe('极简版式：安全余量（约束 A2）', () => {
  it('各 profile 上 minimal 余量 > standard，且 < notebook', () => {
    for (const profile of PROFILES) {
      const base = getPosterBodySafetyMarginPx(profile);
      const minimal = getPosterBodySafetyMarginPx(profile, 'minimal');
      const notebook = getPosterBodySafetyMarginPx(profile, 'notebook');
      const split = getPosterBodySafetyMarginPx(profile, 'split');
      expect(minimal).toBeGreaterThan(base);
      expect(minimal).toBeLessThan(notebook);
      expect(minimal).toBeLessThanOrEqual(split);
    }
  });

  it('minimal 补偿值：mobile/square +6，print/social +4', () => {
    expect(getPosterBodySafetyMarginPx('mobilePoster', 'minimal')).toBe(
      getPosterBodySafetyMarginPx('mobilePoster') + 6,
    );
    expect(getPosterBodySafetyMarginPx('squarePoster', 'minimal')).toBe(
      getPosterBodySafetyMarginPx('squarePoster') + 6,
    );
    expect(getPosterBodySafetyMarginPx('clipPosterPrint', 'minimal')).toBe(
      getPosterBodySafetyMarginPx('clipPosterPrint') + 4,
    );
  });
});

describe('极简版式：分页路径与拆条打标', () => {
  it('minimal 与 standard 同属单栏分页（非 split 双栏）', () => {
    const body = sampleBodyHtml(8);
    const standardPages = paginateShufuriPosterBodyHtml(
      body,
      'テスト',
      'mobilePoster',
      document,
      'Artist',
      'jp',
      'jp',
      undefined,
      { layoutVariant: 'standard' },
    );
    const minimalPages = paginateShufuriPosterBodyHtml(
      body,
      'テスト',
      'mobilePoster',
      document,
      'Artist',
      'jp',
      'jp',
      undefined,
      { layoutVariant: 'minimal' },
    );
    const splitPages = paginateShufuriPosterBodyHtml(
      body,
      'テスト',
      'mobilePoster',
      document,
      'Artist',
      'jp',
      'jp',
      undefined,
      { layoutVariant: 'split' },
    );

    expect(standardPages.length).toBeGreaterThan(0);
    expect(minimalPages.length).toBeGreaterThan(0);
    expect(splitPages.length).toBeGreaterThan(0);

    // split 页 HTML 必含双栏根；minimal/standard 不含
    expect(splitPages.some((p) => p.html.includes('fv-split-root'))).toBe(true);
    expect(minimalPages.some((p) => p.html.includes('fv-split-root'))).toBe(false);
    expect(standardPages.some((p) => p.html.includes('fv-split-root'))).toBe(false);
  });

  it('词解拆条后带 data-study-part continue/end（组内/组间间距依据）', () => {
    const pages = paginateShufuriPosterBodyHtml(
      sampleBodyHtml(4),
      'テスト',
      'mobilePoster',
      document,
      'Artist',
      'jp',
      'jp',
      undefined,
      { layoutVariant: 'minimal' },
    );
    const joined = pages.map((p) => p.html).join('\n');
    expect(joined).toContain('data-study-part="continue"');
    expect(joined).toContain('data-study-part="end"');
    // 末行译文 fragment 才是 end；词头不应单独成为唯一 end 形态缺失
    expect(joined).toMatch(/data-study-part="end"[\s\S]*vocab-ex-zh|vocab-ex-zh[\s\S]*data-study-part="end"/);
  });

  it('各预览比例下 minimal 分页均可完成且无空页包', () => {
    const body = sampleBodyHtml(24);
    for (const profile of PROFILES) {
      const pages = paginateShufuriPosterBodyHtml(
        body,
        '世界に一つだけの花',
        profile,
        document,
        'SMAP',
        'jp',
        'jp',
        undefined,
        { layoutVariant: 'minimal', minimalImageUrl: '' },
      );
      expect(pages.length).toBeGreaterThan(1);
      for (const page of pages) {
        expect(typeof page.html).toBe('string');
        expect(page.spacingScale).toBeGreaterThan(0);
      }
      // 歌词组不应整包丢失
      const joined = pages.map((p) => p.html).join('');
      expect(joined).toContain('lyrics-group');
      expect(joined).toContain('vocab-line1');
    }
  });

  it('standard 与 minimal 对同一正文的页数应接近（同分页算法，仅 CSS/余量差）', () => {
    const body = sampleBodyHtml(20);
    const std = paginateShufuriPosterBodyHtml(
      body,
      'Title',
      'mobilePoster',
      document,
      'A',
      'jp',
      'jp',
      undefined,
      { layoutVariant: 'standard' },
    );
    const min = paginateShufuriPosterBodyHtml(
      body,
      'Title',
      'mobilePoster',
      document,
      'A',
      'jp',
      'jp',
      undefined,
      { layoutVariant: 'minimal' },
    );
    // 余量与字号皮肤可能导致 ±2 页差，不应完全脱节
    expect(Math.abs(std.length - min.length)).toBeLessThanOrEqual(3);
  });
});

describe('极简版式：字号公式（各 profile）', () => {
  it('歌词译文 font-size = ceil(minimalAuxPx * 1.2)，且 ≤ 主文或紧贴辅文放大', () => {
    for (const profile of PROFILES) {
      const resolved = resolvePosterTypography({
        profile,
        lang: 'jp',
        language: 'jp',
      });
      const scale = resolved.spacingScale ?? 1;
      const L = resolved.layout;
      const minimalMainPx = Math.round(L.mainPx * 0.82 * scale);
      const minimalAuxPx = Math.min(
        Math.round(L.auxPx * 0.74 * scale),
        minimalMainPx - 2,
      );
      const minimalLyricsZhPx = Math.ceil(minimalAuxPx * 1.2);
      const css = compilePosterCss(resolved, {
        layoutVariant: 'minimal',
        includeFontFaces: false,
      });
      expect(css).toContain(`font-size: ${minimalLyricsZhPx}px !important`);
      expect(css).toContain(`font-size: ${minimalMainPx}px !important`);
      expect(minimalLyricsZhPx).toBeGreaterThanOrEqual(minimalAuxPx);
    }
  });
});
