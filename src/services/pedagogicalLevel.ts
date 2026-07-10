import type { InterfaceLanguage, LangCode } from './appSettings';

export type PedagogicalLevel = 'elementary' | 'intermediate' | 'advanced';

export const DEFAULT_PEDAGOGICAL_LEVEL: PedagogicalLevel = 'intermediate';

export const PEDAGOGICAL_LEVEL_ORDER: PedagogicalLevel[] = [
  'elementary',
  'intermediate',
  'advanced',
];

export function isPedagogicalLevel(v: unknown): v is PedagogicalLevel {
  return v === 'elementary' || v === 'intermediate' || v === 'advanced';
}

export function resolvePedagogicalLevel(level?: PedagogicalLevel): PedagogicalLevel {
  return level ?? DEFAULT_PEDAGOGICAL_LEVEL;
}

export function pedagogicalLevelLabel(
  level: PedagogicalLevel,
  interfaceLanguage: InterfaceLanguage,
): string {
  if (interfaceLanguage === 'en') {
    if (level === 'elementary') return 'Elementary';
    if (level === 'intermediate') return 'Intermediate';
    return 'Advanced';
  }
  if (level === 'elementary') return '初级';
  if (level === 'intermediate') return '中级';
  return '高级';
}

/** 设置页：三档各语言框架对照（紧凑一行） */
export const PEDAGOGICAL_LEVEL_FRAMEWORK_SUMMARY: Record<
  PedagogicalLevel,
  { zh: string; en: string }
> = {
  elementary: {
    zh: 'JLPT N5–N4 · TOPIK I 1–2 级 · CEFR A1–A2 · HSK 1–3',
    en: 'JLPT N5–N4 · TOPIK I levels 1–2 · CEFR A1–A2 · HSK 1–3',
  },
  intermediate: {
    zh: 'JLPT N3–N2 · TOPIK II 3–4 级 · CEFR B1–B2 · HSK 4–5',
    en: 'JLPT N3–N2 · TOPIK II levels 3–4 · CEFR B1–B2 · HSK 4–5',
  },
  advanced: {
    zh: 'JLPT N1+ · TOPIK II 5–6 级 · CEFR C1–C2 · HSK 6+',
    en: 'JLPT N1+ · TOPIK II levels 5–6 · CEFR C1–C2 · HSK 6+',
  },
};

export function pedagogicalLevelSettingsIntro(interfaceLanguage: InterfaceLanguage): string {
  if (interfaceLanguage === 'en') {
    return 'Constrains AI vocabulary and grammar depth using JLPT / TOPIK / CEFR / HSK benchmarks (framework follows the home language wheel target).';
  }
  return '按 JLPT / TOPIK / CEFR / HSK 等等级约束 AI 选词与语法深度（随首页拨轮目标语言切换框架）。';
}

export function pedagogicalLevelFrameworkDetail(
  level: PedagogicalLevel,
  interfaceLanguage: InterfaceLanguage,
): string {
  const label = pedagogicalLevelLabel(level, interfaceLanguage);
  const frameworks =
    interfaceLanguage === 'en'
      ? PEDAGOGICAL_LEVEL_FRAMEWORK_SUMMARY[level].en
      : PEDAGOGICAL_LEVEL_FRAMEWORK_SUMMARY[level].zh;
  return interfaceLanguage === 'en' ? `${label}: ${frameworks}` : `${label}：${frameworks}`;
}

export type PedagogicalLevelSpec = {
  framework: string;
  vocab: string;
  grammar: string;
  counts: string;
  exampleStyle: string;
  avoid: string;
};

/** 各目标语言 × 三档 — 供 Prompt [Pedagogical_Level] 注入 */
export const PEDAGOGICAL_LEVEL_MATRIX: Record<
  LangCode,
  Record<PedagogicalLevel, PedagogicalLevelSpec>
