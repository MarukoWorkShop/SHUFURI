import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { hapticButton } from '../hooks/useHaptics';
import { isInteractionSoundEnabled, type LyricsLanguage } from '../services/appSettings';
import { playKataClickSound } from '../utils/kataClickSound';
import './LanguageWheel.css';

export type { LyricsLanguage as LangCode };

const ITEM_W = 76;

const LANG_LABELS: Record<LyricsLanguage, string> = {
  jp: 'JAP',
  ko: 'KOR',
  en: 'ENG',
  zh: '中文',
};

const DEFAULT_LANGUAGES: LyricsLanguage[] = ['jp', 'ko', 'en', 'zh'];

function langIndex(code: LyricsLanguage, languages: readonly LyricsLanguage[]): number {
  const i = languages.findIndex((l) => l === code);
  return i >= 0 ? i : 0;
}

function triggerWheelSnapFeedback(soundEnabled: boolean): void {
  if (!soundEnabled) return;
  hapticButton();
  playKataClickSound();
}

type Props = {
  value: LyricsLanguage;
  onChange: (lang: LyricsLanguage) => void;
  /** 由语言矩阵 learningTargetLanguages 推导；默认全部 */
  languages?: LyricsLanguage[];
  soundEnabled?: boolean;
};

/**
 * 横向滚轮语言选择器：居中项清晰，两侧项缩小 + 模糊；滚停时吸附并触发轻震 / カタ 声。
 */
export default function LanguageWheel({ value, onChange, languages, soundEnabled }: Props) {
  const wheelLanguages = useMemo(() => {
    const list = languages?.length ? languages : DEFAULT_LANGUAGES;
    return list.filter((code) => code in LANG_LABELS);
  }, [languages]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const indexRef = useRef(langIndex(value, wheelLanguages));
  const rafRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
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
    (index: number, fromUser: boolean) => {
      const clamped = Math.max(0, Math.min(wheelLanguages.length - 1, index));
      if (clamped === indexRef.current) {
        applyItemVisuals();
        return;
      }
      indexRef.current = clamped;
      const next = wheelLanguages[clamped]!;
      onChange(next);
      if (fromUser) {
        triggerWheelSnapFeedback(feedbackEnabled);
      }
      applyItemVisuals();
    },
    [applyItemVisuals, feedbackEnabled, onChange, wheelLanguages],
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
    const nextIndex = langIndex(value, wheelLanguages);
    indexRef.current = nextIndex;
    scrollToIndex(nextIndex, false);
    applyItemVisuals();
  }, [value, wheelLanguages, scrollToIndex, applyItemVisuals]);

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
    <div className="lang-wheel">
      <div className="lang-wheel__frame">
        <div
          ref={scrollerRef}
          className="lang-wheel__scroller"
          tabIndex={0}
        >
          <div className="lang-wheel__list" role="listbox" aria-label="语言选择">
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
                {LANG_LABELS[code]}
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
