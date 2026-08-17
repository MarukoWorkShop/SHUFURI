import { useEffect, useRef } from 'react';

export type InkEditTarget =
  | {
      kind: 'title';
      title: string;
      artist: string;
      anchorRect: DOMRect;
    }
  | {
      kind: 'zh';
      groupIndex: number;
      text: string;
      anchorRect: DOMRect;
    }
  | {
      kind: 'ko';
      groupIndex: number;
      text: string;
      anchorRect: DOMRect;
    }
  | {
      kind: 'ruby';
      groupIndex: number;
      rubyIndex: number;
      kanji: string;
      kana: string;
      anchorRect: DOMRect;
    }
  | {
      kind: 'jp';
      groupIndex: number;
      text: string;
      anchorRect: DOMRect;
    };

type Props = {
  target: InkEditTarget;
  kanji: string;
  kana: string;
  zhText: string;
  koText: string;
  titleText: string;
  artistText: string;
  jpText: string;
  onKanjiChange: (v: string) => void;
  onKanaChange: (v: string) => void;
  onZhChange: (v: string) => void;
  onKoChange: (v: string) => void;
  onTitleChange: (v: string) => void;
  onArtistChange: (v: string) => void;
  onJpChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onRemoveRuby?: () => void;
  closing?: boolean;
};

export default function InkFineTunePopover({
  target,
  kanji,
  kana,
  zhText,
  koText,
  titleText,
  artistText,
  jpText,
  onKanjiChange,
  onKanaChange,
  onZhChange,
  onKoChange,
  onTitleChange,
  onArtistChange,
  onJpChange,
  onConfirm,
  onCancel,
  onRemoveRuby,
  closing = false,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const cardW = 280;
  const margin = 12;
  let top = target.anchorRect.bottom + margin;
  let left = target.anchorRect.left + target.anchorRect.width / 2 - cardW / 2;

  if (top + 160 > window.innerHeight) {
    top = target.anchorRect.top - margin - 120;
  }
  left = Math.max(margin, Math.min(left, window.innerWidth - cardW - margin));
  top = Math.max(margin, top);

  return (
    <div
      className={`ink-fine-tune-popover${closing ? ' ink-fine-tune-popover--closing' : ''}`}
      style={{ top, left, width: cardW }}
      ref={cardRef}
      role="dialog"
      aria-label="修字气泡"
      onClick={(e) => e.stopPropagation()}
    >
      {target.kind === 'ruby' ? (
        <>
          <label className="ink-fine-tune-popover__field">
            <span className="ink-fine-tune-popover__label">假名</span>
            <input
              className="ink-fine-tune-popover__input"
              value={kana}
              onChange={(e) => onKanaChange(e.target.value)}
              style={{
                fontFamily:
                  '"Kozuka Mincho Pro R", "KozMinPro", "Noto Sans CJK SC", "PingFang SC", "Hiragino Mincho ProN", serif',
                color: 'var(--ui-fg, #1a1a1a)',
              }}
              autoFocus
            />
          </label>
          <label className="ink-fine-tune-popover__field">
            <span className="ink-fine-tune-popover__label">汉字</span>
            <input
              className="ink-fine-tune-popover__input"
              value={kanji}
              onChange={(e) => onKanjiChange(e.target.value)}
              style={{
                fontFamily:
                  '"Kozuka Mincho Pro R", "KozMinPro", "Noto Sans CJK SC", "PingFang SC", "Hiragino Mincho ProN", serif',
                color: 'var(--ui-fg, #1a1a1a)',
              }}
            />
          </label>
        </>
      ) : target.kind === 'title' ? (
        <>
          <label className="ink-fine-tune-popover__field ink-fine-tune-popover__field--wide">
            <span className="ink-fine-tune-popover__label">歌名</span>
            <input
              className="ink-fine-tune-popover__input"
              value={titleText}
              onChange={(e) => onTitleChange(e.target.value)}
              style={{
                fontFamily:
                  '"Kozuka Mincho Pro R", "KozMinPro", "Noto Sans CJK SC", "PingFang SC", "Hiragino Mincho ProN", serif',
                color: 'var(--ui-fg, #1a1a1a)',
              }}
              autoFocus
            />
          </label>
          <label className="ink-fine-tune-popover__field ink-fine-tune-popover__field--wide">
            <span className="ink-fine-tune-popover__label">歌手</span>
            <input
              className="ink-fine-tune-popover__input"
              value={artistText}
              onChange={(e) => onArtistChange(e.target.value)}
              style={{
                fontFamily:
                  '"Kozuka Mincho Pro R", "KozMinPro", "Noto Sans CJK SC", "PingFang SC", "Hiragino Mincho ProN", serif',
                color: 'var(--ui-fg, #1a1a1a)',
              }}
            />
          </label>
        </>
      ) : target.kind === 'jp' ? (
        <label className="ink-fine-tune-popover__field ink-fine-tune-popover__field--wide">
          <span className="ink-fine-tune-popover__label">日文歌词</span>
          <input
            className="ink-fine-tune-popover__input"
            value={jpText}
            onChange={(e) => onJpChange(e.target.value)}
            autoFocus
          />
        </label>
      ) : target.kind === 'ko' ? (
        <label className="ink-fine-tune-popover__field ink-fine-tune-popover__field--wide">
          <span className="ink-fine-tune-popover__label">韩文</span>
          <input
            className="ink-fine-tune-popover__input"
            value={koText}
            onChange={(e) => onKoChange(e.target.value)}
            placeholder={koText ? undefined : '韩文歌词'}
            style={{
              fontFamily:
                '"AppleMyungjo", "Apple Myungjo", "Nanum Myeongjo", "Batang", "Gungsuh", "Noto Serif KR", "Apple SD Gothic Neo", serif',
              color: 'var(--ui-fg, #1a1a1a)',
            }}
            autoFocus
          />
        </label>
      ) : (
        <label className="ink-fine-tune-popover__field ink-fine-tune-popover__field--wide">
          <span className="ink-fine-tune-popover__label">译文</span>
          <input
            className="ink-fine-tune-popover__input"
            value={zhText}
            onChange={(e) => onZhChange(e.target.value)}
            placeholder={zhText ? undefined : '中文翻译'}
            style={{
              fontFamily:
                '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
              color: 'var(--ui-fg, #1a1a1a)',
            }}
            autoFocus
          />
        </label>
      )}
      <div className="ink-fine-tune-popover__actions">
        <button type="button" className="ink-fine-tune-popover__link" onClick={onConfirm}>
          修改
        </button>
        {target.kind === 'ruby' && onRemoveRuby && (
          <button type="button" className="ink-fine-tune-popover__link" onClick={onRemoveRuby}>
            不注音
          </button>
        )}
        <button type="button" className="ink-fine-tune-popover__link" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}
