import { escapeHtml } from './escapeHtml';
import { applyRubyMarkup } from './rubyMarkup';
import { DEFAULT_ARTIST, normalizeArtistName } from './furiganaLayout/posterTitle';
import type { LangCode } from '../services/appSettings';

export type ParsedStructuredLyrics = {
  bodyHtml: string;
  title?: string;
  artist?: string;
  /** 歌词主流语言（大模型声明或自动检测） */
  lang?: LangCode;
};

export function isStructuredLyricsText(text: string): boolean {
  const t = normalizeStructuredLyricsText(text.trim());
  return /===BEGIN===/i.test(t) || /===LYRICS===/i.test(t);
}

/** 结构化文本的区段 / 块标记行（不能当作歌名） */
export function isStructuredMarkerLine(line: string): boolean {
  const s = line.trim();
  if (!s) {
    return true;
  }
  return (
    /^===(?:BEGIN|LYRICS|VOCAB|GRAMMAR|MAGAZINE|END)===$/i.test(s) ||
    /^---(?:PAIR|WORD|POINT|SECTION|END)(?:---|===)?$/i.test(s) ||
    /^(?:JP|ZH|KO|EN|TERM|MEANING|EX_JP|EX_KO|EX_ZH|EX_EN|TITLE|DETAIL|LANG):\s/i.test(s)
  );
}

/** 统一豆包 / 移动端粘贴的区段与块分隔符（空格、Unicode 破折号等） */
export function normalizeStructuredLyricsText(raw: string): string {
  let s = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  s = s.replace(/===\s*(BEGIN|LYRICS|VOCAB|GRAMMAR|END)\s*===/gi, '===$1===');
  s = s.replace(/\u2013|\u2014|\u2212/g, '-');
  s = s.replace(/---\s*(PAIR|WORD|POINT|END)\s*---/gi, '---$1---');

  // AI 常见：块结束与下一区段粘连，如 ---END===VOCAB=== / ---END---VOCAB===
  s = s.replace(
    /---END=+(BEGIN|LYRICS|VOCAB|GRAMMAR|END)===/gi,
    '---END---\n===$1===',
  );
  s = s.replace(
    /---END---+(BEGIN|LYRICS|VOCAB|GRAMMAR|END)===/gi,
    '---END---\n===$1===',
  );
  // 豆包 Python 脚本 print("---END===") 的变体（块尾，无区段名）
  s = s.replace(/---END===+(?!(BEGIN|LYRICS|VOCAB|GRAMMAR|END)===)/gi, '---END---');

  // 书名号变体统一为 《》
  s = s.replace(/[「『]([^」』\n]+)[」』]/g, '《$1》');

  return s;
}

function extractSection(raw: string, name: string): string {
  const re = new RegExp(`===${name}===\\s*([\\s\\S]*?)(?====|$)`, 'i');
  const m = raw.match(re);
  return m?.[1]?.trim() ?? '';
}

function splitDelimitedBlocks(section: string, startMarker: string): string[] {
  if (!section.trim()) {
    return [];
  }
  const markerRe = new RegExp(startMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  // 按块头切分，兼容块与块之间缺少 ---END--- 的豆包移动端输出
  return section
    .split(markerRe)
    .map((block) => block.replace(/---END---/gi, '').replace(/---END===/gi, '').trim())
    .filter(Boolean);
}

function parseFieldBlock(block: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let currentKey: string | null = null;

  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const m = trimmed.match(/^([A-Z_]+):\s*(.*)$/i);
    if (m) {
      currentKey = m[1]!.toUpperCase();
      fields[currentKey] = m[2]!.trim();
    } else if (currentKey) {
      // 续行：追加到当前字段值（保持 AI 原始换行语义）
      fields[currentKey] += '\n' + trimmed;
    }
    // 无 currentKey 且不匹配 KEY: 的行 → 丢弃（块头尾噪音）
  }
  return fields;
}

