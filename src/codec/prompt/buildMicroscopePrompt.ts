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
    - 片假名外来语：除释义外，必须给出源语言、原词拼写与中文译义（见任务「外来语原词」）。
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

/** 「AI讲解」语法拆解：按歌曲语种分轨，禁止串用其它语言的活用体系 */
const AI_EXPLAIN_GRAMMAR_RULES: Record<MicroscopeLanguageName, string> = {
  Japanese: `
【语法拆解 — 仅限日语】
- 若含口语缩略、古风表达、特殊变形（使役/被动/假定、てしまう→ちゃう/ちゃい、〜ておく→とく、〜ている→てる、〜ては→ちゃ 等），必须指出原型并还原语意。
- 活用形（て形/た形/ます形/ない形/ば形/そうだ 等）、助词接续（に/を/は/と）、慣用「〜にする→にして」「〜になる」等，一律视为须拆解的变形，写出「表面形 ← 原型」及作用。
- 若划选是多词短语，按关键成分拆开说明（词干/活用/助词），不要把整段原文当作「词典形」。
- 对比防坑（尽量写一句）：点出 1 个最易混淆的同类/近义语法，说明差异或别用错的场景（如「〜たら」vs「〜ば」；「ちゃう」vs「てしまう」语感）。
- 仅当划选本身已是词典形、且无缩略/活用/接续变形时，才可写「无特殊变形，词典形即「…」」；否则禁止使用该套话。
- 禁止用韩语/英语/中文语法概念或术语解释日语。
`.trim(),

  Korean: `
【语法拆解 — 仅限韩语】
- 只使用韩语形态学：词根/词干、语尾、助词、尊敬阶、时制、被动/使动、补助动词等。
- 常见须还原的变形示例（仅作韩语参考，勿套用日语）：
  · 걱정 마 ← 걱정하다 + 말다（禁止：마）；口语禁止形，不是日语ます否定。
  · 믿어준 ← 믿다 + 어/아 + 주다 + ㄴ（定语）；受益补助。
  · 너였잖아 ← 너 + 이다 + 었 + 잖아（确认语气）。
  · 할거야/줄거야 ← 하다/주다 + ㄹ 것이다（意图/将来口语）。
- 写出「表面形 ← 词典形/构成」及各语素作用；多词短语按成分拆开。
- 对比防坑（尽量写一句）：点出 1 个最易混淆的同类/近义语尾或助词，说明差异（如「-잖아」vs「-지」；「건」vs「것은」正式度）。
- 严禁使用日语术语或变形链（ます形/て形/た形/ない形、助词にをはと、ちゃう/とく 等）解释韩语。
- 严禁把韩语「마／요／죠／네」等语尾附会成日语ます系缩略。
- 仅当划选已是词典形且无语尾/助词变形时，才可写「无特殊变形，词典形即「…」」。
`.trim(),

  English: `
【语法拆解 — 仅限英语】
- 重点：时态/体、情态、短语动词、冠词、俚语缩略（gonna/wanna/'ve 等），写出「表面形 ← 原型」及作用。
- 多词短语按成分拆开。
- 对比防坑（尽量写一句）：点出 1 个最易混淆的近义结构（如「can」vs「could」；「not quite」vs「not really」）。
- 严禁使用日语活用（ます/て/た形、助词にをは）或韩语语尾（요/죠/는/건）解释英语。
- 仅当划选已是词典形且无曲折/缩略时，才可写「无特殊变形」。
`.trim(),

  Chinese: `
【语法拆解 — 仅限中文】
- 重点：词性、搭配、语气助词、叠词/口语缩略，在本句中的作用。
- 对比防坑（尽量写一句）：点出 1 个最易混淆的近义表达或句式（如「把」vs「将」；「了」vs「过」）。
- 严禁使用日语ます/て形或韩语语尾体系解释中文。
- 仅当确无特殊结构时，才可写「无特殊变形」。
`.trim(),
};

/** 歌词黑话提示：仅注入当前语种，避免串台 */
const AI_EXPLAIN_SLANG_HINTS: Record<MicroscopeLanguageName, string> = {
  Japanese: `- 关注：熟语/惯用、Ateji 借字（写「宿命」唱「さだめ」）、汉字与假名非常规搭配、倒装/省略等歌词特权。
- 无此类现象写「—」。`,
  Korean: `- 关注：熟语/惯用（如 눈/마음 相关固定搭配）、为押韵改读（네→니 等）、倒装/省略、歌词专属口语缩写。
- 无此类现象写「—」。`,
  English: `- 关注：idiom/固定搭配、歌词里的非常规省略或倒装、俚语缩略带来的潜台词。
- 无此类现象写「—」。`,
  Chinese: `- 关注：四字熟语/惯用、谐音双关、歌词倒装与省略、文言用词带来的情绪。
- 无此类现象写「—」。`,
};

