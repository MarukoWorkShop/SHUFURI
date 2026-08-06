/**
 * 歌词语种自动检测。
 *
 * 场景：用户在「学习目标语言」拨轮上选了 JP，但粘贴进来一首歌词其实是中文 / 韩文 /
 * 英文。原 `matrix.activeTarget` 直接来自设置，会把后续 Encoder prompt 锁成 JP
 * 编码，导致 AI 在中文歌词上强行输出 `{漢字:かな}` 这种无意义的日语注音，
 * 并伪造日语单词。
 *
 * Step2 正确用法：只对 `extractLyricSurfaceForDetect`（L col3 原文）做检测，
 * 且仅在原文脚本「强证据」时才覆盖拨轮（见 `resolveStudySourceLanguage`）。
 * 切勿把含中文译文的整段确认流直接丢进 detect —— 汉字译文会压过 Hangul，误判为 zh。
 */

import { splitStreamColumns } from './splitStreamColumns';

export type DetectedLyricsLanguage = 'jp' | 'ko' | 'zh' | 'en';

const RE_HIRAGANA = /[\u3040-\u309f]/g;
const RE_KATAKANA = /[\u30a0-\u30ff\u31f0-\u31ff]/g;
const RE_HANGUL = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/g;
const RE_HANZI = /[\u4e00-\u9fff]/g;
const RE_LATIN = /[A-Za-z]/g;

export type LyricsScriptCounts = {
  hiragana: number;
  katakana: number;
  hangul: number;
  hanzi: number;
  latin: number;
};

/** 从确认流抽取 L 行 col3（歌词原文表面），供语种检测；不含 col4 译文。 */
export function extractLyricSurfaceForDetect(confirmedStream: string): string {
  if (!confirmedStream) return '';
  const surfaces: string[] = [];
  for (const rawLine of confirmedStream.split(/\r\n|\n|\r/)) {
    const line = rawLine.trim();
    if (!line.startsWith('L|')) continue;
    const cols = splitStreamColumns(line);
    const surface = (cols[2] ?? '').trim();
    if (surface) surfaces.push(surface);
  }
  return surfaces.join('\n');
}

export function countLyricsScriptSignals(text: string): LyricsScriptCounts {
  if (!text) {
    return { hiragana: 0, katakana: 0, hangul: 0, hanzi: 0, latin: 0 };
  }
  const stripped = text
    .replace(/\{[^}]*:[^}]*\}/g, ' ')
    .replace(/\{[^}]*\}/g, ' ');
  return {
    hiragana: (stripped.match(RE_HIRAGANA) ?? []).length,
    katakana: (stripped.match(RE_KATAKANA) ?? []).length,
    hangul: (stripped.match(RE_HANGUL) ?? []).length,
    hanzi: (stripped.match(RE_HANZI) ?? []).length,
    latin: (stripped.match(RE_LATIN) ?? []).length,
  };
}

/**
 * 从一段文本中检测主要语种。
 *
 * 判定顺序：
 *  1. 出现平假名 / 片假名 → jp（汉字在 JP 文本里也常见，但只要有假名就锁定 JP）
 *  2. 出现 Hangul 且多于汉字 → ko
 *  3. 出现汉字（且没有假名）→ zh
 *  4. 拉丁字母占主体 → en
 *  5. 都检测不到 → 退回 jp（保持向后兼容）
 *
 * @param text  任意纯文本（建议去除所有 `{漢字:かな}` / pinyin 之类的注解括号，
 *              让检测不被读音字符干扰）
 */
export function detectLyricsLanguage(text: string): DetectedLyricsLanguage {
  if (!text) return 'jp';

  const stripped = text
    // 去掉 ruby 注解：{漢字:かな} / {Hanzi:pinyin}
    .replace(/\{[^}]*:[^}]*\}/g, ' ')
    // 去掉 `{...}` 不带冒号的孤立标记（防御性）
    .replace(/\{[^}]*\}/g, ' ');

  const hiragana = (stripped.match(RE_HIRAGANA) ?? []).length;
  const katakana = (stripped.match(RE_KATAKANA) ?? []).length;
  const hangul = (stripped.match(RE_HANGUL) ?? []).length;
  const hanzi = (stripped.match(RE_HANZI) ?? []).length;
  const latin = (stripped.match(RE_LATIN) ?? []).length;

  const jpKana = hiragana + katakana;

  // 1) 任意假名 → 日语（含日语汉字）
  if (jpKana > 0) return 'jp';

  // 2) Hangul 主导 → 韩语（中文歌曲里偶尔夹一个 "韩国" 等专有名词的 Hangul 极少，
  //    需要一定频率才判定为 ko）
  if (hangul > 0 && hangul >= 4 && hangul > hanzi) return 'ko';

  // 3) 纯汉字（无假名）→ 中文。允许少量拉丁字母（拼音注解、英文专名）
  if (hanzi > 0) return 'zh';

  // 4) 拉丁字母主导 → 英文
  if (latin > 0) return 'en';

  return 'jp';
}

/**
 * 原文脚本是否对 `detected` 构成「强证据」（足以覆盖拨轮）。
 * 弱信号或空原文 → 不覆盖，信拨轮。
 */
export function hasStrongScriptEvidenceFor(
  detected: DetectedLyricsLanguage,
  counts: LyricsScriptCounts,
): boolean {
  const kana = counts.hiragana + counts.katakana;
  switch (detected) {
    case 'jp':
      return kana >= 2;
    case 'ko':
      return counts.hangul >= 4 && counts.hangul > counts.hanzi;
    case 'zh':
      // 真·中文歌：汉字主导，且几乎无 Hangul / 假名
      return counts.hanzi >= 4 && counts.hangul < 4 && kana === 0;
    case 'en':
      return counts.latin >= 8 && counts.hangul === 0 && kana === 0 && counts.hanzi === 0;
    default:
      return false;
  }
}

/**
 * 是否用检测结果覆盖拨轮。
 * @param surfaceText L col3 原文（空则永不覆盖）
 */
export function shouldOverrideActiveTarget(
  detected: DetectedLyricsLanguage,
  user: DetectedLyricsLanguage,
  surfaceText = '',
): boolean {
  if (!surfaceText.trim()) return false;
  if (detected === user) return false;
  const counts = countLyricsScriptSignals(surfaceText);
  return hasStrongScriptEvidenceFor(detected, counts);
}

export type ResolveStudySourceResult = {
  /** 最终用于口令 / 缓存键的源语 */
  effective: DetectedLyricsLanguage;
  detected: DetectedLyricsLanguage;
  surface: string;
  overrideApplied: boolean;
};

/**
 * Step2 源语决议：只看 L col3；仅原文强证据才覆盖拨轮。
 */
export function resolveStudySourceLanguage(
  confirmedLyrics: string,
  wheel: DetectedLyricsLanguage,
): ResolveStudySourceResult {
  const surface = extractLyricSurfaceForDetect(confirmedLyrics);
  const detected = detectLyricsLanguage(surface);
  const overrideApplied = shouldOverrideActiveTarget(detected, wheel, surface);
  return {
    effective: overrideApplied ? detected : wheel,
    detected,
    surface,
    overrideApplied,
  };
}
