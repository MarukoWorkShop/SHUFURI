/**
 * 歌词语种自动检测。
 *
 * 场景：用户在「学习目标语言」拨轮上选了 JP，但粘贴进来一首歌词其实是中文 / 韩文 /
 * 英文。原 `matrix.activeTarget` 直接来自设置，会把后续 Encoder prompt 锁成 JP
 * 编码，导致 AI 在中文歌词上强行输出 `{漢字:かな}` 这种无意义的日语注音，
 * 并伪造日语单词。
 *
 * 这里按 Unicode 区段扫描一段歌词文本，给出最可能的来源语种。返回类型与
 * `LyricsLanguage` 对齐（jp / ko / zh / en），与 `buildEncoderPrompt` 的
 * switch 分支兼容。
 */

export type DetectedLyricsLanguage = 'jp' | 'ko' | 'zh' | 'en';

const RE_HIRAGANA = /[\u3040-\u309f]/g;
const RE_KATAKANA = /[\u30a0-\u30ff\u31f0-\u31ff]/g;
const RE_HANGUL = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/g;
const RE_HANZI = /[\u4e00-\u9fff]/g;
const RE_LATIN = /[A-Za-z]/g;

/**
 * 从一段文本中检测主要语种。
 *
 * 判定顺序：
 *  1. 出现平假名 / 片假名 → jp（汉字在 JP 文本里也常见，但只要有假名就锁定 JP）
 *  2. 出现 Hangul 且 hanzi 极少 → ko
 *  3. 出现汉字（且没有假名 / 极少 Hangul）→ zh
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
  //    需要一定阈值才判定为 ko）
  if (hangul > 0 && hangul >= 4 && hangul > hanzi) return 'ko';

  // 3) 纯汉字（无假名）→ 中文。允许少量拉丁字母（拼音注解、英文专名）
  if (hanzi > 0) return 'zh';

  // 4) 拉丁字母主导 → 英文
  if (latin > 0) return 'en';

  return 'jp';
}

/**
 * 判断 `detected` 是否与 `user` 不同；用于决定是否需要用检测到的语种
 * 覆盖 `matrix.activeTarget`。
 */
export function shouldOverrideActiveTarget(
  detected: DetectedLyricsLanguage,
  user: DetectedLyricsLanguage,
): boolean {
  return detected !== user;
}