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
      kind: 'ruby';
      groupIndex: number;
      rubyIndex: number;
      kanji: string;
      kana: string;
      anchorRect: DOMRect;
    };

type Props = {
  target: InkEditTarget;
  kanji: string;
  kana: string;
  zhText: string;
  titleText: string;
  artistText: string;
  onKanjiChange: (v: string) => void;
  onKanaChange: (v: string) => void;
  onZhChange: (v: string) => void;
  onTitleChange: (v: string) => void;
  onArtistChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  closing?: boolean;
};

export default function InkFineTunePopover({
  target,
  kanji,
  kana,
  zhText,
  titleText,
  artistText,
  onKanjiChange,
  onKanaChange,
  onZhChange,
  onTitleChange,
  onArtistChange,
  onConfirm,
  onCancel,
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
              autoFocus
            />
          </label>
          <label className="ink-fine-tune-popover__field">
            <span className="ink-fine-tune-popover__label">汉字</span>
            <input
              className="ink-fine-tune-popover__input"
              value={kanji}
              onChange={(e) => onKanjiChange(e.target.value)}
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
              autoFocus
            />
          </label>
          <label className="ink-fine-tune-popover__field ink-fine-tune-popover__field--wide">
            <span className="ink-fine-tune-popover__label">歌手</span>
            <input
              className="ink-fine-tune-popover__input"
              value={artistText}
              onChange={(e) => onArtistChange(e.target.value)}
            />
          </label>
        </>
      ) : (
        <label className="ink-fine-tune-popover__field ink-fine-tune-popover__field--wide">
          <span className="ink-fine-tune-popover__label">译文</span>
          <input
            className="ink-fine-tune-popover__input"
            value={zhText}
            onChange={(e) => onZhChange(e.target.value)}
            autoFocus
          />
        </label>
      )}
      <div className="ink-fine-tune-popover__actions">
        <button type="button" className="ink-fine-tune-popover__link" onClick={onConfirm}>
          修改
        </button>
        <button type="button" className="ink-fine-tune-popover__link" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}
