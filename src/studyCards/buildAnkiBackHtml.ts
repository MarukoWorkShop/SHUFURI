import { escapeHtml } from '../utils/escapeHtml';
import { rubyToAnkiFurigana } from './rubyToAnkiFurigana';

export type AnkiBackParts = {
  meaning: string;
  sourceLabel: string;
  lyricJa?: string;
  lyricZh?: string;
  useAnkiFurigana: boolean;
  /** 词汇出典附带歌名；语法例句不附带（默认 true） */
  includeSourceAttribution?: boolean;
};

export function buildAnkiBackHtml(parts: AnkiBackParts): string {
  const meaning = escapeHtml(parts.meaning.trim());
  const source = escapeHtml(parts.sourceLabel.trim());
  const includeSource = parts.includeSourceAttribution !== false;

  const lyricJaPlain = parts.lyricJa?.trim()
    ? parts.useAnkiFurigana
      ? rubyToAnkiFurigana(parts.lyricJa.trim())
      : parts.lyricJa.trim()
    : '';
  const lyricJa = lyricJaPlain ? escapeHtml(lyricJaPlain) : '';
  const lyricZh = parts.lyricZh?.trim() ? escapeHtml(parts.lyricZh.trim()) : '';
  const sourceLine = lyricJaPlain
    ? includeSource
      ? `${escapeHtml(lyricJaPlain)} —— ${source}`
      : escapeHtml(lyricJaPlain)
    : parts.lyricZh?.trim()
      ? includeSource
        ? `${escapeHtml(parts.lyricZh.trim())} —— ${source}`
        : escapeHtml(parts.lyricZh.trim())
      : includeSource
        ? source
        : '';

  const chunks = [
    `<span style="font-size:1em">${meaning}</span>`,
    `<br /><br />`,
  ];

  if (sourceLine) {
    chunks.push(`<span style="opacity:0.55;font-size:0.92em">📍 ${sourceLine}</span>`);
  }

  if (lyricJa && parts.lyricZh?.trim()) {
    chunks.push(`<br /><span style="opacity:0.75">${lyricZh}</span>`);
  }

  return chunks.join('');
}
