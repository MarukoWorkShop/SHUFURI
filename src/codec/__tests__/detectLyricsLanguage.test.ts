import { describe, expect, it } from 'vitest';
import {
  countLyricsScriptSignals,
  detectLyricsLanguage,
  extractLyricSurfaceForDetect,
  resolveStudySourceLanguage,
  shouldOverrideActiveTarget,
} from '../detectLyricsLanguage';
import { stripLyricTranslationColumn } from '../prompt/encoderCommon';
import { isZhPinyinVocabPoison } from '../studyVocabSanity';

/** 译文偏长时，整段确认流的汉字会压过 Hangul → 旧逻辑误判 zh */
const KO_WITH_LONG_ZH_GLOSS = `@0
H|Vibe|그남자 그여자|ko
L|1|혹시 니가 다시 돌아올까봐|或许你会再次回到我身边来找我吧我还在这里等待着你的消息
L|2|아직도 너를 기다리지만|虽然我到现在还在等待着你却什么也做不了只能这样
L|3|절대 책임지지 마|绝对不要对我负起任何责任这只是一句任性的话而已
L|4|난 괜찮아|我没事的你不用担心我一个人也可以好好生活下去
L|5|그냥 스쳐 가는 인연이었어|我们不过是彼此生命里擦肩而过的一段缘分罢了
@9`;

describe('extractLyricSurfaceForDetect', () => {
  it('只保留 L col3，不含中文译文', () => {
    const surface = extractLyricSurfaceForDetect(KO_WITH_LONG_ZH_GLOSS);
    expect(surface).toContain('혹시');
    expect(surface).not.toContain('或许');
    expect(surface).not.toContain('绝对');
  });
});

describe('stripLyricTranslationColumn', () => {
  it('去掉 L col4 中文译文，保留韩文原文', () => {
    const stripped = stripLyricTranslationColumn(KO_WITH_LONG_ZH_GLOSS);
    expect(stripped).toContain('혹시 니가 다시 돌아올까봐');
    expect(stripped).not.toContain('或许');
    expect(stripped).toMatch(/L\|1\|혹시[^|]*\|/);
  });
});

describe('detectLyricsLanguage · 韩歌+中文译文误检对照', () => {
  it('整段确认流（长译文）易误判为 zh', () => {
    expect(detectLyricsLanguage(KO_WITH_LONG_ZH_GLOSS)).toBe('zh');
  });

  it('仅 L col3 原文应判为 ko', () => {
    const surface = extractLyricSurfaceForDetect(KO_WITH_LONG_ZH_GLOSS);
    expect(detectLyricsLanguage(surface)).toBe('ko');
    const counts = countLyricsScriptSignals(surface);
    expect(counts.hangul).toBeGreaterThan(counts.hanzi);
  });
});

describe('resolveStudySourceLanguage · 拨轮优先', () => {
  it('拨轮=ko + 长中文译文：不覆盖，effective=ko', () => {
    const r = resolveStudySourceLanguage(KO_WITH_LONG_ZH_GLOSS, 'ko');
    expect(r.detected).toBe('ko');
    expect(r.overrideApplied).toBe(false);
    expect(r.effective).toBe('ko');
  });

  it('拨轮=jp（默认）+ 韩文原文强证据：覆盖为 ko', () => {
    const r = resolveStudySourceLanguage(KO_WITH_LONG_ZH_GLOSS, 'jp');
    expect(r.detected).toBe('ko');
    expect(r.overrideApplied).toBe(true);
    expect(r.effective).toBe('ko');
  });

  it('空原文：永不覆盖', () => {
    expect(shouldOverrideActiveTarget('zh', 'ko', '')).toBe(false);
  });
});

describe('isZhPinyinVocabPoison', () => {
  const poisonColon = `@0
@1
V|1|{生:shēng}{怕:pà}|非常担心|1||生怕你会回来
V|2|{再:zài}{也:yě}|强调不再|2||再也见不到
V|3|{负:fù}{责:zé}|承担责任|3||负责到底
@9`;

  const poisonCompact = `@0
@1
V|1|{飘piāo}{荡dàng}|在空中浮动|1||柳条飘荡
V|2|{漫màn}{步bù}|悠闲地走|2||慢慢漫步
V|3|{拂fú}{过guò}|轻轻擦过|3||春风拂过
@9`;

  it('源语 ko + 冒号拼音 V → 毒', () => {
    expect(isZhPinyinVocabPoison(poisonColon, 'ko')).toBe(true);
  });

  it('源语 ko + 紧贴拼音 V（截图形态）→ 毒', () => {
    expect(isZhPinyinVocabPoison(poisonCompact, 'ko')).toBe(true);
  });

  it('源语 zh 时不算毒', () => {
    expect(isZhPinyinVocabPoison(poisonColon, 'zh')).toBe(false);
  });
});
