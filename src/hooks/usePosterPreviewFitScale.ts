import { useLayoutEffect, useState, type RefObject } from 'react';
import { getFuriganaPosterCanvasDimensions } from '../utils/furiganaLayout/furiganaPosterShared';
import type { PosterLayoutProfile } from '../utils/furiganaLayout/types';

export const PAGE_GAP_PX = 20;

function computeWidthFitScale(pageWidth: number, containerWidth: number): number {
  if (containerWidth <= 0 || pageWidth <= 0) {
    return 1;
  }
  const available = Math.max(containerWidth - 1, 0);
  // 略缩小，避免 transform 缩放后底部亚像素裁切
  return Math.min(available / pageWidth, 1) * 0.998;
}

/** 按容器宽度等比缩放分页预览；高度超出时由页面纵向滚动查看 */
export function usePosterPreviewFitScale(
  layoutProfile: PosterLayoutProfile,
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  remeasureKey: string | number = 0,
): number {
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    if (!active) {
      return;
    }

    const el = containerRef.current;
    if (!el) {
      return;
    }

    const { width: pageWidth } = getFuriganaPosterCanvasDimensions(layoutProfile);

    const update = () => {
      const width = el.getBoundingClientRect().width;
      if (width <= 0) {
        return;
      }
      setScale(computeWidthFitScale(pageWidth, width));
    };

    update();
    const raf1 = requestAnimationFrame(update);
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(update));

    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [layoutProfile, containerRef, active, remeasureKey]);

  return scale;
}
