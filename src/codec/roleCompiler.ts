import { escapeHtml } from '../utils/escapeHtml';
import { applyRubyMarkup } from '../utils/rubyMarkup';
import { applyZhRubyMarkup } from '../utils/zhLayout/zhRubyMarkup';
import { resolveExampleRef } from './resolveExampleRef';
import { resolvePosterClass, usesPlainHtml, usesRubyMarkup } from './masterHandbook';
import type { CompileOptions, StreamDocument } from './types';
import type { PosterTextRole } from './masterHandbook';

const GRAMMAR_TITLE_SPLIT_RE = /^(.+?)\s*[（(]([^）)]+)[）)]\s*$/;
const GRAMMAR_TITLE_SPACE_SPLIT_RE = /^(.+?)\s+([\u4e00-\u9fff\u3400-\u4dbf].+)$/;

function splitGrammarLabel(label: string): { orig: string; zh?: string } {
  const trimmed = label.trim();
  const paren = trimmed.match(GRAMMAR_TITLE_SPLIT_RE);
  if (paren) {
    return { orig: (paren[1] ?? trimmed).trim(), zh: paren[2]?.trim() };
  }
  const spaced = trimmed.match(GRAMMAR_TITLE_SPACE_SPLIT_RE);
  if (spaced) {
    return { orig: spaced[1]!.trim(), zh: spaced[2]!.trim() };
  }
  return { orig: trimmed };
}

function renderText(
  text: string,
  role: PosterTextRole,
  lang: StreamDocument['header']['lang'],
): string {
  if (!text.trim()) return '';
  if (lang === 'zh' && usesRubyMarkup(role, lang)) return applyZhRubyMarkup(text);
  if (usesPlainHtml(role, lang)) return escapeHtml(text);
  if (usesRubyMarkup(role, lang)) return applyRubyMarkup(text);
  return escapeHtml(text);
}

function taggedLine(className: string, innerHtml: string): string {
  if (!className || !innerHtml) return '';
  return `<p class="${className}">${innerHtml}</p>`;
}

function buildLyricsSection(doc: StreamDocument, opts?: CompileOptions): string {
  const lang = doc.header.lang;
  const groups = doc.lyrics
    .sort((a, b) => a.index - b.index)
    .map((line) => {
      const primaryClass = resolvePosterClass('lyricPrimary', lang, opts);
      const secondaryClass = resolvePosterClass('lyricSecondary', lang, opts);
      const primary = taggedLine(primaryClass, renderText(line.primary, 'lyricPrimary', lang));
      const secondary = secondaryClass && line.gloss
        ? taggedLine(secondaryClass, renderText(line.gloss, 'lyricSecondary', lang))
        : '';
      return `<div class="lyrics-group">${primary}${secondary}</div>`;
    })
    .join('');
  if (!groups) return '';
  return groups;
}

function buildVocabularySection(doc: StreamDocument, opts?: CompileOptions): string {
  const lang = doc.header.lang;
  const items = doc.vocab
    .sort((a, b) => a.seq - b.seq)
    .map((row) => {
      if (!row.term) return '';
      const meaning = row.meaning
        ? ` <span class="${resolvePosterClass('vocabMeaning', lang, opts)}">${escapeHtml(row.meaning)}</span>`
        : '';
      const ex = resolveExampleRef(row.exampleRef, row.exampleTrans, doc.lyrics);
      const exPrimaryClass = resolvePosterClass('vocabExamplePrimary', lang, opts);
      const exSecondaryClass = resolvePosterClass('vocabExampleSecondary', lang, opts);
      const exOrig = ex.primary
        ? taggedLine(exPrimaryClass, renderText(ex.primary, 'vocabExamplePrimary', lang))
        : '';
      const exZh = ex.translation
        ? taggedLine(exSecondaryClass, escapeHtml(ex.translation))
        : '';
      const termHtml = `<span class="${resolvePosterClass('vocabTerm', lang, opts)}">${renderText(row.term, 'vocabTerm', lang)}</span>`;
      return `<div class="lyrics-vocab-item"><p class="vocab-line1">${termHtml}${meaning}</p>${exOrig}${exZh}</div>`;
    })
    .filter(Boolean)
    .join('');
  if (!items) return '';
  return `<div class="lyrics-vocabulary" data-lyrics-force-next-page="1"><h2 class="lyrics-section-title">重点词汇</h2>${items}</div>`;
}

function buildGrammarTitle(label: string, lang: StreamDocument['header']['lang'], opts?: CompileOptions): string {
  const { orig, zh } = splitGrammarLabel(label);
  const origHtml = `<span class="${resolvePosterClass('grammarTitlePrimary', lang, opts)}">${renderText(orig, 'grammarTitlePrimary', lang)}</span>`;
  const zhHtml = zh
    ? ` <span class="${resolvePosterClass('grammarTitleSecondary', lang, opts)}">${escapeHtml(zh)}</span>`
    : '';
  return `${origHtml}${zhHtml}`;
}

function buildGrammarSection(doc: StreamDocument, opts?: CompileOptions): string {
  const lang = doc.header.lang;
  const items = doc.grammar
    .sort((a, b) => a.seq - b.seq)
    .map((row) => {
      if (!row.label) return '';
      const title = buildGrammarTitle(row.label, lang, opts);
      const detail = row.detail
        ? `<p class="${resolvePosterClass('grammarDetail', lang, opts)}">${escapeHtml(row.detail)}</p>`
        : '';
      const ex = resolveExampleRef(row.exampleRef, row.exampleTrans, doc.lyrics);
      const exPrimaryClass = resolvePosterClass('grammarExamplePrimary', lang, opts);
      const exSecondaryClass = resolvePosterClass('grammarExampleSecondary', lang, opts);
      const exOrig = ex.primary
        ? taggedLine(exPrimaryClass, renderText(ex.primary, 'grammarExamplePrimary', lang))
        : '';
      const exZh = ex.translation
        ? taggedLine(exSecondaryClass, escapeHtml(ex.translation))
        : '';
      return `<div class="lyrics-grammar-item"><h3 class="grammar-point-title">${title}</h3>${detail}${exOrig}${exZh}</div>`;
    })
    .filter(Boolean)
    .join('');
  if (!items) return '';
  return `<div class="lyrics-grammar" data-lyrics-force-next-page="1"><h2 class="lyrics-section-title">重点语法</h2>${items}</div>`;
}

export function compileStreamDocument(doc: StreamDocument, opts?: CompileOptions): string {
  const lyrics = buildLyricsSection(doc, opts);
  const vocab = buildVocabularySection(doc, opts);
  const grammar = buildGrammarSection(doc, opts);
  return `${lyrics}${vocab}${grammar}`.trim();
}
