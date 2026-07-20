import { resolveSystemInterfaceLanguage } from './languageMatrix/resolveSystemLanguage';
import {
  normalizeActiveTarget,
  normalizeLearningTargetLanguages,
} from './languageMatrix/wheelLanguages';
import type { InterfaceLanguage, LearningTargetLanguage } from './languageMatrix/types';
import {
  DEFAULT_PEDAGOGICAL_LEVEL,
  isPedagogicalLevel,
  type PedagogicalLevel,
} from './pedagogicalLevel';

/** 拨轮当前学习目标语言 */
export type LyricsLanguage = LearningTargetLanguage;

/** 排版管线语言编码：由大模型声明或自动检测，决定走哪条排版管线（与波轮解耦） */
export type LangCode = 'jp' | 'ko' | 'en' | 'zh';

/** 界面配色固定为墨色（历史 blue/red 已移除） */
export type ColorTheme = 'mono';

export type { InterfaceLanguage, LearningTargetLanguage, PedagogicalLevel };

export type AppSettings = {
  /** @deprecated 固定为 mono；保留字段以兼容本地存储与海报管线 */
  colorTheme: ColorTheme;
  /** 首页「一键生成指令」默认是否附带词解与语法 */
  defaultIncludeVocabAndGrammar: boolean;
  /** 词解/语法难度：初级 / 中级 / 高级 */
  defaultPedagogicalLevel: PedagogicalLevel;
  /** 使用语言：Prompt 释义/解析输出语言 */
  interfaceLanguage: InterfaceLanguage;
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
    defaultPedagogicalLevel: DEFAULT_PEDAGOGICAL_LEVEL,
    interfaceLanguage: resolveSystemInterfaceLanguage(),
    learningTargetLanguages: ['jp', 'ko', 'en'],
    lyricsLanguage: 'jp',
    interactionSoundsEnabled: true,
  };
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
    /* 历史 blue/red 一律回落墨色 */
    colorTheme: 'mono',
    defaultIncludeVocabAndGrammar: includeVocabAndGrammar,
    defaultPedagogicalLevel: isPedagogicalLevel(stored.defaultPedagogicalLevel)
      ? stored.defaultPedagogicalLevel
      : DEFAULTS.defaultPedagogicalLevel,
    interfaceLanguage: isInterfaceLanguage(stored.interfaceLanguage)
      ? stored.interfaceLanguage
      : DEFAULTS.interfaceLanguage,
    learningTargetLanguages,
    lyricsLanguage: normalizeActiveTarget(rawLyricsLanguage, learningTargetLanguages),
    /* 设置页已移除开关；忽略历史 localStorage 中的 false */
    interactionSoundsEnabled: true,
  };
}

export function saveAppSettings(partial: Partial<AppSettings>): AppSettings {
  const current = getAppSettings();
  const merged = { ...current, ...partial, colorTheme: 'mono' as const };

  if (partial.learningTargetLanguages || partial.lyricsLanguage !== undefined) {
    const targets = partial.learningTargetLanguages ?? merged.learningTargetLanguages;
    merged.lyricsLanguage = normalizeActiveTarget(merged.lyricsLanguage, targets);
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  }
  return merged;
}

/** 交互音效默认开启；设置页已移除开关，始终视为开启 */
export function isInteractionSoundEnabled(): boolean {
  return true;
}

export { resolveSystemInterfaceLanguage };
