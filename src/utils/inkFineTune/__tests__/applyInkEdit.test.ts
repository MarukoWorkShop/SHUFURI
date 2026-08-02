import { describe, it, expect } from 'vitest';
import {
  applyRemoveRuby,
  applyJpLineEdit,
} from '../applyInkEdit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 构建一条歌词组（.jp-line 含若干 ruby + 可选 .zh-line） */
function group(g: number, jpInner: string, zh?: string): string {
  const zhPart = zh ? `<div class="zh-line">${zh}</div>` : '';
  return `<div data-ink-g="${g}"><div class="jp-line">${jpInner}</div>${zhPart}</div>`;
}

function body(...groups: string[]): string {
  return groups.join('');
}

// ---------------------------------------------------------------------------
// applyRemoveRuby
// ---------------------------------------------------------------------------

describe('applyRemoveRuby', () => {
  it('replaces ruby with plain text (no rt, no data-ink-empty-rt)', () => {
    const input = body(
      group(0, '<ruby data-ink-r="0">漢<rt>かん</rt>字<rt>じ</rt></ruby>'),
    );
    const result = applyRemoveRuby(input, 0, 0);
    // 应该变成纯文本 "漢字"，不含 <ruby>/<rt>/data-ink-empty-rt
    expect(result).toContain('漢字');
    expect(result).not.toContain('<ruby');
    expect(result).not.toContain('<rt>');
    expect(result).not.toContain('data-ink-empty-rt');
  });

  it('preserves non-rt text nodes inside ruby', () => {
    const input = body(
      group(0, '前<ruby data-ink-r="0">漢字<rt>かんじ</rt></ruby>后'),
    );
    const result = applyRemoveRuby(input, 0, 0);
    // ruby 被替换为纯文本 "漢字"，前后文本保留
    expect(result).toContain('前漢字后');
    expect(result).not.toContain('<rt>');
  });

  it('returns original html when groupIndex not found', () => {
    const input = body(
      group(0, '<ruby data-ink-r="0">漢<rt>かん</rt></ruby>'),
    );
    expect(applyRemoveRuby(input, 99, 0)).toBe(input);
  });

  it('returns original html when rubyIndex not found', () => {
    const input = body(
      group(0, '<ruby data-ink-r="0">漢<rt>かん</rt></ruby>'),
    );
    expect(applyRemoveRuby(input, 0, 99)).toBe(input);
  });

  it('only removes the targeted ruby, leaves others intact', () => {
    const input = body(
      group(0, [
        '<ruby data-ink-r="0">漢<rt>かん</rt></ruby>',
        '<ruby data-ink-r="1">字<rt>じ</rt></ruby>',
      ].join('')),
    );
    const result = applyRemoveRuby(input, 0, 0);
    // 只移除 ruby[data-ink-r="0"]，ruby[data-ink-r="1"] 保留
    expect(result).toContain('<ruby data-ink-r="1">');
    expect(result).not.toContain('<ruby data-ink-r="0">');
    expect(result).toContain('字<rt>じ</rt>');
  });

  it('handles ruby with only text content (no kanji chars)', () => {
    const input = body(
      group(0, '<ruby data-ink-r="0">の<rt>no</rt></ruby>'),
    );
    const result = applyRemoveRuby(input, 0, 0);
    expect(result).toContain('の');
    expect(result).not.toContain('<ruby');
    expect(result).not.toContain('<rt>');
  });

  it('handles empty bodyHtml gracefully', () => {
    expect(applyRemoveRuby('', 0, 0)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// applyJpLineEdit
// ---------------------------------------------------------------------------

describe('applyJpLineEdit', () => {
  it('replaces entire .jp-line content', () => {
    const input = body(
      group(0, '<ruby data-ink-r="0">漢<rt>かん</rt></ruby>の<ruby data-ink-r="1">字<rt>じ</rt></ruby>'),
    );
    const result = applyJpLineEdit(input, 0, '新しい歌詞');
    expect(result).toContain('新しい歌詞');
    expect(result).not.toContain('<ruby');
    expect(result).not.toContain('<rt>');
  });

  it('trims whitespace from new text', () => {
    const input = body(
      group(0, '<ruby data-ink-r="0">元<rt>もと</rt></ruby>'),
    );
    const result = applyJpLineEdit(input, 0, '  新しい歌詞  ');
    expect(result).toContain('>新しい歌詞<');
  });

  it('preserves other groups', () => {
    const input = body(
      group(0, '<ruby data-ink-r="0">漢<rt>かん</rt></ruby>'),
      group(1, '<ruby data-ink-r="0">字<rt>じ</rt></ruby>'),
    );
    const result = applyJpLineEdit(input, 0, '新');
    // group 1 不变
    expect(result).toContain('<ruby data-ink-r="0">字<rt>じ</rt></ruby>');
    // group 0 被修改
    expect(result).toContain('新');
  });

  it('preserves .zh-line in the same group', () => {
    const input = body(
      group(0, '<ruby data-ink-r="0">漢<rt>かん</rt></ruby>', '中文翻译'),
    );
    const result = applyJpLineEdit(input, 0, '新');
    expect(result).toContain('新');
    expect(result).toContain('zh-line');
    expect(result).toContain('中文翻译');
  });

  it('returns original html when groupIndex not found', () => {
    const input = body(
      group(0, '<ruby data-ink-r="0">漢<rt>かん</rt></ruby>'),
    );
    expect(applyJpLineEdit(input, 99, '新')).toBe(input);
  });

  it('returns original html when no .jp-line in group', () => {
    const input = '<div data-ink-g="0"><div class="zh-line">翻译</div></div>';
    expect(applyJpLineEdit(input, 0, '新')).toBe(input);
  });

  it('returns original html for empty bodyHtml', () => {
    expect(applyJpLineEdit('', 0, '新')).toBe('');
  });
});
