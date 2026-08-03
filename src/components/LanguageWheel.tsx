import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { hapticButton } from '../hooks/useHaptics';
import { isInteractionSoundEnabled, type LyricsLanguage } from '../services/appSettings';
import { playLogitechClickSoundEffect } from '../utils/logitechClickSound';
import { L } from '../utils/i18n';
import './LanguageWheel.css';

export type { LyricsLanguage as LangCode };

const ITEM_W = 76;

const LANG_CODES: LyricsLanguage[] = ['jp', 'ko', 'en', 'zh'];

function langLabel(code: LyricsLanguage): string {
  const base: Record<LyricsLanguage, string> = {
    jp: '日本語',
    ko: '한국어',
    en: 'ENG',
    zh: L('中文', 'Chinese'),
  };
  return base[code];
}

const DEFAULT_LANGUAGES = LANG_CODES;

function langIndex(code: LyricsLanguage, languages: readonly LyricsLanguage[]): number {
  const i = languages.findIndex((l) => l === code);
  return i >= 0 ? i : 0;
}

function triggerWheelSnapFeedback(soundEnabled: boolean): void {
  if (!soundEnabled) return;
  hapticButton();
  playLogitechClickSoundEffect();
}

type Props = {
  value: LyricsLanguage;
  onChange: (lang: LyricsLanguage) => void;
  /** 由语言矩阵 learningTargetLanguages 推导；默认全部 */
  languages?: LyricsLanguage[];
  soundEnabled?: boolean;
};

/**
 * 横向滚轮语言选择器：居中项清晰，两侧项缩小 + 模糊；定住吸附时点击声 + 轻震。
 */
export default function LanguageWheel({ value, onChange, languages, soundEnabled }: Props) {
  const wheelLanguages = useMemo(() => {
    const list = languages?.length ? languages : DEFAULT_LANGUAGES;
    return list.filter((code) => LANG_CODES.includes(code));
  }, [languages]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const indexRef = useRef(langIndex(value, wheelLanguages));
  const rafRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const settleFeedbackKeyRef = useRef<string | null>(null);
  const feedbackEnabled = soundEnabled ?? isInteractionSoundEnabled();

  const applyItemVisuals = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const centerX = scroller.scrollLeft + scroller.clientWidth / 2;
    itemRefs.current.forEach((el) => {
      if (!el) return;
      const itemCenter = el.offsetLeft + ITEM_W / 2;
      const dist = Math.min(1.2, Math.abs(centerX - itemCenter) / ITEM_W);
      const scale = Math.max(0.78, 1 - dist * 0.18);
      const opacity = Math.max(0.32, 1 - dist * 0.52);
      const blur = dist * 2.8;
      el.style.transform = `scale(${scale})`;
      el.style.opacity = String(opacity);
      el.style.filter = blur > 0.05 ? `blur(${blur}px)` : 'none';
    });
  }, []);

  const scrollToIndex = useCallback((index: number, smooth: boolean) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const clamped = Math.max(0, Math.min(wheelLanguages.length - 1, index));
    scroller.scrollTo({
      left: clamped * ITEM_W,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, [wheelLanguages.length]);

  const commitIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(wheelLanguages.length - 1, index));
      if (clamped === indexRef.current) {
        applyItemVisuals();
        return;
      }
      indexRef.current = clamped;
      const next = wheelLanguages[clamped]!;
      onChange(next);
      applyItemVisuals();
    },
    [applyItemVisuals, onChange, wheelLanguages],
  );

  const settleScroll = useCallback(
    (fromUser: boolean) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const rawIndex = Math.round(scroller.scrollLeft / ITEM_W);
      const clamped = Math.max(0, Math.min(wheelLanguages.length - 1, rawIndex));
      const targetLeft = clamped * ITEM_W;
      if (Math.abs(scroller.scrollLeft - targetLeft) > 0.5) {
        scroller.scrollTo({ left: targetLeft, behavior: 'smooth' });
        return;
      }
      commitIndex(clamped);
      if (!fromUser) return;
      const feedbackKey = String(clamped);
      if (settleFeedbackKeyRef.current === feedbackKey) return;
      settleFeedbackKeyRef.current = feedbackKey;
      triggerWheelSnapFeedback(feedbackEnabled);
    },
    [commitIndex, feedbackEnabled, wheelLanguages.length],
  );

  const onScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (scroller) {
      const rawIndex = Math.round(scroller.scrollLeft / ITEM_W);
      const clamped = Math.max(0, Math.min(wheelLanguages.length - 1, rawIndex));
      const targetLeft = clamped * ITEM_W;
      if (Math.abs(scroller.scrollLeft - targetLeft) > 0.5) {
        settleFeedbackKeyRef.current = null;
      }
    }

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
  }, [applyItemVisuals, settleScroll, wheelLanguages.length]);

  useLayoutEffect(() => {
    const nextIndex = langIndex(value, wheelLanguages);
    indexRef.current = nextIndex;
    settleFeedbackKeyRef.current = null;
    scrollToIndex(nextIndex, false);
    applyItemVisuals();
  }, [value, wheelLanguages, scrollToIndex, applyItemVisuals]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const onScrollEnd = () => settleScroll(true);

    /** 将鼠标滚轮的纵向滚动（deltaY）转为横向滚动 */
    const onWheel = (e: WheelEvent) => {
      // 不拦截触控板双指横向滑动（deltaX 为主时让原生行为处理）
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      scroller.scrollLeft += e.deltaY;
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    scroller.addEventListener('scrollend', onScrollEnd);
    scroller.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      scroller.removeEventListener('scroll', onScroll);
      scroller.removeEventListener('scrollend', onScrollEnd);
      scroller.removeEventListener('wheel', onWheel);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (settleTimerRef.current != null) window.clearTimeout(settleTimerRef.current);
    };
  }, [onScroll, settleScroll]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const currentIndex = langIndex(value, wheelLanguages);
      let nextIndex = currentIndex;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = Math.max(0, currentIndex - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = Math.min(wheelLanguages.length - 1, currentIndex + 1);
      } else {
        return;
      }
      if (nextIndex !== currentIndex) {
        const next = wheelLanguages[nextIndex];
        if (next) {
          onChange(next);
          scrollToIndex(nextIndex, true);
        }
      }
    },
    [value, wheelLanguages, onChange, scrollToIndex],
  );

  return (
    <div className="lang-wheel">
      <div className="lang-wheel__frame">
        <div
          ref={scrollerRef}
          className="lang-wheel__scroller"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <div className="lang-wheel__list" role="listbox" aria-label={L('语言选择', 'Language selection')}>
            {wheelLanguages.map((code, i) => (
              <div
                key={code}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                className="lang-wheel__item"
                role="option"
                {...(code === value
                  ? ({ 'aria-selected': 'true' } as const)
                  : ({ 'aria-selected': 'false' } as const))}
                data-lang={code}
              >
                {langLabel(code)}
              </div>
            ))}
          </div>
        </div>
        <div className="lang-wheel__mask" aria-hidden />
        <span className="lang-wheel__indicator" aria-hidden />
      </div>
    </div>
  );
}