function parseHeader(raw: string): { artist?: string; title?: string } {
  const text = raw.trim();
  if (!text) {
    return {};
  }

  let metaArtist: string | undefined;
  let metaTitle: string | undefined;

  for (const line of text.split('\n')) {
    const stripped = line.trim();
    if (!stripped || isStructuredMarkerLine(stripped)) {
      continue;
    }

    const artistField = stripped.match(/^Artist:\s*(.+)$/i);
    if (artistField) {
      metaArtist = normalizeArtistName(artistField[1]!.trim()) ?? artistField[1]!.trim();
      continue;
    }
    const titleField = stripped.match(/^Title:\s*(.+)$/i);
    if (titleField) {
      metaTitle = titleField[1]!.trim();
      continue;
    }

    const hash = stripped.match(/^#\s*(.+?)《([^》]+)》/);
    if (hash) {
      return {
        artist: normalizeArtistName(hash[1]!.trim()) ?? DEFAULT_ARTIST,
        title: hash[2]!.trim(),
      };
    }

    const plain = stripped.match(/^(.+?)《([^》]+)》$/);
    if (plain) {
      const artistRaw = plain[1]!.trim();
      if (!/^===(?:BEGIN|LYRICS|VOCAB|GRAMMAR|END)===/i.test(artistRaw)) {
        return {
          artist: normalizeArtistName(artistRaw) ?? DEFAULT_ARTIST,
          title: plain[2]!.trim(),
        };
      }
    }

    const titleOnly = stripped.match(/^《([^》]+)》$/);
    if (titleOnly) {
      return { title: titleOnly[1]!.trim() };
    }
  }

  if (metaTitle || metaArtist) {
    return {
      title: metaTitle,
      artist: metaArtist,
    };
  }

  const loose = text.match(/(?:^|\n)\s*#?\s*([^《\n]{1,48}?)《([^》\n]+)》/);
  if (loose) {
    const artistRaw = loose[1]!.trim().replace(/^#\s*/, '');
    if (artistRaw && !isStructuredMarkerLine(artistRaw)) {
      return {
        artist: normalizeArtistName(artistRaw) ?? DEFAULT_ARTIST,
        title: loose[2]!.trim(),
      };
    }
    return { title: loose[2]!.trim() };
  }

  const titleOnlyLoose = text.match(/《([^》\n]+)》/);
  if (titleOnlyLoose) {
    return { title: titleOnlyLoose[1]!.trim() };
  }

  return {};
}

/** 从 BEGIN 与 LYRICS 之间的头部块提取歌手 / 歌名 */
export function extractStructuredHeader(raw: string): { artist?: string; title?: string } {
  const text = normalizeStructuredLyricsText(raw.trim());
  const betweenBeginLyrics = text.match(/===BEGIN===\s*([\s\S]*?)(?:===LYRICS===|$)/i);
  const headerPart = betweenBeginLyrics?.[1]?.trim()
    ?? (text.split(/===LYRICS===/i)[0] ?? '').replace(/^===BEGIN===\s*/i, '').trim();
  return parseHeader(headerPart);
}

function taggedLine(className: string, innerHtml: string): string {
  // 续行符 → <br>：保持 AI 原始多行排版语义
  return `<p class="${className}">${innerHtml.replace(/\n/g, '<br>')}</p>`;
}
function buildLyricsGroups(section: string): string[] {
  return splitDelimitedBlocks(section, '---PAIR---')
    .map((block) => {
      const fields = parseFieldBlock(block);
      const jp = fields.JP;
      const ko = fields.KO;
      const en = fields.EN;
      const zh = fields.ZH;
      if (!jp && !ko && !en && !zh) {
        return '';
      }
      // 韩文 > 英文 > 日文
      const origLang = ko ? 'ko' : en ? 'jp' : 'jp';
      const origText = ko || en || jp;
      const origHtml = origText
        ? taggedLine(
            `${origLang}-line`,
            ko || en
              ? escapeHtml(origText)
              : applyRubyMarkup(origText),
          )
        : '';
      const zhHtml = zh ? taggedLine('zh-line', escapeHtml(zh)) : '';
      return `<div class="lyrics-group">${origHtml}${zhHtml}</div>`;
    })
    .filter(Boolean);
}

type StructuredContentLang = 'jp' | 'ko' | 'en';

/** 判定词汇/语法例句应使用的原语言（优先 LANG: 声明，其次歌词区标签） */
function resolveStructuredContentLang(text: string, lyricsSection: string): StructuredContentLang {
  const langMatch = text.match(/^LANG:\s*(jp|ko|en)\s*$/im);
  if (langMatch) {
    return langMatch[1]!.toLowerCase() as StructuredContentLang;
  }
  if (/^KO:/im.test(lyricsSection)) return 'ko';
  if (/^EN:/im.test(lyricsSection)) return 'en';
  const grammarSection = extractSection(text, 'GRAMMAR');
  if (/EX_EN:/im.test(grammarSection)) return 'en';
  if (/EX_KO:/im.test(grammarSection)) return 'ko';
  return 'jp';
}

function pickOrigExample(
  fields: Record<string, string>,
  contentLang: StructuredContentLang,
  classPrefix: 'grammar-ex' | 'vocab-ex',
): { text?: string; className: string; ruby: boolean } {
  if (contentLang === 'ko') {
    return { text: fields.EX_KO, className: `${classPrefix}-ko`, ruby: false };
  }
  if (contentLang === 'en') {
    // 英语例句复用 *-ja 类名；排版层在 LANG=en 时对 primaryFont 统一用 Sansation
    return { text: fields.EX_EN, className: `${classPrefix}-ja`, ruby: false };
  }
  return { text: fields.EX_JP, className: `${classPrefix}-ja`, ruby: true };
}

function buildVocabulary(section: string, contentLang: StructuredContentLang): string {
  const blocks = splitDelimitedBlocks(section, '---WORD---');
  if (!blocks.length) {
    return '';
  }

  const items = blocks
    .map((block) => {
      const fields = parseFieldBlock(block);
      const term = fields.TERM;
      if (!term) {
        return '';
      }
      const meaning = fields.MEANING
        ? ` <span class="vocab-meaning">${escapeHtml(fields.MEANING)}</span>`
        : '';

      const { text: exOrigText, className: exOrigClass, ruby: exRuby } = pickOrigExample(
        fields,
        contentLang,
        'vocab-ex',
      );
      const exOrig = exOrigText
        ? taggedLine(exOrigClass, exRuby ? applyRubyMarkup(exOrigText) : escapeHtml(exOrigText))
        : '';

      const exZh = fields.EX_ZH
        ? taggedLine('vocab-ex-zh', escapeHtml(fields.EX_ZH))
        : '';

      const termHtml = contentLang === 'ko'
        ? `<span class="vocab-word-ko">${escapeHtml(term)}</span>`
        : contentLang === 'en'
          ? `<span class="vocab-word">${escapeHtml(term)}</span>`
          : `<span class="vocab-word">${applyRubyMarkup(term)}</span>`;

      return `<div class="lyrics-vocab-item"><p class="vocab-line1">${termHtml}${meaning}</p>${exOrig}${exZh}</div>`;
    })
    .filter(Boolean)
    .join('');

  if (!items) {
    return '';
  }

  return `<div class="lyrics-vocabulary" data-lyrics-force-next-page="1"><h2 class="lyrics-section-title">重点词汇</h2>${items}</div>`;
}

/** 语法点标题：语法点（中文释义）→ 与词汇条 TERM + MEANING 同款双 span */
const GRAMMAR_TITLE_SPLIT_RE = /^(.+?)\s*[（(]([^）)]+)[）)]\s*$/;

function buildGrammarTitleHtml(title: string, contentLang: StructuredContentLang): string {
  const trimmed = title.trim();
  const m = trimmed.match(GRAMMAR_TITLE_SPLIT_RE);
  const orig = (m?.[1] ?? trimmed).trim();
  const zh = m?.[2]?.trim();

  const origHtml =
    contentLang === 'ko'
      ? `<span class="grammar-title-ko">${escapeHtml(orig)}</span>`
      : contentLang === 'jp'
        ? `<span class="grammar-title-ja">${applyRubyMarkup(orig)}</span>`
        : `<span class="grammar-title-ja">${escapeHtml(orig)}</span>`;

  const zhHtml = zh ? ` <span class="grammar-title-zh">${escapeHtml(zh)}</span>` : '';
  return `${origHtml}${zhHtml}`;
}

function buildGrammar(section: string, contentLang: StructuredContentLang): string {
  const blocks = splitDelimitedBlocks(section, '---POINT---');
  if (!blocks.length) {
    return '';
  }

  const items = blocks
    .map((block) => {
      const fields = parseFieldBlock(block);
      const title = fields.TITLE;
      if (!title) {
        return '';
      }
      const detail = fields.DETAIL
        ? `<p class="grammar-detail">${escapeHtml(fields.DETAIL)}</p>`
        : '';

      const { text: exOrigText, className: exOrigClass, ruby: exRuby } = pickOrigExample(
        fields,
        contentLang,
        'grammar-ex',
      );
      const exOrig = exOrigText
        ? taggedLine(exOrigClass, exRuby ? applyRubyMarkup(exOrigText) : escapeHtml(exOrigText))
        : '';

      const exZh = fields.EX_ZH
        ? taggedLine('grammar-ex-zh', escapeHtml(fields.EX_ZH))
        : '';

      return `<div class="lyrics-grammar-item"><h3 class="grammar-point-title">${buildGrammarTitleHtml(title, contentLang)}</h3>${detail}${exOrig}${exZh}</div>`;
    })
    .filter(Boolean)
    .join('');

  if (!items) {
    return '';
  }

  return `<div class="lyrics-grammar" data-lyrics-force-next-page="1"><h2 class="lyrics-section-title">重点语法</h2>${items}</div>`;
}

// ---- 语言检测 ----

/** 检测文本中各语言字符的占比 */
function countLangChars(text: string): { jp: number; ko: number; zh: number; en: number } {
  let jp = 0; let ko = 0; let zh = 0; let en = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if ((code >= 0x3040 && code <= 0x309F) || (code >= 0x30A0 && code <= 0x30FF)) {
      jp += 1;  // 假名/片假名
    } else if (code >= 0xAC00 && code <= 0xD7AF) {
      ko += 1;  // 韩文 Hangul
    } else if (code >= 0x4E00 && code <= 0x9FFF) {
      zh += 1;  // 汉字（中日共用，但有假名时优先归日文）
    } else if ((code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)) {
      en += 1;  // 拉丁字母
    }
  }
  return { jp, ko, zh, en };
}

/** 从文本内容自动检测语言 */
function detectLangFromText(text: string): LangCode {
  const counts = countLangChars(text);

  // 假名是高置信度日语特征
  if (counts.jp > 0) return 'jp';

  // 韩文是高置信度韩语特征
  if (counts.ko > 0) return 'ko';

  // 汉字（无可辨别假名/韩文时）：归为中文
  if (counts.zh > 0) return 'zh';

  // 默认英语/拉丁
  return 'en';
}

/** 从歌词内容（LYRICS 区段原文）检测主流语言 */
function detectLangFromLyrics(lyricsSection: string): LangCode {
  // 过滤掉标记行，保留实际歌词文本
  const cleanText = lyricsSection
    .replace(/^(JP|KO|ZH|EN|TERM|MEANING|EX_JP|EX_KO|EX_ZH|EX_EN|TITLE|DETAIL|LANG):\s*/gim, '')
    .replace(/---PAIR---|---WORD---|---POINT---|---END---/gi, '')
    .trim();

  if (!cleanText) return 'en';
  return detectLangFromText(cleanText);
}

/** 解析 LANG: 字段，失败时回退到自动检测 */
export function extractStructuredLang(raw: string): LangCode | undefined {
  // 1) 显式 LANG: 字段
  const langMatch = raw.match(/^LANG:\s*(jp|ko|en|zh)\s*$/im);
  if (langMatch) {
    const val = langMatch[1]!.toLowerCase() as LangCode;
    if (val === 'jp' || val === 'ko' || val === 'en' || val === 'zh') {
      return val;
    }
  }

  // 2) 无显式字段时自动检测（如 AUTO 模式或旧数据）
  const lyricsSection = /===LYRICS===([\s\S]*?)(?:===)/i.exec(raw)?.[1] ?? raw;
  if (lyricsSection.trim()) {
    return detectLangFromLyrics(lyricsSection);
  }

  return undefined;
}

export function parseStructuredLyricsText(raw: string): ParsedStructuredLyrics {
  const text = normalizeStructuredLyricsText(raw.trim());
  if (!text) {
    throw new Error('粘贴内容为空');
  }

  const lyricsSection = extractSection(text, 'LYRICS');
  const groups = buildLyricsGroups(lyricsSection);
  if (!groups.length) {
    throw new Error('未找到歌词对（需含 ===LYRICS=== 与 ---PAIR---）');
  }

  // 根据 LANG: / 歌词标签判定原语言（jp / ko / en）
  const contentLang = resolveStructuredContentLang(text, lyricsSection);

  const vocab = buildVocabulary(extractSection(text, 'VOCAB'), contentLang);
  const grammar = buildGrammar(extractSection(text, 'GRAMMAR'), contentLang);
  const header = extractStructuredHeader(text);
  const inner = [...groups, vocab, grammar].filter(Boolean).join('');
  const bodyHtml = `<div class="clip-body lyrics-notes-body">${inner}</div>`;

  // 从原始文本解析语言（含回退自动检测）
  const lang = extractStructuredLang(text);

  return {
    bodyHtml,
    title: header.title,
    artist: header.artist,
    lang,
  };
}

/** 最小可排版样例（开发自测） */
export const STRUCTURED_LYRICS_SAMPLE = `===BEGIN===
# 山口百惠《秋樱》
===LYRICS===
---PAIR---
JP: {秋|あき}の{風|かぜ}に{舞|ま}う
ZH: 在秋风中飞舞
---END---
---PAIR---
JP: コスモスが{揺|ゆ}れる
ZH: 大波斯菊轻轻摇摆
---END---
===VOCAB===
---WORD---
TERM: {秋桜|コスモス}
MEANING: 大波斯菊
EX_JP: {道|みち}の{端|はた}に{秋桜|コスモス}が{咲|さ}いている。
EX_ZH: 路边开着大波斯菊。
---END---
===GRAMMAR===
---POINT---
TITLE: ～てゆく（逐渐…下去）
DETAIL: 动词て形接ゆく，表示随时间推移持续变化，歌词中常见。
EX_JP: {雲|くも}が{流|なが}れてゆく。
EX_ZH: 云朵渐渐飘远。
---END===
===END===`;