const AI_EXPLAIN_LANG_LOCK: Record<MicroscopeLanguageName, string> = {
  Japanese:
    '本曲目标语言是【日语 Japanese】。语法拆解 / 分子式 / 语法胶囊只能谈日语与 JLPT；严禁韩语·英语·中文语法，严禁 TOPIK / 英语考试 / HSK 标签。',
  Korean:
    '本曲目标语言是【韩语 Korean】。语法拆解 / 分子式 / 语法胶囊只能谈韩语与 TOPIK；严禁任何日语语法（ます/て形等），严禁 JLPT / 英语考试 / HSK 标签。',
  English:
    '本曲目标语言是【英语 English】。语法拆解 / 分子式 / 语法胶囊只能谈英语与英语考试；严禁日语·韩语语法，严禁 JLPT / TOPIK / HSK 标签。',
  Chinese:
    '本曲目标语言是【中文 Chinese】。语法拆解 / 分子式 / 语法胶囊只能谈中文与 HSK；严禁日语·韩语语法，严禁 JLPT / TOPIK / 英语考试 标签。',
};

/** 分子式示例：只注入当前语种，避免日/韩例句串进英语稿 */
const AI_EXPLAIN_FORMULA_EXAMPLES: Record<MicroscopeLanguageName, string> = {
  Japanese: `- 例：\`[信じ|动词词干] + [て|て形] + [しまう|完了]\`；口语缩略可写 \`[信じちゃう|てしまう缩略]\`
- 标签只用日语语法用语（て形/助词/词干等），勿写韩语语尾名。`,
  Korean: `- 例：\`[나|代词·我] + [바라다|动词·期盼] + [~는|定语词尾] + [건|것은缩略]\`
- 标签只用韩语形态学术语，勿写日语ます/て形。`,
  English: `- 例：\`[can|情态·能] + [reach|动词] + [but|连词] + [not quite|程度] + [hold|动词]\`
- 标签只用英语语法用语（情态/时态/短语动词等），勿写日韩活用名。`,
  Chinese: `- 例：\`[把|介词] + [梦|名词] + [做|动词] + [完|补语]\`
- 标签只用中文语法用语，勿写日韩活用名。`,
};

const AI_EXPLAIN_CAPSULE_EXAMPLES: Record<MicroscopeLanguageName, string> = {
  Japanese: `- 好例（紧扣该词/句型的 JLPT 考点）：\`JLPT|裏腹|N2·{裏腹|うらはら}な／裏腹だ表里不一\`；\`JLPT|〜てしまう|N4·てしまう完了/遗憾\`；\`JLPT|せっかく|N3·せっかく…のに\`
- 坏例（禁止）：\`JLPT|な|な形容词连体形修饰名词\`；\`JLPT|だ|だ的连体形\`；\`JLPT|名词|名词修饰\`——仅讲词类通识、不点名本划选词/句型。
- 若该词/短语本身没有可指认的 JLPT 考点（无常见等级标注、无同词真题句型），只写：\`JLPT|—|本划选无专属JLPT考点\`
- 禁止出现 TOPIK / 英语考试 / HSK，禁止韩语检索键。`,
  Korean: `- 检索键例：「건」「~는 것」「잖아」；标题例：「韩语中常见的 것 口语缩略现象」
- 禁止出现 JLPT / 英语考试 / HSK，禁止日语检索键（ちゃう/て形等）。`,
  English: `- 检索键例：「can」「not quite」「used to」；标题例：「情态动词表能力用法」
- 禁止出现 JLPT / TOPIK / HSK，禁止日韩检索键。`,
  Chinese: `- 检索键例：「把」「了」「着」；标题例：「把字句的基本用法」
- 禁止出现 JLPT / TOPIK / 英语考试，禁止日韩检索键。`,
};

/** 语法胶囊任务说明（按语种）；日语要求考点必须贴合划选本身 */
const AI_EXPLAIN_CAPSULE_TASK: Record<MicroscopeLanguageName, string> = {
  Japanese: `4. 语法胶囊（0～2 条，可空）：只收录与划选「词/短语本身」直接相关的【JLPT】考点，供点击深入。
   - 每行严格：\`JLPT|检索键|中文短标题\`
   - 检索键：必须是本划选中的核心词或固定句型（如「裏腹」「〜てしまう」），禁止只用「な」「だ」「の」等万能语素；检索键不带振假名标记。
   - 短标题：≤22字，须体现该词/句型的 JLPT 身份，优先含等级（N5～N1）或「真题/考点」；例：「N2·{裏腹|うらはら}な表里不一」「N4·{何度|なんど}も屡次、多次」「N3·{繰り返す|くりかえす}重复、反复」。
   - 短标题中的日语词若含汉字，必须按 \`{汉字|平假名读音}\` 标注振假名；无汉字的词无需标注。
   - 【硬性禁止】泛化词类课：な/い形容词连体形、修饰名词、动词活用通识、助词「は/を」百科等——这些已在语法拆解里说清，不得做成胶囊。
   - 判定标准：若离开本划选词换任意同词类词，标题仍完全成立 → 视为泛化，禁止输出。
   - 没有紧紧围绕本划选的 JLPT 考点时：只写一行 \`JLPT|—|本划选无专属JLPT考点\`（界面将不展示「核心语法点」）。`,
  Korean: `4. 语法胶囊（必填 1～2 条）：提炼本划选中与【TOPIK】相关的高频核心语法点，供用户点击查看更多例句。
   - 每行严格：\`TOPIK|检索键|中文短标题\`（第一段必须是「TOPIK」）
   - 检索键：便于在同语种其它歌词/例句中检索的语法形，勿整句。
   - 短标题：≤22字；禁止编造与本划选无关的语法点；无考试级语法时写：\`TOPIK|—|本句无独立高频语法点\``,
  English: `4. 语法胶囊（必填 1～2 条）：提炼本划选中与【英语考试】相关的高频核心语法点，供用户点击查看更多例句。
   - 每行严格：\`英语考试|检索键|中文短标题\`
   - 检索键：便于检索的语法形，勿整句；短标题≤22字；无则写：\`英语考试|—|本句无独立高频语法点\``,
  Chinese: `4. 语法胶囊（必填 1～2 条）：提炼本划选中与【HSK】相关的高频核心语法点，供用户点击查看更多例句。
   - 每行严格：\`HSK|检索键|中文短标题\`
   - 检索键：便于检索的语法形，勿整句；短标题≤22字；无则写：\`HSK|—|本句无独立高频语法点\``,
};

