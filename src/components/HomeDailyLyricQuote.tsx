import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { hapticLight } from '../hooks/useHaptics';
import {
  getSavedLyricsProject,
  type SavedLyricsProject,
} from '../services/savedLyricsStore';
import {
  resolveHomeDailyLyricQuote,
  type HomeDailyLyricQuote,
} from '../services/homeDailyLyricQuote';
import './HomeDailyLyricQuote.css';

type Props = {
  refreshKey?: number;
  onOpenProject: (project: SavedLyricsProject) => void;
};

const LONG_PRESS_MS = 550;
const LONG_PRESS_MOVE_TOL = 12;
const FADE_OUT_MS = 650;
const FADE_IN_MS = 850;

function formatSource(quote: HomeDailyLyricQuote): string {
  const artist = quote.artist?.trim();
  if (artist) return `《${quote.title}》· ${artist}`;
  return `《${quote.title}》`;
}

type FadePhase = 'idle' | 'out' | 'in';

export default function HomeDailyLyricQuote({ refreshKey = 0, onOpenProject }: Props) {
  const [quote, setQuote] = useState<HomeDailyLyricQuote | null>(null);
  const [fadePhase, setFadePhase] = useState<FadePhase>('idle');

  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const refreshInFlightRef = useRef(false);
  const fadeTimersRef = useRef<number[]>([]);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const clearFadeTimers = useCallback(() => {
    fadeTimersRef.current.forEach((id) => window.clearTimeout(id));
    fadeTimersRef.current = [];
  }, []);

  const loadDailyQuote = useCallback(async () => {
    const next = await resolveHomeDailyLyricQuote({ mode: 'daily' });
    setQuote(next);
    setFadePhase('idle');
  }, []);

  useEffect(() => {
    void loadDailyQuote();
  }, [loadDailyQuote, refreshKey]);

  useEffect(() => {
    return () => {
      clearLongPress();
      clearFadeTimers();
    };
  }, [clearLongPress, clearFadeTimers]);

  const refreshQuote = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    hapticLight();
    setFadePhase('out');

    clearFadeTimers();
    fadeTimersRef.current.push(
      window.setTimeout(() => {
        void (async () => {
          try {
            const next = await resolveHomeDailyLyricQuote({
              mode: 'random',
              exclude: quote ?? undefined,
            });
            setQuote(next);
            setFadePhase('in');
            fadeTimersRef.current.push(
              window.setTimeout(() => {
                setFadePhase('idle');
                refreshInFlightRef.current = false;
              }, FADE_IN_MS),
            );
          } catch {
            setFadePhase('idle');
            refreshInFlightRef.current = false;
          }
        })();
      }, FADE_OUT_MS),
    );
  }, [clearFadeTimers, quote]);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      if (refreshInFlightRef.current || fadePhase !== 'idle') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      longPressTriggeredRef.current = false;
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
      clearLongPress();
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTriggeredRef.current = true;
        void refreshQuote();
      }, LONG_PRESS_MS);
    },
    [clearLongPress, fadePhase, refreshQuote],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      if (!longPressTimerRef.current || !pointerStartRef.current) return;
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      if (Math.abs(dx) > LONG_PRESS_MOVE_TOL || Math.abs(dy) > LONG_PRESS_MOVE_TOL) {
        clearLongPress();
      }
    },
    [clearLongPress],
  );

  const onPointerUp = useCallback(() => {
    clearLongPress();
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    if (!quote || refreshInFlightRef.current) return;

    void (async () => {
      const project = await getSavedLyricsProject(quote.projectId);
      if (project) onOpenProject(project);
    })();
  }, [clearLongPress, onOpenProject, quote]);

  const onPointerCancel = useCallback(() => {
    clearLongPress();
    longPressTriggeredRef.current = false;
  }, [clearLongPress]);

  if (!quote?.lines.length) return null;

  const contentClass = [
    'home-daily-quote__content',
    fadePhase === 'out' ? 'is-fading-out' : '',
    fadePhase === 'in' ? 'is-fading-in' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <aside className="home-daily-quote" data-lang={quote.lang} aria-label="每日歌词摘录">
      <button
        type="button"
        className="home-daily-quote__button"
        data-no-press-feedback
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className={contentClass}>
          <div className="home-daily-quote__lines">
            {quote.lines.map((line, index) => (
              <span key={`${quote.projectId}-${quote.startIndex}-${index}`} className="home-daily-quote__line">
                {line}
              </span>
            ))}
          </div>
          <span className="home-daily-quote__source">{formatSource(quote)}</span>
        </div>
      </button>
    </aside>
  );
}
