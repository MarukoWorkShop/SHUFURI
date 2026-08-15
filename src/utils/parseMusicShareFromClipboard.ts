import {
  isQQMusicShare,
  parseQQMusicShare,
  isNetEaseMusicShare,
  parseNetEaseMusicShare,
} from '../utils/nativeBridge';
import { detectLyricsLanguage } from '../codec/detectLyricsLanguage';

export type MusicShareClipData = {
  title: string;
  artist: string;
  detectedLanguage?: 'jp' | 'ko' | 'zh';
};

/**
 * 标题中的语种版本标注（如「(KOR Ver.)」「(中文版)」「(English Ver.)」），是比文字脚本
 * 更可靠的语义信号。命中即直接判为对应语种，不被中文汉字标题带偏。
 */
const VERSION_LANG_RE =
  /\(\s*(CHN|Chinese|中文|国语|普通话|ZH|ENG?|English|英文|英语|JP|Japanese|日本語|日文|日语|KOR|Korean|한국어|韩文|韩语)\b[^)]*\)/i;
const KO_VERSION_HINT = /韩文版|韩语版|韩文歌|韩语歌|한국어\s*버전/i;
const JP_VERSION_HINT = /日文版|日语版/i;
const ZH_VERSION_HINT = /中文版|国语版|普通话版|华语版/i;
const EN_VERSION_HINT = /英文版|英语版/i;

/** 从标题版本标注里读取语种（jp/ko/zh/en），无标注返回 undefined */
function langFromVersionHint(title: string): 'jp' | 'ko' | 'zh' | 'en' | undefined {
  const m = title.match(VERSION_LANG_RE);
  if (!m) {
    if (KO_VERSION_HINT.test(title)) return 'ko';
    if (JP_VERSION_HINT.test(title)) return 'jp';
    if (ZH_VERSION_HINT.test(title)) return 'zh';
    if (EN_VERSION_HINT.test(title)) return 'en';
    return undefined;
  }
  const key = m[1].toUpperCase();
  if (['KOR', 'KOREAN', '한국어', '韩文', '韩语'].includes(key)) return 'ko';
  if (['JP', 'JAPANESE', '日本語', '日文', '日语'].includes(key)) return 'jp';
  if (['CHN', 'ZH', 'CHINESE', '中文', '国语', '普通话'].includes(key)) return 'zh';
  if (['ENG', 'EN', 'ENGLISH', '英文', '英语'].includes(key)) return 'en';
  return undefined;
}

/** 文本是否含有日语假名（平/片假名） */
const RE_HAS_KANA = /[\u3040-\u309f\u30a0-\u30ff]/;
/** 文本是否含 Hangul */
const RE_HAS_HANGUL = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/;

/**
 * 从歌名 + 歌手联合推断语种（方案 B）。
 *
 * 设计要点：
 * - 标题内的版本标注（「(KOR Ver.)」「(日本語版)」等）权重最高，命中即直接返回，
 *   不被纯汉字标题带偏（高权重因子保留）。
 * - 歌名（常是纯汉字，如「秋桜」）信号弱时，结合歌手字段判断：歌手含假名 → 日语；
 *   歌手含 Hangul → 韩语。这样「秋桜 / 山口百恵（やまぐち ももえ）」能正确判为日文。
 * - 复用 codec 层 `detectLyricsLanguage` 识别 zh/en 等场景；纯兜底 jp 与英文标题
 *   对「分析学习语言」无价值，收敛为 undefined 避免误导。
 */
function detectTitleLang(
  title: string,
  artist: string = '',
): 'jp' | 'ko' | 'zh' | undefined {
  // 1) 优先采用标题内的版本标注（高权重因子，不受脚本统计影响）
  const versionLang = langFromVersionHint(title);
  if (versionLang === 'ko' || versionLang === 'jp' || versionLang === 'zh') return versionLang;
  // 英文版标注：标题文字无法代表可学习语种，收敛为 undefined
  if (versionLang === 'en') return undefined;

  const detected = detectLyricsLanguage(title);

  // 2) 标题是纯汉字（无假名）这种歧义场景：用歌手字段联合判断
  if (detected === 'zh' || detected === 'jp') {
    if (!RE_HAS_KANA.test(title) && artist && RE_HAS_KANA.test(artist)) {
      return 'jp'; // 歌手含假名 → 强日语信号
    }
    if (!RE_HAS_HANGUL.test(title) && artist && RE_HAS_HANGUL.test(artist)) {
      return 'ko'; // 歌手含 Hangul → 强韩语信号
    }
  }

  // 3) 标题场景只关心可学习语种（jp/ko/zh）。纯兜底 jp 与英文标题对「分析学习语言」无价值，
  //    收敛为 undefined，避免误导。
  if (detected === 'en') return undefined;
  if (detected === 'jp') {
    const hasKana = RE_HAS_KANA.test(title) || RE_HAS_KANA.test(artist);
    if (!hasKana) return undefined;
  }
  return detected as 'jp' | 'ko' | 'zh' | undefined;
}

/** 从剪贴板文本解析 QQ / 网易云分享链接中的歌名与歌手 */
export function parseMusicShareFromClipboard(trimmed: string): MusicShareClipData | null {
  if (isQQMusicShare(trimmed)) {
    const parsed = parseQQMusicShare(trimmed);
    if (!parsed.title) return null;
    return {
      title: parsed.title,
      artist: parsed.artist || '',
      detectedLanguage: detectTitleLang(parsed.title, parsed.artist || ''),
    };
  }
  if (isNetEaseMusicShare(trimmed)) {
    const parsed = parseNetEaseMusicShare(trimmed);
    if (!parsed.title) return null;
    return {
      title: parsed.title,
      artist: parsed.artist || '',
      detectedLanguage: detectTitleLang(parsed.title, parsed.artist || ''),
    };
  }
  return null;
}
