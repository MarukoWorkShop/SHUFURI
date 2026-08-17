import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { InkEditTarget } from '../../components/InkFineTunePopover';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockApplyJpLineEdit = vi.fn((html: string, _gi: number, _jp: string) => html);
const mockApplyRemoveRuby = vi.fn((html: string, _gi: number, _ri: number) => html);
const mockApplyRubyEdit = vi.fn((html: string) => html);
const mockApplyZhLineEdit = vi.fn((html: string) => html);
const mockPrepareBodyHtml = vi.fn((html: string) => `__prepared__${html}__`);
const mockSaveDraft = vi.fn();
const mockPlaySound = vi.fn();

vi.mock('../../utils/inkFineTune/applyInkEdit', () => ({
  applyRubyEdit: (...a: unknown[]) => mockApplyRubyEdit(...a),
  applyZhLineEdit: (...a: unknown[]) => mockApplyZhLineEdit(...a),
  applyRemoveRuby: (...a: unknown[]) => mockApplyRemoveRuby(...a),
  applyJpLineEdit: (...a: unknown[]) => mockApplyJpLineEdit(...a),
}));

vi.mock('../../utils/inkFineTune/inkFineTuneDraft', () => ({
  saveInkFineTuneDraft: (...a: unknown[]) => mockSaveDraft(...a),
}));

vi.mock('../../utils/inkFineTune/pencilScratchSound', () => ({
  playPencilScratchSound: () => mockPlaySound(),
}));

vi.mock('../../utils/inkEditUtils', () => ({
  prepareBodyHtmlForPreview: (html: string) => mockPrepareBodyHtml(html),
  prepareTitleMarkupHtml: (html: string | undefined) => html ?? '',
}));

vi.mock('../../utils/inkFineTune/inkEditHistory', () => ({
  inkEditSnapshotsEqual: () => false,
  INK_EDIT_UNDO_LIMIT: 32,
}));

// ---------------------------------------------------------------------------
// Dynamic import (after mocks)
// ---------------------------------------------------------------------------

