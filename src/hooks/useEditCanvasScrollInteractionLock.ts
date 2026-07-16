import { useEffect, useRef, type RefObject } from 'react';

const SCROLL_END_MS = 180;

type Options = {
  /** 开始滑动时回调（例如收起墨微调 Popover） */
  onScrollStart?: () => void;
};

/**
 * 编辑画布上下滑期间给滚动容器加 `is-scrolling`：
 * CSS 关闭正文 pointer-events，降低日文密集 ruby 的命中测试成本；停滑后恢复可编辑。
 *
 * 忽略「scrollTop 未变」的伪 scroll（常见于 frame 高度微调），避免 class 狂闪与光标闪烁。
 */
export function useEditCanvasScrollInteractionLock(
  scrollRef: RefObject<HTMLElement | null>,
  options?: Options,
): void {
  const onScrollStart = options?.onScrollStart;
  const lastTopRef = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let endTimer = 0;
    let active = false;
    lastTopRef.current = el.scrollTop;

    const onScroll = () => {
      const top = el.scrollTop;
      // 高度反馈导致的 scroll 事件往往 scrollTop 几乎不变或仅被 clamp 微调
      if (!active && Math.abs(top - lastTopRef.current) < 1) {
        lastTopRef.current = top;
        return;
      }
      lastTopRef.current = top;

      if (!active) {
        active = true;
        el.classList.add('is-scrolling');
        onScrollStart?.();
      }
      window.clearTimeout(endTimer);
      endTimer = window.setTimeout(() => {
        active = false;
        el.classList.remove('is-scrolling');
        lastTopRef.current = el.scrollTop;
      }, SCROLL_END_MS);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.clearTimeout(endTimer);
      el.classList.remove('is-scrolling');
    };
  }, [scrollRef, onScrollStart]);
}
