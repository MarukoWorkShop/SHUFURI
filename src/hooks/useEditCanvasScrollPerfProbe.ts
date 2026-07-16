import { useEffect, type RefObject } from 'react';

const LONG_FRAME_MS = 20;
const SCROLL_END_MS = 200;

/**
 * P0：仅 DEV 下采样编辑画布滚动期间的 rAF 帧间隔，滚动结束后打一条汇总日志。
 * 生产构建无开销（import.meta.env.DEV === false 时立即返回）。
 */
export function useEditCanvasScrollPerfProbe(scrollRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const el = scrollRef.current;
    if (!el) return;

    let scrolling = false;
    let frames = 0;
    let longFrames = 0;
    let lastTs = 0;
    let raf = 0;
    let endTimer = 0;

    const tick = (ts: number) => {
      if (!scrolling) return;
      if (lastTs > 0) {
        const dt = ts - lastTs;
        frames += 1;
        if (dt > LONG_FRAME_MS) longFrames += 1;
      }
      lastTs = ts;
      raf = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      if (!scrolling) {
        scrolling = true;
        frames = 0;
        longFrames = 0;
        lastTs = 0;
        raf = requestAnimationFrame(tick);
      }
      window.clearTimeout(endTimer);
      endTimer = window.setTimeout(() => {
        scrolling = false;
        cancelAnimationFrame(raf);
        if (frames > 0) {
          const okRatio = (frames - longFrames) / frames;
          console.info(
            `[edit-scroll-perf] frames=${frames} long(>${LONG_FRAME_MS}ms)=${longFrames} ok=${Math.round(okRatio * 100)}%`,
          );
        }
      }, SCROLL_END_MS);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.clearTimeout(endTimer);
      cancelAnimationFrame(raf);
    };
  }, [scrollRef]);
}
