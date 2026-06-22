import { useLayoutEffect, useState, type RefObject } from 'react';
import { getShufuriPosterCanvasDimensions } from '../utils/shufuriPoster/shufuriPosterShared';
import type { PosterLayoutProfile } from '../utils/shufuriPoster/types';

export const PAGE_GAP_PX = 20;

/** 与 app-main--preview 左右 padding（各 --ui-space-2）对齐的宽度估算 */
const PREVIEW_HORIZONTAL_PADDING_PX = 32;

export function computePosterPreviewFitScale(pageWidth: number, containerWidth: number): number {
  if (containerWidth <= 0 || pageWidth <= 0) {
    return 1;
  }
  const available = Math.max(containerWidth - 1, 0);
  // 略缩小，避免 transform 缩放后底部亚像素裁切
  return Math.min(available / pageWidth, 1) * 0.998;
}

function estimatePreviewContainerWidth(): number {
  if (typeof window === 'undefined') {
    return 0;
  }
  return Math.max(window.innerWidth - PREVIEW_HORIZONTAL_PADDING_PX, 0);
}

function estimatePosterPreviewFitScale(layoutProfile: PosterLayoutProfile): number {
  const containerWidth = estimatePreviewContainerWidth();
  if (containerWidth <= 0) {
    return 1;
  }
  const { width: pageWidth } = getShufuriPosterCanvasDimensions(layoutProfile);
  return computePosterPreviewFitScale(pageWidth, containerWidth);
}

/** 按容器宽度等比缩放分页预览；高度超出时由页面纵向滚动查看 */
export function usePosterPreviewFitScale(
  layoutProfile: PosterLayoutProfile,
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  remeasureKey: string | number = 0,
  pauseUpdates = false,
): number {
  const [scale, setScale] = useState(() => estimatePosterPreviewFitScale(layoutProfile));

  useLayoutEffect(() => {
    if (!active || pauseUpdates) {
      return;
    }

    const el = containerRef.current;
    if (!el) {
      return;
    }

    const { width: pageWidth } = getShufuriPosterCanvasDimensions(layoutProfile);

    const update = () => {
      const width = el.clientWidth;
      if (width <= 0) {
        return;
      }
      setScale(computePosterPreviewFitScale(pageWidth, width));
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
  }, [layoutProfile, containerRef, active, remeasureKey, pauseUpdates]);

  return scale;
}
