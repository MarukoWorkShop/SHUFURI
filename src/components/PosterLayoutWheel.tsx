import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';
import { hapticButton } from '../hooks/useHaptics';
import { isInteractionSoundEnabled } from '../services/appSettings';
import { playKataClickSound } from '../utils/kataClickSound';
import type { PosterLayoutProfile } from '../utils/shufuriPoster/types';
import './PosterLayoutWheel.css';

const ITEM_W = 104;

type LayoutOption = {
  profile: PosterLayoutProfile;
  caption: string;
  ariaLabel: string;
  icon: ReactNode;
};

const LAYOUTS: readonly LayoutOption[] = [
  {
    profile: 'clipPosterPrint',
    caption: '(A5、A6、B5、B6)',
    ariaLabel: 'B5 打印 (A5、A6、B5、B6)',
    icon: (
      <span className="layout-icon-paper" aria-hidden="true">
        <span className="layout-icon-paper__lines">
          <span className="layout-icon-paper__line" />
          <span className="layout-icon-paper__line" />
          <span className="layout-icon-paper__line" />
        </span>
      </span>
    ),
  },
  {
    profile: 'squarePoster',
    caption: '1:1 方形',
    ariaLabel: '1:1 方形',
    icon: (
      <span className="layout-icon-square" aria-hidden="true">
        <span className="layout-icon-square__lines">
          <span className="layout-icon-square__line" />
          <span className="layout-icon-square__line" />
          <span className="layout-icon-square__line" />
        </span>
      </span>
    ),
  },
  {
    profile: 'mobilePoster',
    caption: '手机预览/A6P',
    ariaLabel: '手机预览 / A6P',
    icon: (
      <span className="layout-icon-phone" aria-hidden="true">
        <span className="layout-icon-phone__lines">
          <span className="layout-icon-phone__line" />
          <span className="layout-icon-phone__line" />
          <span className="layout-icon-phone__line" />
        </span>
      </span>
    ),
  },
];

function layoutIndex(profile: PosterLayoutProfile): number {
  const i = LAYOUTS.findIndex((item) => item.profile === profile);
  return i >= 0 ? i : 0;
}

function triggerWheelSnapFeedback(soundEnabled: boolean): void {
  if (!soundEnabled) return;
  hapticButton();
  playKataClickSound();
}

type Props = {
  value: PosterLayoutProfile;
  onChange: (profile: PosterLayoutProfile) => void;
  soundEnabled?: boolean;
};

/**
 * 导出页纸张规格拨轮：横向吸附滚动，居中项显示纸型图标与说明小字；选项无缩放形变。
 */
export default function PosterLayoutWheel({ value, onChange, soundEnabled }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const indexRef = useRef(layoutIndex(value));
  const rafRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const feedbackEnabled = soundEnabled ?? isInteractionSoundEnabled();

  const applyItemVisuals = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const centerX = scroller.scrollLeft + scroller.clientWidth / 2;
    let nearestIdx = 0;
    let nearestDist = Infinity;

    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const itemCenter = el.offsetLeft + ITEM_W / 2;
      const distPx = Math.abs(centerX - itemCenter);
      if (distPx < nearestDist) {
        nearestDist = distPx;
        nearestIdx = i;
      }
    });

    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const itemCenter = el.offsetLeft + ITEM_W / 2;
      const dist = Math.min(1.2, Math.abs(centerX - itemCenter) / ITEM_W);
      const opacity = Math.max(0.38, 1 - dist * 0.48);
      el.classList.toggle('is-centered', i === nearestIdx);
      el.style.opacity = String(opacity);
      el.style.transform = 'none';
      el.style.filter = 'none';
    });
  }, []);

  const scrollToIndex = useCallback((index: number, smooth: boolean) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const clamped = Math.max(0, Math.min(LAYOUTS.length - 1, index));
    scroller.scrollTo({
      left: clamped * ITEM_W,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  const commitIndex = useCallback(
    (index: number, fromUser: boolean) => {
      const clamped = Math.max(0, Math.min(LAYOUTS.length - 1, index));
      if (clamped === indexRef.current) {
        applyItemVisuals();
        return;
      }
      indexRef.current = clamped;
      onChange(LAYOUTS[clamped]!.profile);
      if (fromUser) {
        triggerWheelSnapFeedback(feedbackEnabled);
      }
      applyItemVisuals();
    },
    [applyItemVisuals, feedbackEnabled, onChange],
  );

  const settleScroll = useCallback(
    (fromUser: boolean) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const index = Math.round(scroller.scrollLeft / ITEM_W);
      const targetLeft = index * ITEM_W;
      if (Math.abs(scroller.scrollLeft - targetLeft) > 0.5) {
        scroller.scrollTo({ left: targetLeft, behavior: 'smooth' });
      }
      commitIndex(index, fromUser);
    },
    [commitIndex],
  );

  const onScroll = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      applyItemVisuals();
    });

    if (settleTimerRef.current != null) {
      window.clearTimeout(settleTimerRef.current);
    }
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      settleScroll(true);
    }, 120);
  }, [applyItemVisuals, settleScroll]);

  useLayoutEffect(() => {
    const nextIndex = layoutIndex(value);
    indexRef.current = nextIndex;
    scrollToIndex(nextIndex, false);
    applyItemVisuals();
  }, [value, scrollToIndex, applyItemVisuals]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const onScrollEnd = () => settleScroll(true);
    scroller.addEventListener('scroll', onScroll, { passive: true });
    scroller.addEventListener('scrollend', onScrollEnd);

    return () => {
      scroller.removeEventListener('scroll', onScroll);
      scroller.removeEventListener('scrollend', onScrollEnd);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (settleTimerRef.current != null) window.clearTimeout(settleTimerRef.current);
    };
  }, [onScroll, settleScroll]);

  return (
    <div className="paper-wheel">
      <div className="paper-wheel__frame">
        <div
          ref={scrollerRef}
          className="paper-wheel__scroller"
          tabIndex={0}
          role="listbox"
          aria-label="导出纸张规格"
        >
          <div className="paper-wheel__list">
            {LAYOUTS.map((item, i) => (
              <button
                key={item.profile}
                type="button"
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                className="paper-wheel__item"
                role="option"
                aria-label={item.ariaLabel}
                aria-selected={item.profile === value}
                onClick={() => scrollToIndex(i, true)}
              >
                <span className="paper-wheel__icon">{item.icon}</span>
                <span className="paper-wheel__foot">
                  <span className="paper-wheel__line" aria-hidden="true" />
                  <span className="paper-wheel__caption">{item.caption}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="paper-wheel__mask" aria-hidden />
      </div>
    </div>
  );
}
