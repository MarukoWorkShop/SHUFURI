/**
 * 显微镜划词 Prompt（Phase A / MOJi 式）：
 * - 本地词典先出基础义
 * - 「AI讲解」带前后句 + 本地摘要预拼接，只补语境/活用
 */

import type { InterfaceLanguage, LangCode } from '../../services/appSettings';

export type MicroscopeLanguageName = 'Japanese' | 'Korean' | 'English' | 'Chinese';

/** 本地词典摘要，塞进 AI Prompt，避免模型重查词义 */
export type MicroscopeLocalLemma = {
  dictionary_form: string;
  pronunciation: string;
  part_of_speech: string;
  direct_meaning: string;
};

export type MicroscopeSongContext = {
  language: MicroscopeLanguageName;
  title: string;
  artist: string;
  /** 精简版不再使用整首歌词；保留字段仅为兼容旧调用 */
  fullLyrics?: string;
  targetPhrase: string;
  /** 所在句（去 ruby） */
  surroundingLine: string;
  /** 上一句（可选） */
  prevLine?: string;
  /** 下一句（可选） */
  nextLine?: string;
  /** 本地 JMdict 命中摘要（可选） */
  localLemma?: MicroscopeLocalLemma | null;
  interfaceLanguage?: InterfaceLanguage;
};

export type MicroscopeMicroAnalysis = {
  dictionary_form: string;
  pronunciation: string;
  part_of_speech: string;
  grammar_breakdown: string;
  direct_meaning: string;
};

/** 精简版不再生成；保留类型以免调用方断裂 */
export type MicroscopeMacroAnalysis = {
  contextual_meaning: string;
  emotional_impact: string;
};

export type MicroscopeExplainResult = {
  micro_analysis: MicroscopeMicroAnalysis;
  macro_analysis?: MicroscopeMacroAnalysis;
};

export const LANGUAGE_RULES: Record<MicroscopeLanguageName, string> = {
  Japanese: `
    - 重点：动词/形容词活用、助词接续、在本句中的具体含义。
    - 不要写 JLPT 长文，不要歌手/曲风赏析。
  `,
  Korean: `
    - 重点：词根与助词/词尾拆分、在本句中的含义。
    - 不要写 TOPIK 长文。
  `,
  English: `
    - 重点：短语动词/时态/俚语在本句中的用法。
    - 不要写 CEFR 长文。
  `,
  Chinese: `
    - 重点：词性、搭配、语气在本句中的作用。
    - 不要写 HSK 长文。
  `,
};

export function langCodeToMicroscopeLanguage(lang: LangCode | undefined): MicroscopeLanguageName {
  switch (lang) {
    case 'jp':
      return 'Japanese';
    case 'ko':
      return 'Korean';
    case 'zh':
      return 'Chinese';
    case 'en':
    default:
      return 'English';
  }
}

const INTERFACE_LANG_LABEL: Record<InterfaceLanguage, string> = {
  zh: '简体中文',
  en: 'English',
};

