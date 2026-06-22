import {
  isQQMusicShare,
  parseQQMusicShare,
  isNetEaseMusicShare,
  parseNetEaseMusicShare,
} from '../utils/nativeBridge';

export type MusicShareClipData = {
  title: string;
  artist: string;
  detectedLanguage?: 'jp' | 'ko';
};

function detectTitleLang(title: string): 'jp' | 'ko' | undefined {
  const hasKana = /[\u3040-\u309f\u30a0-\u30ff]/.test(title);
  const hasHangul = /[\uAC00-\uD7AF]/.test(title);
  if (hasKana) return 'jp';
  if (hasHangul) return 'ko';
  return undefined;
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
