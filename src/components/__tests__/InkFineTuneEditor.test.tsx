import { describe, it, expect, vi } from 'vitest';

// 模拟 title 读取（顶层，vitest 会 hoist）
vi.mock('../../utils/shufuriPoster/posterTitle', () => ({
  readPosterTitleFromElement: () => ({ title: 'テスト曲', artist: '歌手A' }),
}));

import { resolveEditTarget } from '../InkFineTuneEditor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 挂载一段 HTML 到 jsdom document，返回所有元素以便用 closest 查找。
 */
function mount(html: string): HTMLElement {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '0';
  container.style.top = '0';
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

function unmount(el: HTMLElement) {
  el.remove();
}

// ---------------------------------------------------------------------------
// resolveEditTarget – kind:'jp'
// ---------------------------------------------------------------------------

describe('resolveEditTarget - kind:jp', () => {
  it('returns kind:jp when clicking on plain text inside .jp-line (no ruby)', () => {
    const root = mount(
      '<div data-ink-g="0"><div class="jp-line">これはテストです</div></div>',
    );
    const jpLine = root.querySelector('.jp-line')!;
    const target = resolveEditTarget(jpLine);
    expect(target?.kind).toBe('jp');
    if (target?.kind === 'jp') {
      expect(target.groupIndex).toBe(0);
      expect(target.text).toBe('これはテストです');
    }
    unmount(root);
  });

  it('returns kind:ruby when clicking on a ruby element (check happens first)', () => {
    const root = mount(
      '<div data-ink-g="0"><div class="jp-line"><ruby data-ink-r="0">漢<rt>かん</rt></ruby></div></div>',
    );
    const ruby = root.querySelector('ruby')!;
    const target = resolveEditTarget(ruby);
    // 点击 ruby 本身 → 仍然是 kind:'ruby'，不被 kind:'jp' 覆盖
    expect(target?.kind).toBe('ruby');
    if (target?.kind === 'ruby') {
      expect(target.readingScript).toBe('kana');
    }
    unmount(root);
  });

  it('returns readingScript:pinyin for ruby inside .cn-line', () => {
    const root = mount(
      '<div data-ink-g="0"><div class="cn-line"><ruby data-ink-r="0">花<rt>huā</rt></ruby></div></div>',
    );
    const ruby = root.querySelector('ruby')!;
    const target = resolveEditTarget(ruby);
    expect(target?.kind).toBe('ruby');
    if (target?.kind === 'ruby') {
      expect(target.readingScript).toBe('pinyin');
      expect(target.kanji).toBe('花');
      expect(target.kana).toBe('huā');
    }
    unmount(root);
  });

  it('returns kind:jp when clicking on non-ruby text in jp-line that has rubies', () => {
    const root = mount(`
      <div data-ink-g="0">
        <div class="jp-line">
          <ruby data-ink-r="0">漢<rt>かん</rt></ruby>
          の
          <ruby data-ink-r="1">字<rt>じ</rt></ruby>
        </div>
      </div>
    `);
    // 点击 jp-line 本身（非 ruby 子元素）应该返回 kind:'jp'
    const jpLine = root.querySelector('.jp-line')!;
    const target = resolveEditTarget(jpLine);
    expect(target?.kind).toBe('jp');
    if (target?.kind === 'jp') {
      expect(target.groupIndex).toBe(0);
      // textContent 提取纯文本（不含 rt）
      expect(target.text).toContain('漢');
      expect(target.text).toContain('字');
    }
    unmount(root);
  });

  it('returns kind:jp when clicking on a plain text node inside jp-line', () => {
    const root = mount(`
      <div data-ink-g="3">
        <div class="jp-line"><ruby data-ink-r="0">花<rt>はな</rt></ruby>が咲く</div>
      </div>
    `);
    // "が咲く" 是 plain text，在 DocumentFragment 中需要用 textContent 找
    // 直接找 jp-line
    const jpLine = root.querySelector('.jp-line')!;
    const target = resolveEditTarget(jpLine);
    expect(target?.kind).toBe('jp');
    if (target?.kind === 'jp') {
      expect(target.groupIndex).toBe(3);
    }
    unmount(root);
  });

  it('still returns kind:zh when clicking on .zh-line', () => {
    const root = mount(
      '<div data-ink-g="0"><div class="jp-line">テスト</div><div class="zh-line">测试</div></div>',
    );
    const zhLine = root.querySelector('.zh-line')!;
    const target = resolveEditTarget(zhLine);
    expect(target?.kind).toBe('zh');
    unmount(root);
  });

  it('returns null when clicking outside data-ink-g scope', () => {
    const root = mount('<div class="jp-line">裸 jp-line 无 data-ink-g 祖先</div>');
    const jpLine = root.querySelector('.jp-line')!;
    const target = resolveEditTarget(jpLine);
    expect(target).toBeNull();
    unmount(root);
  });
});