function contextBlock(ctx: MicroscopeSongContext): string {
  const prev = ctx.prevLine?.trim();
  const cur = ctx.surroundingLine?.trim() || ctx.targetPhrase;
  const next = ctx.nextLine?.trim();
  const lines = [
    prev ? `上一句：${prev}` : null,
    `本句：${cur}`,
    next ? `下一句：${next}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

function localLemmaBlock(lemma: MicroscopeLocalLemma | null | undefined): string {
  if (!lemma) return '（无本地词典摘要；请自行给出简短释义）';
  return [
    `词典形：${lemma.dictionary_form}`,
    `读音：${lemma.pronunciation}`,
    `词性：${lemma.part_of_speech}`,
    `基础义：${lemma.direct_meaning}`,
  ].join('\n');
}

/**
 * @deprecated Phase A 起「AI讲解」请用 buildMicroscopeAiExplainPrompt。
 * 保留供无本地词典语言的整段 JSON 回落。
 */
export function buildMicroscopePrompt(songContext: MicroscopeSongContext): string {
  const specificRule =
    LANGUAGE_RULES[songContext.language] ?? LANGUAGE_RULES.English;
  const outputLang =
    INTERFACE_LANG_LABEL[songContext.interfaceLanguage ?? 'zh'] ?? '简体中文';

  return `
你是一位多语言歌词语法助教。请对用户划选的词/短句做快速、准确的词典式解析。

【曲目（仅供指称，勿展开歌手生平或全曲赏析）】
- 《${songContext.title}》 / ${songContext.artist}（${songContext.language}）

【上下文】
${contextBlock(songContext)}

【划选】
【 ${songContext.targetPhrase} 】

【语言规范】
${specificRule}

【要求】
- 只根据划选与上下文作答；不要编造剧情，不要文学赏析。
- 说明文字使用【${outputLang}】。
- 极简：direct_meaning ≤ 40 字；grammar_breakdown ≤ 40 字。
- 必须且只能输出如下 JSON，不要 Markdown，不要前言后记：

{
  "micro_analysis": {
    "dictionary_form": "...",
    "pronunciation": "...",
    "part_of_speech": "...",
    "grammar_breakdown": "...",
    "direct_meaning": "..."
  }
}
`.trim();
}

/**
 * 「AI讲解」：语境释义 + 语法拆解 + 歌词意境（本地词典已出基础义，AI 不重复词典直译）。
 */
export function buildMicroscopeAiExplainPrompt(songContext: MicroscopeSongContext): string {
  const hasLocal = Boolean(songContext.localLemma);
  const lemma = hasLocal ? localLemmaBlock(songContext.localLemma) : '';
  const focus = songContext.targetPhrase;

  return `
你是歌词划词助教。简体中文。只解释划线片段「${focus}」，禁止整句翻译、串讲前后句、JLPT/百科/导语废话。

【本句】仅供判断语境（勿复述整句）：
${contextBlock(songContext)}
${lemma ? `【本地词典摘要】（基础义已给出；AI 勿照抄，须落到本句具体含义）\n${lemma}` : ''}

【任务】
1. 语境释义：一句话说明「${focus}」在这句歌词里的具体含义，不要生搬硬套词典标准解释。≤50字。
2. 语法拆解（必填，须认真还原，禁止敷衍）：
   - 若含口语缩略、古风表达、特殊变形（使役/被动/假定、てしまう→ちゃう/ちゃい、〜ておく→とく、〜ている→てる、〜ては→ちゃ 等），必须指出原型并还原语意。
   - 活用形（て形/た形/ます形/ない形/ば形/そうだ 等）、助词接续（に/を/は/と）、慣用「〜にする→にして」「〜になる」等，一律视为须拆解的变形，写出「表面形 ← 原型」及作用。
   - 若划选是多词短语，按关键成分拆开说明（词干/活用/助词），不要把整段原文当作「词典形」。
   - 仅当划选本身已是词典形、且无缩略/活用/接续变形时，才可写「无特殊变形，词典形即「…」」；否则禁止使用该套话。
   - 本段 ≤80字。
3. 歌词意境（选填）：有双关或情绪暗示时用≤50字点拨；否则写「—」。

【输出格式】严格三行标题，不要其它 Markdown/前言后记：
【语境释义】…
【语法拆解】…
【歌词意境】…
`.trim();
}

export type AiExplainParts = {
  /** 语境释义（生词卡主义） */
  contextSense: string;
  /** 语法/口语还原 */
  grammar: string;
  /** 歌词意境（可空） */
  mood: string;
  /**
   * @deprecated 兼容旧字段名：等同 contextSense
   */
  zhGloss: string;
  /**
   * @deprecated 兼容旧字段名：等同 grammar
   */
  context: string;
  raw: string;
};

function sectionBetween(
  text: string,
  startLabel: string,
  nextLabels: string[],
): string {
  const start = text.indexOf(startLabel);
  if (start < 0) return '';
  const bodyStart = start + startLabel.length;
  let end = text.length;
  for (const next of nextLabels) {
    const i = text.indexOf(next, bodyStart);
    if (i >= 0 && i < end) end = i;
  }
  return text.slice(bodyStart, end).trim();
}

function cleanMood(s: string): string {
  const t = s.trim();
  if (!t || t === '—' || t === '-' || t === '无' || t === '无。') return '';
  return t;
}

/** 解析 AI讲解三段结构（兼容旧「中文直译 / 语境讲解」） */
export function parseAiExplainParts(raw: string): AiExplainParts {
  const empty: AiExplainParts = {
    contextSense: '',
    grammar: '',
    mood: '',
    zhGloss: '',
    context: '',
    raw: '',
  };
  const text = normalizeAiExplainText(raw);
  if (!text) return empty;

  let contextSense = sectionBetween(text, '【语境释义】', ['【语法拆解】', '【歌词意境】']);
  let grammar = sectionBetween(text, '【语法拆解】', ['【歌词意境】', '【语境释义】']);
  let mood = cleanMood(sectionBetween(text, '【歌词意境】', ['【语境释义】', '【语法拆解】']));

  // 兼容旧两段：【中文直译】+【语境讲解】
  if (!contextSense && !grammar) {
    const oldGloss = sectionBetween(text, '【中文直译】', ['【语境讲解】', '【语境释义】']);
    const oldCtx = sectionBetween(text, '【语境讲解】', ['【中文直译】', '【语法拆解】']);
    if (oldGloss || oldCtx) {
      // 旧「语境讲解」≈本句含义；「中文直译」作后备
      contextSense = oldCtx || oldGloss;
      grammar = '';
    }
  }

  // 行内标签兜底
  if (!contextSense) {
    contextSense =
      text.match(/(?:【语境释义】|语境释义)[:：]\s*([^\n【]+)/)?.[1]?.trim() || '';
  }
  if (!grammar) {
    grammar =
      text.match(/(?:【语法拆解】|语法拆解)[:：]\s*([^\n【]+)/)?.[1]?.trim() || '';
  }
  if (!mood) {
    mood = cleanMood(
      text.match(/(?:【歌词意境】|歌词意境)[:：]\s*([^\n【]+)/)?.[1]?.trim() || '',
    );
  }

  if (!contextSense && !grammar && !mood) {
    return { ...empty, contextSense: text, zhGloss: text, context: '', raw: text };
  }

  return {
    contextSense,
    grammar,
    mood,
    zhGloss: contextSense,
    context: grammar,
    raw: text,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** 解析精简版显微镜 JSON（仅要求 micro_analysis） */
export function parseMicroscopeExplainResult(raw: string): MicroscopeExplainResult | null {
  let text = raw.trim();
  if (!text) return null;

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) text = fence[1].trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    if (!isRecord(parsed)) return null;
    const micro = parsed.micro_analysis;
    if (!isRecord(micro)) return null;

    const dictionary_form = asNonEmptyString(micro.dictionary_form);
    const pronunciation = asNonEmptyString(micro.pronunciation);
    const part_of_speech = asNonEmptyString(micro.part_of_speech);
    const grammar_breakdown = asNonEmptyString(micro.grammar_breakdown);
    const direct_meaning = asNonEmptyString(micro.direct_meaning);

    if (
      !dictionary_form ||
      !pronunciation ||
      !part_of_speech ||
      !grammar_breakdown ||
      !direct_meaning
    ) {
      return null;
    }

    const result: MicroscopeExplainResult = {
      micro_analysis: {
        dictionary_form,
        pronunciation,
        part_of_speech,
        grammar_breakdown,
        direct_meaning,
      },
    };

    const macro = parsed.macro_analysis;
    if (isRecord(macro)) {
      const contextual_meaning = asNonEmptyString(macro.contextual_meaning);
      const emotional_impact = asNonEmptyString(macro.emotional_impact);
      if (contextual_meaning && emotional_impact) {
        result.macro_analysis = { contextual_meaning, emotional_impact };
      }
    }

    return result;
  } catch {
    return null;
  }
}

/** AI讲解纯文本清洗 */
export function normalizeAiExplainText(raw: string): string {
  let t = raw.trim();
  if (!t) return '';
  const fence = t.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  if (fence?.[1]) t = fence[1].trim();
  return t.replace(/\n{3,}/g, '\n\n').trim();
}
