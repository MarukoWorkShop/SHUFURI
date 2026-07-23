import { useLayoutEffect, useState, type RefObject } from 'react';
import { dimForFuriganaPoster, B5_DIM } from '../utils/shufuriPoster/dimensions';
import type { PosterLayoutProfile } from '../utils/shufuriPoster/types';

export const PAGE_GAP_PX = 20;

/** 与 app-main--preview 左右 padding（各 --ui-space-2）对齐的宽度估算 */
const PREVIEW_HORIZONTAL_PADDING_PX = 32;

/**
 * 屏上预览正文视觉字号对齐 B5 打印基线（12px），使各规格接近「实尺寸 1:1」。
 * mobile 设计基线 32 → maxScale ≈ 0.375；B5 基线 12 → maxScale = 1。
 */
export const SCREEN_PREVIEW_REF_FONT_PX = B5_DIM.elasticFontBase;

export function computePosterPreviewOneToOneMaxScale(elasticFontBase: number): number {
  if (!(elasticFontBase > 0)) return 1;
  return SCREEN_PREVIEW_REF_FONT_PX / elasticFontBase;
}

/**
 * 预览缩放：不超过容器宽度，且不超过 1:1 字号上限（避免宽屏把手机稿撑成巨大字）。
 */
export function computePosterPreviewFitScale(
  pageWidth: number,
  containerWidth: number,
  maxScale = 1,
): number {
  if (containerWidth <= 0 || pageWidth <= 0) {
    return Math.min(1, maxScale);
  }
  const available = Math.max(containerWidth - 1, 0);
  const fit = available / pageWidth;
  // 略缩小，避免 transform 缩放后底部亚像素裁切
  return Math.min(fit, 1, maxScale) * 0.998;
}

function maxScaleForProfile(layoutProfile: PosterLayoutProfile): number {
  return computePosterPreviewOneToOneMaxScale(
    dimForFuriganaPoster(layoutProfile).elasticFontBase,
  );
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
    return maxScaleForProfile(layoutProfile);
  }
  const { canvasWidth: pageWidth } = dimForFuriganaPoster(layoutProfile);
  return computePosterPreviewFitScale(
    pageWidth,
    containerWidth,
    maxScaleForProfile(layoutProfile),
  );
}

/** 按容器宽度等比缩放分页预览，并封顶为屏上约 1:1 字号；高度超出时纵向滚动 */
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

    const dim = dimForFuriganaPoster(layoutProfile);
    const pageWidth = dim.canvasWidth;
    const maxScale = computePosterPreviewOneToOneMaxScale(dim.elasticFontBase);

    const update = () => {
      const width = el.clientWidth;
      if (width <= 0) {
        return;
      }
      setScale(computePosterPreviewFitScale(pageWidth, width, maxScale));
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
