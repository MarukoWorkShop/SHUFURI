/**
 * 「日语歌词」→ 歌词笔记：火山引擎（ARK Chat）生成 HTML。
 */
import { escapeHtml } from '../utils/escapeHtml';
import { sendChatMessageStream } from './volcanoChat';
import type { ChatMessage } from './volcanoChat';

export type LyricsNotesClipResult = {
  title: string;
  summary: string;
  bodyHtml: string;
};

export type LyricsNotesGenerateOptions = {
  /** 是否生成词汇与语法点板块，默认 true */
  includeVocabAndGrammar?: boolean;
  /** 用于中断流式请求 */
  signal?: AbortSignal;
};

/** 从用户粘贴的歌词中识别《》书名号或 # 标题行内的歌曲标题 */
export function extractSongTitleFromLyricsRaw(raw: string): string | null {
  const m = raw.match(/《([^》\n]+)》/);
  const t1 = m?.[1]?.trim();
  if (t1 && t1.length > 0) return t1;
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;
    const hash = s.replace(/^#+\s*/, '').trim();
    if (!hash) continue;
    const beforeParen = hash.split(/[（(]/)[0]?.trim();
    if (beforeParen && beforeParen.length > 0 && beforeParen.length <= 80) return beforeParen;
  }
  return null;
}

/** 用粘贴原文生成无 ruby 的占位 HTML */
export function buildLyricsPlainPlaceholderHtml(raw: string): string {
  const lines = raw
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const inner = lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('');
  return `<div class="clip-body lyrics-notes-body">${inner}</div>`;
}

const LYRICS_CORE_PROMPT = `你是一个日语教学排版专家。我会给你一段歌词，格式是一句日语一句中文。请执行以下操作：

识别与校验：识别日语中的汉字，并为其添加振假名（使用标准 HTML <ruby>基字<rt>注音</rt></ruby>，可带可选 <rp>(</rp><rp>)</rp>）。禁止把汉字与假名直接并排连写在同一基字旁（错误示例：「銀ぎん」「龍りゅう」）。若原文为连续段落、同一行内日中混排，或带「# / 《》/ 括号内中文曲名」等标记，仍须先整理语义，将内容拆成合理的日语行（jp-line）与中文行（zh-line）对译组合；日语行内每个需注音的汉字词均须用 <ruby> 包裹。

结构化输出：将每一组对译包装在 <div class="lyrics-group"> 中，包含 <p class="jp-line"> 和 <p class="zh-line">。`;

const VOCAB_GRAMMAR_PROMPT = `
词汇板块（须严格按下面结构与 class，全部使用 div，勿用 section；禁止使用 table）：
1. 在歌词正文全部输出完毕后，输出一个包裹层：<div class="lyrics-vocabulary" data-lyrics-force-next-page="1"> … </div>。该层表示「词汇」从新的一页开始（与歌词分页衔接）。
2. 层内先写标题：<h2 class="lyrics-section-title">词汇</h2>。
3. 每个词条使用 <div class="lyrics-vocab-item"> 包裹，内层顺序为：
   - <p class="vocab-line1">：第一行。内用 <strong class="vocab-word">…</strong> 包裹日语词（汉字须带 <ruby> 振假名），<strong> 之后同一行接中文释义；
   - <p class="vocab-ex-ja">：日语例句（可含 <ruby>）。例句须与粘贴的歌词正文无关，难度须达 JLPT N3～N1。
   - <p class="vocab-ex-zh">：该例句的中文翻译。
   词条数最多 10 条。

重点语法板块：
1. 在词汇区之后，输出占位空行块：<div class="lyrics-grammar-spacer" aria-hidden="true"></div>。
2. 再输出：<div class="lyrics-grammar"><h2 class="lyrics-section-title">重点语法</h2>…</div>。
3. 每个语法点使用 <div class="lyrics-grammar-item"> 包裹，内层顺序为：
   - <h3 class="grammar-point-title"> 语法点标题；
   - <p class="grammar-detail"> 详细解析；
   - <p class="grammar-ex-ja"> 例句（日语，可含 <ruby>）；
   - <p class="grammar-ex-zh"> 例句的中文翻译。
   语法点最多 10 条。
4. 版式交由客户端：勿在 <h3 class="grammar-point-title"> 上使用内联 style。`;

const LYRICS_ONLY_TAIL = `
限制：只输出歌词正文（lyrics-group），不要输出词汇板块、重点语法板块或任何额外说明。`;

const PROMPT_FOOTER = `
代码纯净度：只输出 HTML 片段，不要任何解释或 markdown 围栏。`;

function buildLyricsNotesSystemPrompt(includeVocabAndGrammar: boolean): string {
  if (includeVocabAndGrammar) {
    return `${LYRICS_CORE_PROMPT}${VOCAB_GRAMMAR_PROMPT}${PROMPT_FOOTER}`;
  }
  return `${LYRICS_CORE_PROMPT}${LYRICS_ONLY_TAIL}${PROMPT_FOOTER}`;
}

function stripAssistantMarkdownFences(text: string): string {
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:html|HTML|xml)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }
  return t;
}

/** 补全词汇/语法板块的分页标记（打开旧歌词库记录时也会用到） */
export function normalizeLyricsBodyHtml(html: string): string {
  return ensureSectionPageBreakAttrs(html.trim());
}

function ensureSectionPageBreakAttrs(html: string): string {
  let s = html.replace(
    /<div(\s+[^>]*class="[^"]*\blyrics-vocabulary\b[^"]*"[^>]*)>/gi,
    (full, attrs: string) => {
      if (/data-lyrics-force-next-page/i.test(attrs)) return full;
      return `<div${attrs} data-lyrics-force-next-page="1">`;
    },
  );
  s = s.replace(
    /<div(\s+[^>]*class="[^"]*\blyrics-grammar\b[^"]*"[^>]*)>/gi,
    (full, attrs: string) => {
      if (/data-lyrics-force-next-page/i.test(attrs)) return full;
      return `<div${attrs} data-lyrics-force-next-page="1">`;
    },
  );
  return s;
}

function wrapClipBody(html: string): string {
  const inner = html.trim();
  if (!inner) return '<div class="clip-body lyrics-notes-body"></div>';
  if (/class\s*=\s*["'][^"']*clip-body/i.test(inner)) {
    return ensureSectionPageBreakAttrs(inner);
  }
  return ensureSectionPageBreakAttrs(`<div class="clip-body lyrics-notes-body">${inner}</div>`);
}

export async function fetchLyricsNotesFromVolcengine(
  rawText: string,
  onChunk?: (chunk: string) => void,
  options: LyricsNotesGenerateOptions = {},
): Promise<LyricsNotesClipResult> {
  const includeVocabAndGrammar = options.includeVocabAndGrammar !== false;
  const titleFromMarks = extractSongTitleFromLyricsRaw(rawText);
  const user = `以下为歌词原文（一句日语一句中文）：\n\n${rawText}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: buildLyricsNotesSystemPrompt(includeVocabAndGrammar) },
    { role: 'user', content: user },
  ];

  const raw = await sendChatMessageStream(messages, {
    max_tokens: 8192,
    temperature: 0.25,
    timeoutMs: 120_000,
    signal: options.signal,
  }, onChunk);

  const html = stripAssistantMarkdownFences(raw);
  if (!html) {
    throw new Error('模型未返回有效 HTML');
  }
  return {
    title: titleFromMarks ?? '歌词笔记',
    summary: '',
    bodyHtml: wrapClipBody(html),
  };
}
