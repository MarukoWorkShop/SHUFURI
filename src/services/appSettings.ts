import type { PosterLayoutProfile } from '../utils/furiganaLayout/types';

/** 歌词语言模式：auto（自动，默认）、日语、韩语或英语 */
export type LyricsLanguage = 'auto' | 'jp' | 'ko' | 'en';

/** 排版管线语言编码：由大模型声明或自动检测，决定走哪条排版管线（与波轮解耦） */
export type LangCode = 'jp' | 'ko' | 'en' | 'zh';

/** 全局换肤：mono 墨 | blue 绀 | red 赤 */
export type ColorTheme = 'mono' | 'blue' | 'red';

export type AppSettings = {
  /** 界面配色主题 */
  colorTheme: ColorTheme;
  /** 新建排版时的默认导出规格 */
  defaultExportLayout: PosterLayoutProfile;
  /** 首页「一键生成指令」默认是否附带词解与语法 */
  defaultIncludeVocabAndGrammar: boolean;
  /** 歌词语言模式：auto（自动，默认）、日语、韩语或英语 */
  lyricsLanguage: LyricsLanguage;
  /** 抽屉、铅笔等交互音效 */
  interactionSoundsEnabled: boolean;
};

const STORAGE_KEY = 'shufu-lyrics-app-settings';

const DEFAULTS: AppSettings = {
  colorTheme: 'mono',
  defaultExportLayout: 'clipPosterPrint',
  defaultIncludeVocabAndGrammar: true,
  lyricsLanguage: 'auto',
  interactionSoundsEnabled: true,
};

function isColorTheme(v: unknown): v is ColorTheme {
  return v === 'mono' || v === 'blue' || v === 'red';
}

function readStored(): Partial<AppSettings> & Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<AppSettings> & Record<string, unknown>;
  } catch {
    return null;
  }
}

function isLayoutProfile(v: unknown): v is PosterLayoutProfile {
  return v === 'clipPosterPrint' || v === 'mobilePoster';
}

function isLyricsLanguage(v: unknown): v is LyricsLanguage {
  return v === 'auto' || v === 'jp' || v === 'ko' || v === 'en';
}

export function getAppSettings(): AppSettings {
  const stored = readStored();
  if (!stored) return { ...DEFAULTS };

  const legacyIncludeVocab = stored.includeVocabAndGrammar;
  const includeVocabAndGrammar =
    typeof stored.defaultIncludeVocabAndGrammar === 'boolean'
      ? stored.defaultIncludeVocabAndGrammar
      : typeof legacyIncludeVocab === 'boolean'
        ? legacyIncludeVocab
        : DEFAULTS.defaultIncludeVocabAndGrammar;

  return {
    colorTheme: isColorTheme(stored.colorTheme) ? stored.colorTheme : DEFAULTS.colorTheme,
    defaultExportLayout: isLayoutProfile(stored.defaultExportLayout)
      ? stored.defaultExportLayout
      : DEFAULTS.defaultExportLayout,
    defaultIncludeVocabAndGrammar: includeVocabAndGrammar,
    lyricsLanguage: isLyricsLanguage(stored.lyricsLanguage)
      ? stored.lyricsLanguage
      : DEFAULTS.lyricsLanguage,
    interactionSoundsEnabled:
      typeof stored.interactionSoundsEnabled === 'boolean'
        ? stored.interactionSoundsEnabled
        : DEFAULTS.interactionSoundsEnabled,
  };
}

export function saveAppSettings(partial: Partial<AppSettings>): AppSettings {
  const next = { ...getAppSettings(), ...partial };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function isInteractionSoundEnabled(): boolean {
  return getAppSettings().interactionSoundsEnabled;
}
