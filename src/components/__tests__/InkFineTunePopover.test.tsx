import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InkFineTunePopover, { type InkEditTarget } from '../InkFineTunePopover';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stubAnchor(): DOMRect {
  return DOMRect.fromRect({ x: 100, y: 100, width: 50, height: 20 });
}

const noop = () => {};
const stringNoop = (_v: string) => {};

// ---------------------------------------------------------------------------
// kind:'jp' rendering
// ---------------------------------------------------------------------------

describe('InkFineTunePopover - kind:jp', () => {
  const jpTarget: InkEditTarget = {
    kind: 'jp',
    groupIndex: 0,
    text: 'この歌詞を修正する',
    anchorRect: stubAnchor(),
  };

  it('renders 日文歌词 label and input', () => {
    render(
      <InkFineTunePopover
        target={jpTarget}
        kanji=""
        kana=""
        zhText=""
        titleText=""
        artistText=""
        jpText="この歌詞を修正する"
        onKanjiChange={stringNoop}
        onKanaChange={stringNoop}
        onZhChange={stringNoop}
        onTitleChange={stringNoop}
        onArtistChange={stringNoop}
        onJpChange={stringNoop}
        onConfirm={noop}
        onCancel={noop}
      />,
    );

    expect(screen.getByText('日文歌词')).toBeDefined();
    const input = screen.getByDisplayValue('この歌詞を修正する') as HTMLInputElement;
    expect(input.tagName).toBe('INPUT');
  });

  it('calls onJpChange when user types in jp input', () => {
    const onJpChange = vi.fn();
    render(
      <InkFineTunePopover
        target={jpTarget}
        kanji=""
        kana=""
        zhText=""
        titleText=""
        artistText=""
        jpText=""
        onKanjiChange={stringNoop}
        onKanaChange={stringNoop}
        onZhChange={stringNoop}
        onTitleChange={stringNoop}
        onArtistChange={stringNoop}
        onJpChange={onJpChange}
        onConfirm={noop}
        onCancel={noop}
      />,
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '新歌詞' } });
    expect(onJpChange).toHaveBeenCalledWith('新歌詞');
  });

  it('calls onConfirm when 修改 button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <InkFineTunePopover
        target={jpTarget}
        kanji=""
        kana=""
        zhText=""
        titleText=""
        artistText=""
        jpText=""
        onKanjiChange={stringNoop}
        onKanaChange={stringNoop}
        onZhChange={stringNoop}
        onTitleChange={stringNoop}
        onArtistChange={stringNoop}
        onJpChange={stringNoop}
        onConfirm={onConfirm}
        onCancel={noop}
      />,
    );

    fireEvent.click(screen.getByText('修改'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when 取消 button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <InkFineTunePopover
        target={jpTarget}
        kanji=""
        kana=""
        zhText=""
        titleText=""
        artistText=""
        jpText=""
        onKanjiChange={stringNoop}
        onKanaChange={stringNoop}
        onZhChange={stringNoop}
        onTitleChange={stringNoop}
        onArtistChange={stringNoop}
        onJpChange={stringNoop}
        onConfirm={noop}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByText('取消'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does NOT show 不注音 button for kind:jp', () => {
    render(
      <InkFineTunePopover
        target={jpTarget}
        kanji=""
        kana=""
        zhText=""
        titleText=""
        artistText=""
        jpText=""
        onKanjiChange={stringNoop}
        onKanaChange={stringNoop}
        onZhChange={stringNoop}
        onTitleChange={stringNoop}
        onArtistChange={stringNoop}
        onJpChange={stringNoop}
        onConfirm={noop}
        onCancel={noop}
      />,
    );

    expect(screen.queryByText('不注音')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// kind:'ruby' — 不注音 button
// ---------------------------------------------------------------------------

describe('InkFineTunePopover - kind:ruby 不注音 button', () => {
  const rubyTarget: InkEditTarget = {
    kind: 'ruby',
    groupIndex: 0,
    rubyIndex: 0,
    kanji: '漢字',
    kana: 'かんじ',
    anchorRect: stubAnchor(),
  };

  it('renders 不注音 button when onRemoveRuby is provided', () => {
    render(
      <InkFineTunePopover
        target={rubyTarget}
        kanji="漢字"
        kana="かんじ"
        zhText=""
        titleText=""
        artistText=""
        jpText=""
        onKanjiChange={stringNoop}
        onKanaChange={stringNoop}
        onZhChange={stringNoop}
        onTitleChange={stringNoop}
        onArtistChange={stringNoop}
        onJpChange={stringNoop}
        onConfirm={noop}
        onCancel={noop}
        onRemoveRuby={noop}
      />,
    );

    expect(screen.getByText('不注音')).toBeDefined();
  });

  it('does NOT render 不注音 button when onRemoveRuby is undefined', () => {
    render(
      <InkFineTunePopover
        target={rubyTarget}
        kanji="漢字"
        kana="かんじ"
        zhText=""
        titleText=""
        artistText=""
        jpText=""
        onKanjiChange={stringNoop}
        onKanaChange={stringNoop}
        onZhChange={stringNoop}
        onTitleChange={stringNoop}
        onArtistChange={stringNoop}
        onJpChange={stringNoop}
        onConfirm={noop}
        onCancel={noop}
      />,
    );

    expect(screen.queryByText('不注音')).toBeNull();
  });

  it('calls onRemoveRuby when 不注音 is clicked', () => {
    const onRemoveRuby = vi.fn();
    render(
      <InkFineTunePopover
        target={rubyTarget}
        kanji="漢字"
        kana="かんじ"
        zhText=""
        titleText=""
        artistText=""
        jpText=""
        onKanjiChange={stringNoop}
        onKanaChange={stringNoop}
        onZhChange={stringNoop}
        onTitleChange={stringNoop}
        onArtistChange={stringNoop}
        onJpChange={stringNoop}
        onConfirm={noop}
        onCancel={noop}
        onRemoveRuby={onRemoveRuby}
      />,
    );

    fireEvent.click(screen.getByText('不注音'));
    expect(onRemoveRuby).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Generic rendering for all kinds
// ---------------------------------------------------------------------------

describe('InkFineTunePopover - all kinds', () => {
  it('renders 假名/汉字 inputs for kind:ruby', () => {
    render(
      <InkFineTunePopover
        target={{ kind: 'ruby', groupIndex: 0, rubyIndex: 0, kanji: '花', kana: 'はな', anchorRect: stubAnchor() }}
        kanji="花" kana="はな" zhText="" titleText="" artistText="" jpText=""
        onKanjiChange={stringNoop} onKanaChange={stringNoop} onZhChange={stringNoop}
        onTitleChange={stringNoop} onArtistChange={stringNoop} onJpChange={stringNoop}
        onConfirm={noop} onCancel={noop}
      />,
    );

    expect(screen.getByText('假名')).toBeDefined();
    expect(screen.getByText('汉字')).toBeDefined();
  });

  it('renders 译文 input for kind:zh', () => {
    render(
      <InkFineTunePopover
        target={{ kind: 'zh', groupIndex: 0, text: '测试', anchorRect: stubAnchor() }}
        kanji="" kana="" zhText="测试" titleText="" artistText="" jpText=""
        onKanjiChange={stringNoop} onKanaChange={stringNoop} onZhChange={stringNoop}
        onTitleChange={stringNoop} onArtistChange={stringNoop} onJpChange={stringNoop}
        onConfirm={noop} onCancel={noop}
      />,
    );

    expect(screen.getByText('译文')).toBeDefined();
    expect(screen.getByDisplayValue('测试')).toBeDefined();
  });
});
