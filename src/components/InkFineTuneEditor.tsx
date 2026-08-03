import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import InkFineTunePopover, { type InkEditTarget } from './InkFineTunePopover';
import { readPosterTitleFromElement } from '../utils/shufuriPoster/posterTitle';

const DOUBLE_TAP_MS = 320;

export function resolveEditTarget(el: Element): InkEditTarget | null {
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

  const koLine = el.closest('.ko-line');
  if (koLine) {
    const group = koLine.closest('[data-ink-g]');
    const groupIndex = group?.getAttribute('data-ink-g');
    if (groupIndex == null) return null;
    return {
      kind: 'ko',
      groupIndex: Number(groupIndex),
      text: koLine.textContent?.trim() ?? '',
      anchorRect: koLine.getBoundingClientRect(),
    };
  }

  const jpLine = el.closest('.jp-line');
  if (jpLine) {
    const group = jpLine.closest('[data-ink-g]');
    const groupIndex = group?.getAttribute('data-ink-g');
    if (groupIndex == null) return null;
    return {
      kind: 'jp',
      groupIndex: Number(groupIndex),
      text: jpLine.textContent?.trim() ?? '',
      anchorRect: jpLine.getBoundingClientRect(),
    };
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
  draftKo: string;
  draftTitle: string;
  draftArtist: string;
  draftJp: string;
  interaction: 'click' | 'doubleTap';
  /** 为 false 时不挂载点选编辑（浏览/滑动模式，需先展开右侧文具盒） */
  interactionEnabled?: boolean;
  onOpenTarget: (target: InkEditTarget) => void;
  onClose: () => void;
  onKanjiChange: (v: string) => void;
  onKanaChange: (v: string) => void;
  onZhChange: (v: string) => void;
  onKoChange: (v: string) => void;
  onTitleChange: (v: string) => void;
  onArtistChange: (v: string) => void;
  onJpChange: (v: string) => void;
  onConfirm: () => void;
  onRemoveRuby?: () => void;
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
  draftKo,
  draftTitle,
  draftArtist,
  draftJp,
  interaction,
  interactionEnabled = true,
  onOpenTarget,
  onClose,
  onKanjiChange,
  onKanaChange,
  onZhChange,
  onKoChange,
  onTitleChange,
  onArtistChange,
  onJpChange,
  onConfirm,
  onRemoveRuby,
  children,
}: Props) {
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const handlePointerTarget = useCallback(
    (el: Element | null): InkEditTarget | null => {
      if (!el) return null;
      const target = resolveEditTarget(el);
      if (target) onOpenTarget(target);
      return target;
    },
    [onOpenTarget],
  );

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !interactionEnabled) return;

    const onClick = (e: MouseEvent) => {
      const target = handlePointerTarget(e.target as Element);
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
    };

    const onDblClick = (e: MouseEvent) => {
      const target = handlePointerTarget(e.target as Element);
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
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
        lastTapRef.current = null;
        const target = handlePointerTarget(el);
        if (target) e.preventDefault();
      } else {
        lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
        if (interaction === 'click') {
          const target = handlePointerTarget(el);
          if (target) e.preventDefault();
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
  }, [containerRef, handlePointerTarget, interaction, interactionEnabled]);

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
          koText={draftKo}
          titleText={draftTitle}
          artistText={draftArtist}
          jpText={draftJp}
          onKanjiChange={onKanjiChange}
          onKanaChange={onKanaChange}
          onZhChange={onZhChange}
          onKoChange={onKoChange}
          onTitleChange={onTitleChange}
          onArtistChange={onArtistChange}
          onJpChange={onJpChange}
          onConfirm={onConfirm}
          onCancel={onClose}
          onRemoveRuby={onRemoveRuby}
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
