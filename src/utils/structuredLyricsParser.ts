import { escapeHtml } from './escapeHtml';
import { applyRubyMarkup } from './rubyMarkup';
import { DEFAULT_ARTIST, normalizeArtistName } from './furiganaLayout/posterTitle';

export type ParsedStructuredLyrics = {
  bodyHtml: string;
  title?: string;
  artist?: string;
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
    /^(?:JP|ZH|KO|TERM|MEANING|EX_JP|EX_KO|EX_ZH|TITLE|DETAIL):\s/i.test(s)
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
  for (const line of block.split('\n')) {
    const m = line.match(/^([A-Z_]+):\s*(.*)$/i);
    if (m) {
      fields[m[1]!.toUpperCase()] = m[2]!.trim();
    }
  }
  return fields;
}

function parseHeader(raw: string): { artist?: string; title?: string } {
  const hash = raw.match(/^#\s*(.+?)《([^》\n]+)》/m);
  if (hash) {
    const artist = normalizeArtistName(hash[1]!.trim()) ?? DEFAULT_ARTIST;
    const title = hash[2]!.trim();
    return { artist, title };
  }
  // 豆包常见：BEGIN 下直接「歌手《歌名》」无 # 前缀
  const plain = raw.match(/^(.+?)《([^》\n]+)》\s*$/m);
  if (plain) {
    const artist = normalizeArtistName(plain[1]!.trim()) ?? DEFAULT_ARTIST;
    const title = plain[2]!.trim();
    return { artist, title };
  }
  return {};
}

/** 从 BEGIN 与 LYRICS 之间的头部块提取歌手 / 歌名 */
export function extractStructuredHeader(raw: string): { artist?: string; title?: string } {
  const text = normalizeStructuredLyricsText(raw.trim());
  const headerPart = text.split(/===LYRICS===/i)[0] ?? '';
  return parseHeader(headerPart);
}

function taggedLine(className: string, innerHtml: string): string {
  return `<p class="${className}">${innerHtml}</p>`;
}
function buildLyricsGroups(section: string): string[] {
  return splitDelimitedBlocks(section, '---PAIR---')
    .map((block) => {
      const fields = parseFieldBlock(block);
      const jp = fields.JP;
      const ko = fields.KO;
      const zh = fields.ZH;
      if (!jp && !ko && !zh) {
        return '';
      }
      // 韩文优先（KO: 标签存在），否则日语模式
      const origLang = ko ? 'ko' : 'jp';
      const origText = ko || jp;
      const origHtml = origText
        ? taggedLine(`${origLang}-line`, origLang === 'ko' ? escapeHtml(origText) : applyRubyMarkup(origText))
        : '';
      const zhHtml = zh ? taggedLine('zh-line', escapeHtml(zh)) : '';
      return `<div class="lyrics-group">${origHtml}${zhHtml}</div>`;
    })
    .filter(Boolean);
}

function buildVocabulary(section: string, isKorean: boolean): string {
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

      // 韩文例句（EX_KO）或日文例句（EX_JP），韩文无 ruby 注音
      const exOrigText = isKorean ? fields.EX_KO : fields.EX_JP;
      const exOrigClass = isKorean ? 'vocab-ex-ko' : 'vocab-ex-ja';
      const exOrig = exOrigText
        ? taggedLine(exOrigClass, isKorean ? escapeHtml(exOrigText) : applyRubyMarkup(exOrigText))
        : '';

      const exZh = fields.EX_ZH
        ? taggedLine('vocab-ex-zh', escapeHtml(fields.EX_ZH))
        : '';

      // TERM 本身：韩文是纯 Hangul 不需要注音，日文需要
      const termHtml = isKorean
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

function buildGrammar(section: string, isKorean: boolean): string {
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

      // 韩文例句或日文例句
      const exOrigText = isKorean ? fields.EX_KO : fields.EX_JP;
      const exOrigClass = isKorean ? 'grammar-ex-ko' : 'grammar-ex-ja';
      const exOrig = exOrigText
        ? taggedLine(exOrigClass, isKorean ? escapeHtml(exOrigText) : applyRubyMarkup(exOrigText))
        : '';

      const exZh = fields.EX_ZH
        ? taggedLine('grammar-ex-zh', escapeHtml(fields.EX_ZH))
        : '';

      return `<div class="lyrics-grammar-item"><h3 class="grammar-point-title">${escapeHtml(title)}</h3>${detail}${exOrig}${exZh}</div>`;
    })
    .filter(Boolean)
    .join('');

  if (!items) {
    return '';
  }

  return `<div class="lyrics-grammar" data-lyrics-force-next-page="1"><h2 class="lyrics-section-title">重点语法</h2>${items}</div>`;
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

  // 自动检测语言模式：歌词中存在 KO: 标签 → 韩文
  const isKorean = /^KO:/im.test(lyricsSection);

  const vocab = buildVocabulary(extractSection(text, 'VOCAB'), isKorean);
  const grammar = buildGrammar(extractSection(text, 'GRAMMAR'), isKorean);
  const header = parseHeader(text);
  const inner = [...groups, vocab, grammar].filter(Boolean).join('');
  const bodyHtml = `<div class="clip-body lyrics-notes-body">${inner}</div>`;

  return {
    bodyHtml,
    title: header.title,
    artist: header.artist,
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