async function setupHook() {
  const { useInkEditSession } = await import('../../hooks/useInkEditSession');

  const bodyHtmlRef = { current: '<div data-ink-g="0">original</div>' };
  const titleRef = { current: 'Test Title' };
  const artistRef = { current: 'Test Artist' };
  const titleMarkupHtmlRef = { current: undefined as string | undefined };
  const setBodyHtml = vi.fn((html: string) => {
    bodyHtmlRef.current = html;
  });
  const setTitle = vi.fn((t: string) => {
    titleRef.current = t;
  });
  const setArtist = vi.fn((a: string) => {
    artistRef.current = a;
  });
  const setTitleMarkupHtml = vi.fn();

  const { result, rerender } = renderHook(() =>
    useInkEditSession({
      bodyHtml: bodyHtmlRef.current,
      savedProjectId: 'test-project',
      bodyHtmlRef,
      titleRef,
      artistRef,
      titleMarkupHtmlRef,
      setBodyHtml,
      setTitle,
      setArtist,
      setTitleMarkupHtml,
    }),
  );

  return { result, rerender, bodyHtmlRef, setBodyHtml };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useInkEditSession - kind:jp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handleInkOpenTarget with kind:jp sets inkDraftJp', async () => {
    const { result } = await setupHook();

    const target: InkEditTarget = {
      kind: 'jp',
      groupIndex: 0,
      text: 'この歌詞',
      anchorRect: DOMRect.fromRect({ x: 0, y: 0, width: 10, height: 10 }),
    };

    act(() => {
      result.current.handleInkOpenTarget(target);
    });

    expect(result.current.inkDraftJp).toBe('この歌詞');
    expect(result.current.inkEditTarget?.kind).toBe('jp');
    expect(result.current.inkFocusGroupIndex).toBe(0);
  });

  it('handleInkConfirm with kind:jp calls applyJpLineEdit and prepareBodyHtmlForPreview', async () => {
    const { result, setBodyHtml } = await setupHook();

    // 先打开 jp 编辑
    act(() => {
      result.current.handleInkOpenTarget({
        kind: 'jp',
        groupIndex: 0,
        text: '古い歌詞',
        anchorRect: DOMRect.fromRect({ x: 0, y: 0, width: 10, height: 10 }),
      });
    });

    // 修改 draft
    act(() => {
      result.current.setInkDraftJp('新しい歌詞');
    });

    // 确认
    act(() => {
      result.current.handleInkConfirm();
    });

    // 验证调用了 applyJpLineEdit
    expect(mockApplyJpLineEdit).toHaveBeenCalledWith(
      '<div data-ink-g="0">original</div>',
      0,
      '新しい歌詞',
    );

    // 验证调用了 prepareBodyHtmlForPreview
    expect(mockPrepareBodyHtml).toHaveBeenCalled();

    // 验证 setBodyHtml 被调用
    expect(setBodyHtml).toHaveBeenCalled();

    // 验证保存草稿
    expect(mockSaveDraft).toHaveBeenCalled();

    // 验证播放声音
    expect(mockPlaySound).toHaveBeenCalled();
  });

  it('handleInkConfirm with kind:jp clears popover after confirming', async () => {
    const { result } = await setupHook();

    act(() => {
      result.current.handleInkOpenTarget({
        kind: 'jp',
        groupIndex: 0,
        text: '歌詞',
        anchorRect: DOMRect.fromRect({ x: 0, y: 0, width: 10, height: 10 }),
      });
    });
    expect(result.current.inkEditTarget).not.toBeNull();

    act(() => {
      result.current.handleInkConfirm();
    });

    // 关闭后有 popoverClosing 过渡，等 timeout 后 inkEditTarget 才变为 null
    // 立即验证 inkPopoverClosing 已设为 true
    expect(result.current.inkPopoverClosing).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleInkRemoveRuby
// ---------------------------------------------------------------------------

describe('useInkEditSession - handleInkRemoveRuby', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handleInkRemoveRuby calls applyRemoveRuby and prepareBodyHtmlForPreview', async () => {
    const { result, setBodyHtml } = await setupHook();

    // 先打开 ruby 编辑
    act(() => {
      result.current.handleInkOpenTarget({
        kind: 'ruby',
        groupIndex: 0,
        rubyIndex: 0,
        kanji: '漢字',
        kana: 'かんじ',
        readingScript: 'kana',
        anchorRect: DOMRect.fromRect({ x: 0, y: 0, width: 10, height: 10 }),
      });
    });

    // 点击「不注音」
    act(() => {
      result.current.handleInkRemoveRuby();
    });

    expect(mockApplyRemoveRuby).toHaveBeenCalledWith(
      '<div data-ink-g="0">original</div>',
      0,
      0,
    );

    expect(mockPrepareBodyHtml).toHaveBeenCalled();
    expect(setBodyHtml).toHaveBeenCalled();
    expect(mockSaveDraft).toHaveBeenCalled();
    expect(mockPlaySound).toHaveBeenCalled();
  });

  it('handleInkRemoveRuby does nothing when editTarget is not kind:ruby', async () => {
    const { result } = await setupHook();

    // 打开 jp 编辑
    act(() => {
      result.current.handleInkOpenTarget({
        kind: 'jp',
        groupIndex: 0,
        text: '歌詞',
        anchorRect: DOMRect.fromRect({ x: 0, y: 0, width: 10, height: 10 }),
      });
    });

    const callCountBefore = mockApplyRemoveRuby.mock.calls.length;

    // 尝试调用 handleInkRemoveRuby（kind != 'ruby' → no-op）
    act(() => {
      result.current.handleInkRemoveRuby();
    });

    expect(mockApplyRemoveRuby.mock.calls.length).toBe(callCountBefore);
    expect(mockSaveDraft).not.toHaveBeenCalled();
  });

  it('handleInkRemoveRuby does nothing when editTarget is null', async () => {
    const { result } = await setupHook();

    act(() => {
      result.current.handleInkRemoveRuby();
    });

    expect(mockApplyRemoveRuby).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Existing behaviors preserved
// ---------------------------------------------------------------------------

describe('useInkEditSession - existing behaviors preserved', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handleInkOpenTarget with kind:ruby still sets kanji/kana', async () => {
    const { result } = await setupHook();

    act(() => {
      result.current.handleInkOpenTarget({
        kind: 'ruby',
        groupIndex: 0,
        rubyIndex: 0,
        kanji: '漢',
        kana: 'かん',
        readingScript: 'kana',
        anchorRect: DOMRect.fromRect({ x: 0, y: 0, width: 10, height: 10 }),
      });
    });

    expect(result.current.inkDraftKanji).toBe('漢');
    expect(result.current.inkDraftKana).toBe('かん');
  });

  it('handleInkOpenTarget with kind:zh still sets draftZh', async () => {
    const { result } = await setupHook();

    act(() => {
      result.current.handleInkOpenTarget({
        kind: 'zh',
        groupIndex: 0,
        text: '测试译文',
        anchorRect: DOMRect.fromRect({ x: 0, y: 0, width: 10, height: 10 }),
      });
    });

    expect(result.current.inkDraftZh).toBe('测试译文');
  });
});
