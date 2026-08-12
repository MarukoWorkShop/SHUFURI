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

/**
 * 从歌名推断语种。复用 codec 层的 `detectLyricsLanguage`（支持 jp/ko/zh/en），
 * 它能识别中文（纯汉字）与英文（拉丁主导）标题，弥补原先只识别假名/Hangul 的缺陷。
 *
 * `detectLyricsLanguage` 对无脚本信号的文本默认回退 'jp'，这里对纯兜底结果收敛为
 * undefined，避免把「英文/无信号标题」误判成日语。
 */
function detectTitleLang(title: string): 'jp' | 'ko' | 'zh' | undefined {
  // 优先采用标题内的版本标注（「(KOR Ver.)」等），它比脚本统计更可靠。
  const versionLang = langFromVersionHint(title);
  if (versionLang === 'ko' || versionLang === 'jp' || versionLang === 'zh') return versionLang;
  // 英文版标注：标题文字无法代表可学习语种，收敛为 undefined
  if (versionLang === 'en') return undefined;

  const detected = detectLyricsLanguage(title);
  // 标题场景只关心可学习语种（jp/ko/zh）。纯兜底 jp 与英文标题对「分析学习语言」无价值，
  // 收敛为 undefined，避免误导。
  if (detected === 'en') return undefined;
  if (detected === 'jp') {
    const hasKana = /[\u3040-\u309f\u30a0-\u30ff]/.test(title);
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
      detectedLanguage: detectTitleLang(parsed.title),
    };
  }
  if (isNetEaseMusicShare(trimmed)) {
    const parsed = parseNetEaseMusicShare(trimmed);
    if (!parsed.title) return null;
    return {
      title: parsed.title,
      artist: parsed.artist || '',
      detectedLanguage: detectTitleLang(parsed.title),
    };
  }
  return null;
}
