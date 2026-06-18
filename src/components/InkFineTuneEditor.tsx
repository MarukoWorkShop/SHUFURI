import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import InkFineTunePopover, { type InkEditTarget } from './InkFineTunePopover';
import { readPosterTitleFromElement } from '../utils/shufuriPoster/posterTitle';

const DOUBLE_TAP_MS = 320;

function resolveEditTarget(el: Element): InkEditTarget | null {
  const titleEl = el.closest('h1.fv-title-h[data-ink-title], h1.fv-title-h');
  if (titleEl) {
    const { title, artist } = readPosterTitleFromElement(titleEl as HTMLElement);
    return {
      kind: 'title',
      title,
      artist,
      anchorRect: titleEl.getBoundingClientRect(),
    };
  }

  const ruby = el.closest('ruby[data-ink-r]');
  if (ruby) {
    const group = ruby.closest('[data-ink-g]');
    const groupIndex = group?.getAttribute('data-ink-g');
    const rubyIndex = ruby.getAttribute('data-ink-r');
    if (groupIndex == null || rubyIndex == null) return null;
    const rt = ruby.querySelector('rt');
    const kanji = Array.from(ruby.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE || (n.nodeName !== 'RT' && n.nodeName !== 'RP'))
      .map((n) => n.textContent ?? '')
      .join('')
      .trim();
    return {
      kind: 'ruby',
      groupIndex: Number(groupIndex),
      rubyIndex: Number(rubyIndex),
      kanji,
      kana: rt?.textContent?.trim() ?? '',
      anchorRect: ruby.getBoundingClientRect(),
    };
  }

  const zhLine = el.closest('.zh-line, .gloss-line');
  if (zhLine) {
    const group = zhLine.closest('[data-ink-g]');
    const groupIndex = group?.getAttribute('data-ink-g');
    if (groupIndex == null) return null;
    return {
      kind: 'zh',
      groupIndex: Number(groupIndex),
      text: zhLine.textContent?.trim() ?? '',
      anchorRect: zhLine.getBoundingClientRect(),
    };
  }

  const jpLine = el.closest('.jp-line');
  if (jpLine) {
    const innerRuby = jpLine.querySelector('ruby[data-ink-r]');
    if (innerRuby) return resolveEditTarget(innerRuby);
  }

  return null;
}

type Props = {
  containerRef: RefObject<HTMLElement | null>;
  focusGroupIndex: number | null;
  editTarget: InkEditTarget | null;
  popoverClosing: boolean;
  draftKanji: string;
  draftKana: string;
  draftZh: string;
  draftTitle: string;
  draftArtist: string;
  interaction: 'click' | 'doubleTap';
  onOpenTarget: (target: InkEditTarget) => void;
  onClose: () => void;
  onKanjiChange: (v: string) => void;
  onKanaChange: (v: string) => void;
  onZhChange: (v: string) => void;
  onTitleChange: (v: string) => void;
  onArtistChange: (v: string) => void;
  onConfirm: () => void;
  children: ReactNode;
};

export default function InkFineTuneEditor({
  containerRef,
  focusGroupIndex,
  editTarget,
  popoverClosing,
  draftKanji,
  draftKana,
  draftZh,
  draftTitle,
  draftArtist,
  interaction,
  onOpenTarget,
  onClose,
  onKanjiChange,
  onKanaChange,
  onZhChange,
  onTitleChange,
  onArtistChange,
  onConfirm,
  children,
}: Props) {
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const handlePointerTarget = useCallback(
    (el: Element | null) => {
      if (!el) return;
      const target = resolveEditTarget(el);
      if (target) onOpenTarget(target);
    },
    [onOpenTarget],
  );

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handlePointerTarget(e.target as Element);
    };

    const onDblClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handlePointerTarget(e.target as Element);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length !== 1) return;
      const touch = e.changedTouches[0]!;
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const now = Date.now();
      const last = lastTapRef.current;
      if (
        last &&
        now - last.time < DOUBLE_TAP_MS &&
        Math.abs(touch.clientX - last.x) < 24 &&
        Math.abs(touch.clientY - last.y) < 24
      ) {
        e.preventDefault();
        lastTapRef.current = null;
        handlePointerTarget(el);
      } else {
        lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
        if (interaction === 'click') {
          e.preventDefault();
          handlePointerTarget(el);
        }
      }
    };

    if (interaction === 'click') {
      root.addEventListener('click', onClick);
    } else {
      root.addEventListener('dblclick', onDblClick);
      root.addEventListener('touchend', onTouchEnd, { passive: false });
    }

    return () => {
      root.removeEventListener('click', onClick);
      root.removeEventListener('dblclick', onDblClick);
      root.removeEventListener('touchend', onTouchEnd);
    };
  }, [containerRef, handlePointerTarget, interaction]);

  useEffect(() => {
    if (focusGroupIndex == null) return;
    const root = containerRef.current;
    if (!root) return;

    root.querySelectorAll('[data-ink-g]').forEach((node) => {
      const gi = node.getAttribute('data-ink-g');
      node.classList.toggle('ink-focus-line', gi === String(focusGroupIndex));
    });
  }, [containerRef, focusGroupIndex, editTarget]);

  const useFocusDim = focusGroupIndex != null;

  const popoverPortal =
    editTarget &&
    createPortal(
      <>
        <div className="ink-fine-tune-backdrop" onClick={onClose} aria-hidden />
        <InkFineTunePopover
          target={editTarget}
          kanji={draftKanji}
          kana={draftKana}
          zhText={draftZh}
          titleText={draftTitle}
          artistText={draftArtist}
          onKanjiChange={onKanjiChange}
          onKanaChange={onKanaChange}
          onZhChange={onZhChange}
          onTitleChange={onTitleChange}
          onArtistChange={onArtistChange}
          onConfirm={onConfirm}
          onCancel={onClose}
          closing={popoverClosing}
        />
      </>,
      document.body,
    );

  return (
    <div
      ref={rootRef}
      className={['ink-fine-tune-root', useFocusDim ? 'ink-fine-tune-root--focus' : ''].filter(Boolean).join(' ')}
      data-ink-focus-g={focusGroupIndex ?? undefined}
    >
      {children}
      {popoverPortal}
    </div>
  );
}