/** 考试体系标签：按语种选其一作为胶囊前缀 */
const EXAM_TAG_BY_LANG: Record<MicroscopeLanguageName, string> = {
  Japanese: 'JLPT',
  Korean: 'TOPIK',
  English: '英语考试',
  Chinese: 'HSK',
};

const FORBIDDEN_EXAM_TAGS: Record<MicroscopeLanguageName, string> = {
  Japanese: 'TOPIK、英语考试、HSK',
  Korean: 'JLPT、英语考试、HSK',
  English: 'JLPT、TOPIK、HSK',
  Chinese: 'JLPT、TOPIK、英语考试',
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

/** 导出：当前语种应对应的考试胶囊前缀（供解析侧校验） */
export function examTagForLanguage(lang: MicroscopeLanguageName): string {
  return EXAM_TAG_BY_LANG[lang] ?? '考试';
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

/** 日语划选是否像片假名外来语（用于 Prompt 硬性提示） */
export function looksLikeJapaneseKatakanaLoan(text: string): boolean {
  const t = text.replace(/\s+/g, '');
  if (t.length < 2) return false;
  const kata = (t.match(/[\u30A0-\u30FFー゛゜]/g) || []).length;
  return kata / t.length >= 0.55;
}

/**
 * 按句末标点（。！？!?）切分歌词选区为句子数组。
 * - 仅按句末标点切，不按换行切（歌词常跨行同句）。
 * - 返回 ≥2 句 → 视为「多句选区」，走逐句解析；否则视为整句，沿用单句解析。
 */
export function splitLyricsSentences(text: string): string[] {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const m = t.match(/[^。！？!?]*[。！？!?]+/g);
  if (m && m.length >= 2) {
    return m.map((s) => s.trim()).filter(Boolean);
  }
  return [t];
}

/**
 * 「AI讲解」：语境释义 + 语法分子式 + 语法拆解 + 考试语法胶囊 + 歌词意境 +（选填）歌词黑话。
 * 语法规则按 songContext.language 分轨，避免日/韩等串台。
 * 日语另含【外来语原词】（片假名外来语溯源）。
 */
export function buildMicroscopeAiExplainPrompt(songContext: MicroscopeSongContext): string {
  const hasLocal = Boolean(songContext.localLemma);
  const lemma = hasLocal ? localLemmaBlock(songContext.localLemma) : '';
  const focus = songContext.targetPhrase;
  const lang = songContext.language;
  const grammarRules =
    AI_EXPLAIN_GRAMMAR_RULES[lang] ?? AI_EXPLAIN_GRAMMAR_RULES.English;
  const langLock = AI_EXPLAIN_LANG_LOCK[lang] ?? AI_EXPLAIN_LANG_LOCK.English;
  const langHint = LANGUAGE_RULES[lang] ?? LANGUAGE_RULES.English;
  const examTag = EXAM_TAG_BY_LANG[lang] ?? '考试';
  const forbiddenExams = FORBIDDEN_EXAM_TAGS[lang] ?? '';
  const formulaExamples =
    AI_EXPLAIN_FORMULA_EXAMPLES[lang] ?? AI_EXPLAIN_FORMULA_EXAMPLES.English;
  const capsuleExamples =
    AI_EXPLAIN_CAPSULE_EXAMPLES[lang] ?? AI_EXPLAIN_CAPSULE_EXAMPLES.English;
  const capsuleTask = AI_EXPLAIN_CAPSULE_TASK[lang] ?? AI_EXPLAIN_CAPSULE_TASK.English;
  const slangHints =
    AI_EXPLAIN_SLANG_HINTS[lang] ?? AI_EXPLAIN_SLANG_HINTS.English;

  // 输出语言跟随界面语言（EN 用户得英文讲解）；段落标签保留中文以兼容解析器
  const ifaceLabel = INTERFACE_LANG_LABEL[songContext.interfaceLanguage ?? 'zh'];

  const isJp = lang === 'Japanese';
  const forceLoan =
    isJp && looksLikeJapaneseKatakanaLoan(focus);
  const loanwordTask = isJp
    ? `
1b. 外来语原词（日语专用，必填块）：
   - 若「${focus}」含片假名外来语（含多个外来语连写），必须逐词写出：源语言、原词拼写、译义。
   - 每行严格格式：\`片假名表面形 ← 源语言 原词拼写 → 中文译义\`
   - 示例：\`カルパッチョ ← 意大利语 Carpaccio → 生牛肉片\`
   - 连写须拆开多行（如 カルパッチョ／パエリア／オードブル 各一行），禁止只写笼统菜名概括而省略原词。
   - 确非外来语（和语/汉语词/固有名词假名写法等）写一行「—」。
${forceLoan ? `   - 【硬性】本划选已判定为片假名外来语倾向，【外来语原词】不得写「—」，必须给出可核验的源语言+原词+译义。` : ''}`
    : '';

  const loanwordOutput = isJp ? '【外来语原词】…\n' : '';

  // 多句选区检测：按句末标点切分；≥2 句 → 逐句解析模式
  const sentences = splitLyricsSentences(focus);
  const isMulti = sentences.length >= 2;

  const multiSentenceTask = isMulti
    ? `1. 逐句解析（必填）：划选含多句，按句拆分逐句给出「原文｜译义｜要点」。
   - 已识别的句子：
${sentences.map((s, i) => `     ${i + 1}) ${s}`).join('\n')}
   - 每行严格：\`<序号>. <原文句>｜<译义>｜<本句语法/活用/口语缩略要点≤30字，无写—>\`
   - 原文句保留原文语种；若划选混入译文行（如原文+中文翻译），译文并入对应译义列，不单独成句。
2. 整体语境（对应【语境释义】）：一句话说明这段在曲中的作用或承接关系。≤60字。`
    : '';

  const task1Label = isMulti
    ? ''
    : isJp
      ? `1. 语境释义：一句话说明「${focus}」在这句歌词里的具体含义，不要生搬硬套词典标准解释。≤50字。外来语溯源不要挤在本段，放到「外来语原词」。`
      : `1. 语境释义：一句话说明「${focus}」在这句歌词里的具体含义，不要生搬硬套词典标准解释。≤50字。`;

  // 多句模式下分子式/拆解改为针对整段、可选；单句模式保持原有强约束
  const formulaTask = isMulti
    ? `3. 语法分子式（选填）：仅针对整段核心语法点拆分子式；无明确可拆写「—」。`
    : `2. 语法分子式（必填）：把「${focus}」拆成可点击的语素/词块，用「分子式」一行写出。
   - 格式必须严格：\`[语素|极短标签] + [语素|极短标签] + …\`
   - 语素用本曲原文语种书写；标签用${ifaceLabel}，≤8字。
${formulaExamples}
   - 若确无成分可拆，写：\`[词典形|无特殊变形]\``;

  const grammarTask = isMulti
    ? `4. 语法拆解（选填）：整段关键语法/活用要点，≤100字；无写「—」。`
    : `3. 语法拆解（必填，须认真还原，禁止敷衍）：
${grammarRules}
   - 本段 ≤100字；须含「还原」+尽量一句「对比防坑」；可与分子式互补，不要重复粘贴分子式原文。`;

  const multiOutput = isMulti ? '【逐句解析】…\n' : '';

  return `
你是歌词划词助教。${ifaceLabel}。${
  isMulti
    ? `划选「${focus}」含多个句子，须逐句翻译与解析，并简要给出整体语境与上下文承接。`
    : `只解释划线片段「${focus}」，禁止整句翻译、串讲前后句、等级考试长文/百科/导语废话。`
}
${langLock}

【曲目语种】${lang}（《${songContext.title}》 / ${songContext.artist}）
【语言规范】
${langHint}
【防串行 — 硬性】
- 本回答的语法体系、分子式语素、胶囊考试标签、歌词黑话必须全部属于【${lang}】。
- 考试标签只能写「${examTag}」，禁止写：${forbiddenExams}。
- 不得混用其它语言的活用名、助词体系或考试标签；不确定就少写，不要借用其它语种知识硬套。

【本句】仅供判断语境（勿复述整句）：
${contextBlock(songContext)}
${lemma ? `【本地词典摘要】（基础义已给出；AI 勿照抄，须落到本句具体含义）\n${lemma}` : ''}

【任务】
${multiSentenceTask ? `${multiSentenceTask}\n` : ''}${task1Label}
${loanwordTask}
${formulaTask}
${grammarTask}
${capsuleTask}
${capsuleExamples}
5. 歌词意境（选填，强调情绪）：聚焦「词尾/用词透出的微妙语气与潜台词」——同一意思换一词会怎样变味；点出本曲语种下细微用词变化传达的情绪。≤50字；确无情绪层次写「—」。
6. 歌词黑话（选填）：仅当划选涉及歌词专属「文学美学与潜规则」时填写，否则写「—」。
   - 覆盖：熟语/成语/惯用型（Idioms）；双关与变音特殊映射（Ateji/借字）；押韵改读、倒装、省略等文学特权。
${slangHints}
   - 本段 ≤50字；只谈与「${focus}」直接相关的黑话，禁止百科展开。

【输出格式】严格按下列标题顺序，不要其它 Markdown/前言后记：
${multiOutput}【语境释义】…
${loanwordOutput}【语法分子式】…
【语法拆解】…
【语法胶囊】
${examTag}|…|…
【歌词意境】…
【歌词黑话】…
`.trim();
}

/** 语法分子式中的一格 */
export type AiGrammarFormulaToken = {
  surface: string;
  label: string;
};

/** 可点击的考试语法胶囊 */
export type AiGrammarCapsule = {
  exam: string;
  /** 检索键（用于本地库 / 下一轮 AI） */
  term: string;
  /** 展示标题（不含「点击查看：」前缀） */
  title: string;
};

/** 日语片假名外来语：源语言 + 原词 + 译义 */
export type AiLoanwordEtymology = {
  surface: string;
  sourceLang: string;
  original: string;
  gloss: string;
  raw: string;
};

/** 多句选区逐句解析项：原文｜译义｜要点 */
export type AiSentenceBreakdownItem = {
  original: string;
  gloss: string;
  note: string;
  raw: string;
};

export type AiExplainParts = {
  /** 逐句解析（仅多句选区；单句为空数组） */
  sentenceBreakdown: AiSentenceBreakdownItem[];
  /** 语境释义（生词卡主义；多句模式下为整体语境一句话） */
  contextSense: string;
  /** 日语外来语溯源（非外来语为空） */
  loanwords: AiLoanwordEtymology[];
  /** 外来语区块原文（解析失败时仍可展示） */
  loanwordsRaw: string;
  /** 语法分子式语素 */
  formula: AiGrammarFormulaToken[];
  /** 分子式原文（解析失败时仍可展示） */
  formulaRaw: string;
  /** 语法/口语还原 */
  grammar: string;
  /** 考试语法胶囊 */
  capsules: AiGrammarCapsule[];
  /** 歌词意境 / 情绪（可空） */
  mood: string;
  /** 歌词黑话：熟语/借字/押韵改读等（可空） */
  slang: string;
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

const SECTION_LABELS = [
  '【逐句解析】',
  '【语境释义】',
  '【外来语原词】',
  '【语法分子式】',
  '【语法拆解】',
  '【语法胶囊】',
  '【歌词意境】',
  '【歌词黑话】',
  '【中文直译】',
  '【语境讲解】',
] as const;

/** 解析【逐句解析】行：`<序号>. <原文句>｜<译义>｜<要点>` */
export function parseSentenceBreakdown(raw: string): AiSentenceBreakdownItem[] {
  const out: AiSentenceBreakdownItem[] = [];
  const cleaned = cleanMood(raw);
  if (!cleaned) return out;
  for (const line of cleaned.split(/\n+/)) {
    const t = line.trim();
    if (!t || t.startsWith('【')) continue;
    const stripped = t.replace(/^\d+[\.\)、]\s*/, '');
    if (!stripped) continue;
    const parts = stripped.split('｜').map((p) => p.trim());
    if (parts.length < 2) continue;
    const original = parts[0] ?? '';
    const gloss = parts[1] ?? '';
    const note = parts.slice(2).join('｜').trim() || '—';
    if (!original) continue;
    out.push({ original, gloss, note, raw: t });
  }
  return out;
}

/** 解析日语【外来语原词】行：`片假名 ← 源语言 原词 → 译义` */
export function parseLoanwordEtymology(raw: string): AiLoanwordEtymology[] {
  const out: AiLoanwordEtymology[] = [];
  const cleaned = cleanMood(raw);
  if (!cleaned) return out;

  for (const line of cleaned.split(/\n+/)) {
    const t = line.trim();
    if (!t || t.startsWith('【')) continue;
    const m = t.match(/^(.+?)\s*←\s*(.+?)\s*→\s*(.+)$/);
    if (!m) continue;
    const surface = m[1].trim();
    const mid = m[2].trim();
    const gloss = m[3].trim();
    if (!surface || !mid || !gloss) continue;

    let sourceLang = '';
    let original = mid;
    const langOrig =
      mid.match(/^(.+?语)\s+(.+)$/) ||
      mid.match(/^(.+?語)\s+(.+)$/) ||
      mid.match(/^(\S+)\s+(.+)$/);
    if (langOrig) {
      sourceLang = langOrig[1].trim();
      original = langOrig[2].trim();
    }
    if (!original) continue;
    out.push({
      surface,
      sourceLang: sourceLang || '外来语',
      original,
      gloss,
      raw: t,
    });
  }
  return out;
}

/** 写入笔记时的外来语摘要一行 */
export function formatLoanwordsForNote(items: AiLoanwordEtymology[]): string {
  if (!items.length) return '';
  return items
    .map((it) => `${it.surface}←${it.sourceLang} ${it.original}→${it.gloss}`)
    .join('；');
}

/** 解析 `[语素|标签] + [语素|标签]` 分子式 */
export function parseGrammarFormula(raw: string): AiGrammarFormulaToken[] {
  const text = raw.trim();
  if (!text) return [];
  const tokens: AiGrammarFormulaToken[] = [];
  const re = /\[([^\]|]+)\|([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const surface = m[1].trim();
    const label = m[2].trim();
    if (surface) tokens.push({ surface, label });
  }
  return tokens;
}

/** 解析语法胶囊行：`TOPIK|건|标题`；可传入 expectedExam 丢弃串行考试标签 */
export function parseGrammarCapsules(
  raw: string,
  expectedExam?: string,
): AiGrammarCapsule[] {
  const out: AiGrammarCapsule[] = [];
  const expect = expectedExam?.trim();
  for (const line of raw.split(/\n+/)) {
    const t = line.trim();
    if (!t || t.startsWith('【')) continue;
    const parts = t.split('|').map((p) => p.trim());
    if (parts.length < 3) continue;
    const [exam, term, ...titleParts] = parts;
    const title = titleParts.join('|').trim();
    if (!exam || !term || !title) continue;
    if (term === '—' || term === '-' || /无独立高频|无专属JLPT|无专属.*考点/.test(title)) {
      continue;
    }
    if (expect && exam !== expect) continue;
    if (expect === 'JLPT' && isGenericJapaneseJlptCapsule(term, title)) continue;
    out.push({ exam, term, title });
    if (out.length >= 3) break;
  }
  return out;
}

/**
 * 日语 JLPT 胶囊兜底：丢掉「词类通识」型标题（な形容词连体形修饰名词 等）。
 * 好的胶囊应点名具体词/句型或给出 N 级考点。
 */
export function isGenericJapaneseJlptCapsule(term: string, title: string): boolean {
  const t = term.trim();
  const titleText = title.trim();
  if (!titleText) return true;

  // 检索键过短且像万能语素
  if (/^(な|だ|の|に|を|は|が|て|た|る|い)$/.test(t)) return true;

  const genericTitle =
    /(な|い)?形容词.*(连体|连用|修饰|词干|语尾)|修饰(后续)?名词|名词修飾|名词修饰|一般动词|动词活用通识|助词用法|词典形即|词类通识/;
  if (genericTitle.test(titleText)) {
    // 若标题已点名具体词或 N 级，可保留（如「N2·裏腹な连体形」）
    const hasLevel = /N[1-5]/.test(titleText);
    const hasConcreteLexeme = /[\u4e00-\u9fff]{2,}|[ぁ-んァ-ンー]{2,}|〜.+/.test(titleText);
    // 纯通识且无等级、标题里也看不出专属词 → 丢弃
    if (!hasLevel && !hasConcreteLexeme) return true;
    // 「な形容词连体形修饰名词」这类即使有汉字「形」也算泛化
    if (
      /^(な|い)?形容词/.test(titleText) ||
      /连体形修饰名词|修饰名词$/.test(titleText)
    ) {
      return true;
    }
  }
  return false;
}

/** 解析 AI讲解结构（兼容旧「中文直译 / 语境讲解」与无分子式/胶囊的旧三行） */
export function parseAiExplainParts(
  raw: string,
  opts?: { language?: MicroscopeLanguageName },
): AiExplainParts {
  const empty: AiExplainParts = {
    sentenceBreakdown: [],
    contextSense: '',
    loanwords: [],
    loanwordsRaw: '',
    formula: [],
    formulaRaw: '',
    grammar: '',
    capsules: [],
    mood: '',
    slang: '',
    zhGloss: '',
    context: '',
    raw: '',
  };
  const text = normalizeAiExplainText(raw);
  if (!text) return empty;

  const nextOf = (label: string) => SECTION_LABELS.filter((l) => l !== label);

  const sentenceRaw = sectionBetween(text, '【逐句解析】', nextOf('【逐句解析】'));
  const sentenceBreakdown = parseSentenceBreakdown(sentenceRaw);
  let contextSense = sectionBetween(text, '【语境释义】', nextOf('【语境释义】'));
  let loanwordsRaw = sectionBetween(text, '【外来语原词】', nextOf('【外来语原词】'));
  let formulaRaw = sectionBetween(text, '【语法分子式】', nextOf('【语法分子式】'));
  let grammar = sectionBetween(text, '【语法拆解】', nextOf('【语法拆解】'));
  const capsulesRaw = sectionBetween(text, '【语法胶囊】', nextOf('【语法胶囊】'));
  let mood = cleanMood(sectionBetween(text, '【歌词意境】', nextOf('【歌词意境】')));
  let slang = cleanMood(sectionBetween(text, '【歌词黑话】', nextOf('【歌词黑话】')));

  // 兼容旧两段：【中文直译】+【语境讲解】
  if (!contextSense && !grammar && !formulaRaw) {
    const oldGloss = sectionBetween(text, '【中文直译】', ['【语境讲解】', '【语境释义】']);
    const oldCtx = sectionBetween(text, '【语境讲解】', ['【中文直译】', '【语法拆解】']);
    if (oldGloss || oldCtx) {
      contextSense = oldCtx || oldGloss;
      grammar = '';
    }
  }

  // 行内标签兜底
  if (!contextSense) {
    contextSense =
      text.match(/(?:【语境释义】|语境释义)[:：]\s*([^\n【]+)/)?.[1]?.trim() || '';
  }
  if (!loanwordsRaw) {
    loanwordsRaw =
      text.match(/(?:【外来语原词】|外来语原词)[:：]\s*([^\n【]+)/)?.[1]?.trim() || '';
  }
  if (!formulaRaw) {
    formulaRaw =
      text.match(/(?:【语法分子式】|语法分子式)[:：]\s*([^\n【]+)/)?.[1]?.trim() || '';
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
  if (!slang) {
    slang = cleanMood(
      text.match(/(?:【歌词黑话】|歌词黑话)[:：]\s*([^\n【]+)/)?.[1]?.trim() || '',
    );
  }

  const expectedExam = opts?.language ? examTagForLanguage(opts.language) : undefined;
  const formula = parseGrammarFormula(formulaRaw);
  const capsules = parseGrammarCapsules(capsulesRaw, expectedExam);
  const loanwords = parseLoanwordEtymology(loanwordsRaw);

  if (
    !contextSense &&
    !grammar &&
    !mood &&
    !slang &&
    !formula.length &&
    !capsules.length &&
    !loanwords.length
  ) {
    return { ...empty, contextSense: text, zhGloss: text, context: '', raw: text };
  }

  return {
    sentenceBreakdown,
    contextSense,
    loanwords,
    loanwordsRaw: cleanMood(loanwordsRaw) ? loanwordsRaw.trim() : '',
    formula,
    formulaRaw: formulaRaw.trim(),
    grammar,
    capsules,
    mood,
    slang,
    zhGloss: contextSense,
    context: grammar,
    raw: text,
  };
}

/**
 * 胶囊点击后：交互式微型语法讲义（含义 / 用法 / 情感）+ 恰好 1 条例句。
 * 例句可为著名歌词或流行音乐语境造句；不强求多条。
 */
export function buildGrammarPointLessonPrompt(opts: {
  language: MicroscopeLanguageName;
  exam: string;
  term: string;
  title: string;
  songTitle?: string;
  artist?: string;
  /** 本地学习卡命中的可选例句，供模型优先采用 */
  seedExample?: { source: string; text: string; zh: string } | null;
}): string {
  const lang = opts.language;
  const langLock = AI_EXPLAIN_LANG_LOCK[lang] ?? AI_EXPLAIN_LANG_LOCK.English;
  const keyword = opts.term.trim();
  const surface = keyword.replace(/^[~～〜]+/, '').trim() || keyword;
  const examTag = opts.exam?.trim() || examTagForLanguage(lang);
  const seed = opts.seedExample;
  const seedLyric = seed
    ? `《${seed.source}》｜${seed.text}｜${seed.zh}`
    : '（无）';
  const avoidLine = opts.songTitle
    ? `- 尽量不要重复当前曲同一句：《${opts.songTitle}》/${opts.artist ?? ''}`
    : '';

  return `
【系统角色】
你是一个精通流行歌词语境的微型讲义生成器。简体中文。
${langLock}

【当前请求核心参数】
- 目标语种 (langLock): ${lang}
- 触发检索键: ${keyword}
- 关联考试标签: ${examTag}
- 胶囊标题（供理解，勿复述）: ${opts.title}
- 可选现成种子例句(优先参考): ${seedLyric}

【任务指令】
请针对检索键「${keyword}」生成一份极致精简的交互式微型语法讲义，并附带 1 条含有该检索键的著名歌词或高质量造句。
说明语言统一使用简体中文。每段内容（含例句）严格控制在 40 字以内，禁止任何废话和 Markdown/代码块。
语法体系与例句原文必须属于【${lang}】；禁止其它语种句子；例句原文必须原样包含「${surface}」。
${
  lang === 'Japanese'
    ? `- 紧紧围绕「${keyword}」本身的 JLPT 用法/等级/近义辨析；禁止改讲泛化的「な形容词修饰名词」等词类课。
- 【通常含义】优先点明该词/句型在 JLPT 中的考法（若可知等级可写 N2/N3 等）。
- 含汉字的日语词在正文与例句中必须使用 \`{汉字|平假名读音}\` 标注振假名，如 {繰り返す|くりかえす}、{何度|なんど}も。
- 【严禁】把假名直接写在汉字后，如「港みなと」「汽笛きてき」「響ひびく」等写法一律禁止；必须写成 {港|みなと}、{汽笛|きてき}、{響|ひび}く。
- 输出前自检：例句原文中，任何「汉字右侧紧挨假名」的形式均视为错误，必须修正为 {汉字|假名}。
- 例句必须使用「${surface}」原词或原句型，不要换成任意同词类词。`
    : ''
}
${avoidLine}

【严格输出格式（必须完全一致）】
【通常含义】用最通俗的语言说明该语法/词的核心字面意思。
【如何使用】说明接续规则或位置；日语须结合本检索键，勿只写词类通识。
【情感语气】用拟人化或情绪词描述其传达的隐性语感（如：表示傲娇反问、无可奈何、或中性稳定）。
【例句】严格格式：《歌名》｜原文（必须包含${keyword}，含汉字词请用{汉字|平假名}标注振假名）｜中文翻译。如果没有合适的著名歌名，请用《造句》作为书名号内容，并确保原文极其适合流行音乐语境。
`.trim();
}

/** @deprecated 使用 buildGrammarPointLessonPrompt */
export function buildGrammarExamplesPrompt(opts: {
  language: MicroscopeLanguageName;
  exam: string;
  term: string;
  title: string;
  songTitle?: string;
  artist?: string;
}): string {
  return buildGrammarPointLessonPrompt(opts);
}

export type GrammarExampleItem = {
  source: string;
  text: string;
  zh: string;
  /** local = 学习卡库；ai = 模型；crafted = 模型造句 */
  via: 'local' | 'ai' | 'crafted';
};

/** 核心语法点短讲义：含义 + 用法 + 情感 + 一条例句 */
export type GrammarPointLesson = {
  meaning: string;
  usage: string;
  emotion: string;
  example: GrammarExampleItem | null;
  raw: string;
};

/** 去掉检索键上的 ~／空白，得到须在例句中出现的表面形 */
export function normalizeGrammarSearchTerm(term: string): string {
  return term
    .replace(/^[~～〜]+/, '')
    .replace(/[~～〜]+$/g, '')
    .replace(/\s+/g, '')
    .trim();
}

/** 例句正文是否真正含该语法形（防学习卡/模型幻觉凑数） */
export function textContainsGrammarTerm(text: string, term: string): boolean {
  const surface = text
    .replace(/\{([^|}\n]+)\|[^}\n]+\}/g, '$1')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/\s+/g, '');
  if (!surface) return false;
  const needle = normalizeGrammarSearchTerm(term);
  if (!needle || needle === '—' || needle === '-') return false;
  if (surface.includes(needle)) return true;
  const raw = term.replace(/\s+/g, '');
  return Boolean(raw) && surface.includes(raw);
}

function parseExamplePipeLine(
  line: string,
  term?: string,
): GrammarExampleItem | null {
  const t = line.trim().replace(/^\d+[\.\)、]\s*/, '');
  if (!t) return null;
  let source = '';
  let example = '';
  let zh = '';
  const parts = t.split('｜').map((p) => p.trim());
  if (parts.length >= 3) {
    source = parts[0];
    example = parts[1];
    zh = parts.slice(2).join('｜');
  } else {
    const m = t.match(/^(.+?)[：:]\s*(.+?)(?:[—–\-]\s*|／|\/)\s*(.+)$/);
    if (!m) return null;
    source = m[1].trim();
    example = m[2].trim();
    zh = m[3].trim();
  }
  if (!example) return null;
  if (term && !textContainsGrammarTerm(example, term)) return null;
  const via: GrammarExampleItem['via'] = /造句/.test(source) ? 'crafted' : 'ai';
  return { source, text: example, zh, via };
}

/** 解析语法点短讲义 */
export function parseGrammarPointLesson(
  raw: string,
  term?: string,
): GrammarPointLesson {
  const text = normalizeAiExplainText(raw);
  const empty: GrammarPointLesson = {
    meaning: '',
    usage: '',
    emotion: '',
    example: null,
    raw: text,
  };
  if (!text) return empty;

  const labels = ['【通常含义】', '【如何使用】', '【情感语气】', '【例句】'] as const;
  const between = (start: (typeof labels)[number]) => {
    const i = text.indexOf(start);
    if (i < 0) return '';
    const bodyStart = i + start.length;
    let end = text.length;
    for (const next of labels) {
      if (next === start) continue;
      const j = text.indexOf(next, bodyStart);
      if (j >= 0 && j < end) end = j;
    }
    return text.slice(bodyStart, end).trim();
  };

  let meaning = between('【通常含义】');
  let usage = between('【如何使用】');
  let emotion = between('【情感语气】');
  const exampleRaw = between('【例句】');

  if (!meaning) {
    meaning = text.match(/(?:【通常含义】|通常含义)[:：]\s*([^\n【]+)/)?.[1]?.trim() || '';
  }
  if (!usage) {
    usage = text.match(/(?:【如何使用】|如何使用)[:：]\s*([^\n【]+)/)?.[1]?.trim() || '';
  }
  if (!emotion) {
    emotion = text.match(/(?:【情感语气】|情感语气)[:：]\s*([^\n【]+)/)?.[1]?.trim() || '';
  }

  let example = exampleRaw ? parseExamplePipeLine(exampleRaw, term) : null;
  if (!example) {
    const legacy = parseGrammarExamples(text, term);
    example = legacy[0] ?? null;
  }

  return { meaning, usage, emotion, example, raw: text };
}

/** 解析旧版多条例句回复；若传入 term 则丢弃正文不含该语法形的行 */
export function parseGrammarExamples(
  raw: string,
  term?: string,
): GrammarExampleItem[] {
  const text = normalizeAiExplainText(raw);
  if (!text) return [];
  const items: GrammarExampleItem[] = [];
  for (const line of text.split(/\n+/)) {
    const item = parseExamplePipeLine(line, term);
    if (!item) continue;
    items.push(item);
    if (items.length >= 3) break;
  }
  return items;
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