> = {
  jp: {
    elementary: {
      framework: 'JLPT N5–N4',
      vocab: 'high-frequency core words; basic nouns/verbs; common kana; limit rare kanji; ruby required on taught kanji',
      grammar: '～て / ～ます / ～たい / ～ない; basic particles (は・が・を・に); simple predicates only',
      counts: 'V 3–5, G 1–2',
      exampleStyle: 'col6 ≤15 morae; daily-life; single short clause',
      avoid: 'literary/classical grammar labels; deep 四字熟語; N1-only kanji without ruby',
    },
    intermediate: {
      framework: 'JLPT N3–N2',
      vocab: 'compound words, adverbs, set phrases from lyrics; proper nouns when sung',
      grammar: '～わけではない / ～に違いない / ～かもしれない / ～ように; condition and concession',
      counts: 'V 5–8, G 2–4',
      exampleStyle: 'col6 ≤25 morae; emotional or social context; one subordinate clause OK',
      avoid: 'stacking N1 jargon; rare kanji without ruby',
    },
    advanced: {
      framework: 'JLPT N1+ (lyric literary register)',
      vocab: 'rhetoric, archaisms, 熟字训, rare kanji; precise ruby for special readings',
      grammar: 'inversion, ellipsis, 书面体 / 古语残留 (～ず / ～なり); emphasis and nuance',
      counts: 'V 6–10, G 3–5 (include ≥1 rhetoric/archaism G when present in lyrics)',
      exampleStyle: 'col6 ≤35 morae; may be poetic; explain nuance not just gloss',
      avoid: 'unreadable kanji without ruby; copying any L line into col6',
    },
  },
  ko: {
    elementary: {
      framework: 'TOPIK I (levels 1–2)',
      vocab: 'high-frequency verbs/adjectives; basic Sino-Korean; no obscure hanja',
      grammar: '-아/어요, -고, -서, -는/은/을; basic tense/aspect',
      counts: 'V 3–5, G 1–2',
      exampleStyle: 'short col6; everyday spoken Korean',
      avoid: 'rare hanja compounds without gloss; North-Korean spellings',
    },
    intermediate: {
      framework: 'TOPIK II (levels 3–4)',
      vocab: 'idioms, adverbs, emotional lexicon; common lyric collocations',
      grammar: '-는데, -다가, -아/어 보다; indirect speech; basic honorific (-세요 / -시-)',
      counts: 'V 5–8, G 2–4',
      exampleStyle: 'col6 with one compound sentence; note speech level when relevant',
      avoid: 'unexplained slang',
    },
    advanced: {
      framework: 'TOPIK II (levels 5–6)',
      vocab: 'slang, dialect color, layered hanja/loanword nuance in lyrics',
      grammar: '-더라, -나 보다, written -음/ㅁ; inversion and lyric ellipsis',
      counts: 'V 6–10, G 3–5',
      exampleStyle: 'col6 may mix literary and spoken registers; explain rhetoric',
      avoid: 'opaque internet memes without gloss',
    },
  },
  en: {
    elementary: {
      framework: 'CEFR A1–A2',
      vocab: 'top high-frequency words; basic phrasal verbs (get up, look at)',
      grammar: 'present/past simple, progressive, basic negation/questions',
      counts: 'V 3–5, G 1–2',
      exampleStyle: 'col6 8–12 words; conversational',
      avoid: 'rare Latinate words without gloss',
    },
    intermediate: {
      framework: 'CEFR B1–B2',
      vocab: 'common idioms, collocations, light metaphor in pop lyrics',
      grammar: 'perfect tenses, passive, relative clauses, intro subjunctive',
      counts: 'V 5–8, G 2–4',
      exampleStyle: 'col6 12–20 words; one subordinate clause',
      avoid: 'over-linguistic jargon',
    },
    advanced: {
      framework: 'CEFR C1–C2',
      vocab: 'archaisms, allusion, wordplay, register shifts (mark informal forms)',
      grammar: 'inversion, ellipsis, participial stacks, poetic line breaks vs syntax',
      counts: 'V 6–10, G 3–5',
      exampleStyle: 'col6 may be longer; explain rhetoric or double meaning',
      avoid: 'using a full lyric line as col6',
    },
  },
  zh: {
    elementary: {
      framework: 'HSK 1–3',
      vocab: 'high-frequency characters/words; basic measure words; avoid rare characters',
      grammar: '了/的/吗/呢; basic 把字句; simple complements',
      counts: 'V 3–5, G 1–2',
      exampleStyle: 'col6 ≤20 Hanzi; colloquial Mandarin',
      avoid: 'classical words without vernacular gloss; {汉字:拼音} ruby in col6',
    },
    intermediate: {
      framework: 'HSK 4–5',
      vocab: 'common 成语 (literal sense), polysemy, lyric imagery words',
      grammar: '被字句, correlative pairs (虽然…但是); moderately complex sentences',
      counts: 'V 5–8, G 2–4',
      exampleStyle: 'col6 ≤35 Hanzi; one layer of abstraction OK',
      avoid: 'ruby in grammar_label or col6',
    },
    advanced: {
      framework: 'HSK 6+ / literary lyric register',
      vocab: 'rare characters, 典故, special readings — gloss in parentheses, no ruby in G col3',
      grammar: 'inversion, ellipsis, 文言残留; lyric line break vs grammar',
      counts: 'V 6–10, G 3–5',
      exampleStyle: 'col6 may be poetic; trace imagery source briefly',
      avoid: '{汉字:拼音} in col6; copying L lines into col6',
    },
  },
};
