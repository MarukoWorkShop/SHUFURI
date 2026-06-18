import { resolveSystemInterfaceLanguage } from './languageMatrix/resolveSystemLanguage';
import {
  normalizeActiveTarget,
  normalizeLearningTargetLanguages,
} from './languageMatrix/wheelLanguages';
import type { InterfaceLanguage, LearningTargetLanguage } from './languageMatrix/types';

/** 拨轮当前学习目标语言 */
export type LyricsLanguage = LearningTargetLanguage;

/** 排版管线语言编码：由大模型声明或自动检测，决定走哪条排版管线（与波轮解耦） */
export type LangCode = 'jp' | 'ko' | 'en' | 'zh';

/** 全局换肤：mono 墨 | blue 绀 | red 赤 */
export type ColorTheme = 'mono' | 'blue' | 'red';

export type { InterfaceLanguage, LearningTargetLanguage };

export type AppSettings = {
  /** 界面配色主题 */
  colorTheme: ColorTheme;
  /** 首页「一键生成指令」默认是否附带词解与语法 */
  defaultIncludeVocabAndGrammar: boolean;
  /** 使用语言：Prompt 释义/解析输出语言 */
  interfaceLanguage: InterfaceLanguage;
  /** 启动时跟随 navigator.language 更新 interfaceLanguage */
  followSystemInterfaceLanguage: boolean;
  /** 学习目标语言多选 */
  learningTargetLanguages: LearningTargetLanguage[];
  /** 拨轮当前目标：jp / ko / en / zh */
  lyricsLanguage: LyricsLanguage;
  /** 抽屉、铅笔等交互音效 */
  interactionSoundsEnabled: boolean;
};

const STORAGE_KEY = 'shufu-lyrics-app-settings';

function buildDefaults(): AppSettings {
  return {
    colorTheme: 'mono',
    defaultIncludeVocabAndGrammar: true,
    interfaceLanguage: resolveSystemInterfaceLanguage(),
    followSystemInterfaceLanguage: true,
    learningTargetLanguages: ['jp', 'ko', 'en'],
    lyricsLanguage: 'jp',
    interactionSoundsEnabled: true,
  };
}

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

function isLyricsLanguage(v: unknown): v is LyricsLanguage {
  return v === 'jp' || v === 'ko' || v === 'en' || v === 'zh';
}

function isInterfaceLanguage(v: unknown): v is InterfaceLanguage {
  return v === 'zh' || v === 'en';
}

export function getAppSettings(): AppSettings {
  const DEFAULTS = buildDefaults();
  const stored = readStored();
  if (!stored) return { ...DEFAULTS };

  const legacyIncludeVocab = stored.includeVocabAndGrammar;
  const includeVocabAndGrammar =
    typeof stored.defaultIncludeVocabAndGrammar === 'boolean'
      ? stored.defaultIncludeVocabAndGrammar
      : typeof legacyIncludeVocab === 'boolean'
        ? legacyIncludeVocab
        : DEFAULTS.defaultIncludeVocabAndGrammar;

  const learningTargetLanguages = normalizeLearningTargetLanguages(
    stored.learningTargetLanguages,
  );

  const legacyLang = stored.lyricsLanguage as unknown;
  const rawLyricsLanguage =
    legacyLang === 'auto' || !isLyricsLanguage(stored.lyricsLanguage)
      ? learningTargetLanguages[0] ?? 'jp'
      : stored.lyricsLanguage;

  return {
    colorTheme: isColorTheme(stored.colorTheme) ? stored.colorTheme : DEFAULTS.colorTheme,
    defaultIncludeVocabAndGrammar: includeVocabAndGrammar,
    interfaceLanguage: isInterfaceLanguage(stored.interfaceLanguage)
      ? stored.interfaceLanguage
      : DEFAULTS.interfaceLanguage,
    followSystemInterfaceLanguage:
      typeof stored.followSystemInterfaceLanguage === 'boolean'
        ? stored.followSystemInterfaceLanguage
        : DEFAULTS.followSystemInterfaceLanguage,
    learningTargetLanguages,
    lyricsLanguage: normalizeActiveTarget(rawLyricsLanguage, learningTargetLanguages),
    interactionSoundsEnabled:
      typeof stored.interactionSoundsEnabled === 'boolean'
        ? stored.interactionSoundsEnabled
        : DEFAULTS.interactionSoundsEnabled,
  };
}

export function saveAppSettings(partial: Partial<AppSettings>): AppSettings {
  const current = getAppSettings();
  const merged = { ...current, ...partial };

  if (partial.learningTargetLanguages || partial.lyricsLanguage !== undefined) {
    const targets = partial.learningTargetLanguages ?? merged.learningTargetLanguages;
    merged.lyricsLanguage = normalizeActiveTarget(merged.lyricsLanguage, targets);
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  }
  return merged;
}

/** 跟随系统语言刷新 interfaceLanguage（启动时调用） */
export function syncInterfaceLanguageFromSystem(): AppSettings {
  const settings = getAppSettings();
  if (!settings.followSystemInterfaceLanguage) return settings;
  const next = resolveSystemInterfaceLanguage();
  if (next === settings.interfaceLanguage) return settings;
  return saveAppSettings({ interfaceLanguage: next });
}

export function isInteractionSoundEnabled(): boolean {
  return getAppSettings().interactionSoundsEnabled;
}

export { resolveSystemInterfaceLanguage };
