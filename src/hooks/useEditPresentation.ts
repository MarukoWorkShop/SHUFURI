import { useCallback, useEffect, useState } from 'react';

const SPLIT_RATIO_KEY = 'shufuri_edit_split_ratio';
const SPLIT_MIN = 0.28;
const SPLIT_MAX = 0.72;
const SPLIT_DEFAULT = 0.5;

/** 二期寻宝联动预留；一期不接线 */
export type EditPresentationHoverTerm = string | null;

function clampRatio(n: number): number {
  if (!Number.isFinite(n)) return SPLIT_DEFAULT;
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, n));
}

function readStoredRatio(): number {
  try {
    const raw = sessionStorage.getItem(SPLIT_RATIO_KEY);
    if (raw == null) return SPLIT_DEFAULT;
    return clampRatio(parseFloat(raw));
  } catch {
    return SPLIT_DEFAULT;
  }
}

export type UseEditPresentationResult = {
  presentationOn: boolean;
  splitRatio: number;
  spotlightGroupId: string | null;
  /** 二期：悬停词汇 surface */
  hoverTermSurface: EditPresentationHoverTerm;
  enter: () => void;
  exit: () => void;
  toggle: () => void;
  setRatio: (ratio: number) => void;
  setSpotlight: (groupId: string | null) => void;
  clearSpotlight: () => void;
  setHoverTermSurface: (term: EditPresentationHoverTerm) => void;
};

/**
 * 编辑页全屏态：藏栏 / 分栏比例 / 聚光灯。
 * splitRatio 写入 sessionStorage，同标签页刷新保留。
 */
export function useEditPresentation(): UseEditPresentationResult {
  const [presentationOn, setPresentationOn] = useState(false);
  const [splitRatio, setSplitRatio] = useState(readStoredRatio);
  const [spotlightGroupId, setSpotlightGroupId] = useState<string | null>(null);
  const [hoverTermSurface, setHoverTermSurface] = useState<EditPresentationHoverTerm>(null);

  const setRatio = useCallback((ratio: number) => {
    const next = clampRatio(ratio);
    setSplitRatio(next);
    try {
      sessionStorage.setItem(SPLIT_RATIO_KEY, String(next));
    } catch {
      /* private mode */
    }
  }, []);

  const clearSpotlight = useCallback(() => {
    setSpotlightGroupId(null);
  }, []);

  const setSpotlight = useCallback((groupId: string | null) => {
    setSpotlightGroupId(groupId);
  }, []);

  const enter = useCallback(() => {
    setPresentationOn(true);
  }, []);

  const exit = useCallback(() => {
    setPresentationOn(false);
    setSpotlightGroupId(null);
    setHoverTermSurface(null);
  }, []);

  const toggle = useCallback(() => {
    setPresentationOn((on) => {
      if (on) {
        setSpotlightGroupId(null);
        setHoverTermSurface(null);
        return false;
      }
      return true;
    });
  }, []);

  useEffect(() => {
    if (!presentationOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (spotlightGroupId) {
        e.preventDefault();
        setSpotlightGroupId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presentationOn, spotlightGroupId]);

  return {
    presentationOn,
    splitRatio,
    spotlightGroupId,
    hoverTermSurface,
    enter,
    exit,
    toggle,
    setRatio,
    setSpotlight,
    clearSpotlight,
    setHoverTermSurface,
  };
}

/** 全屏态 50:50 时的基准字号倍率 */
export const EDIT_PRESENT_FONT_AT_HALF = 1.5;
/** @deprecated 使用 EDIT_PRESENT_FONT_AT_HALF */
export const EDIT_PRESENT_FONT_SCALE = EDIT_PRESENT_FONT_AT_HALF;
export const EDIT_SPLIT_RATIO_MIN = SPLIT_MIN;
export const EDIT_SPLIT_RATIO_MAX = SPLIT_MAX;

/** 该栏宽度占比 → 字号倍率；50% 时为 1.5，线性随宽度缩放 */
export function presentFontScaleForPane(paneRatio: number): number {
  const r = Number.isFinite(paneRatio) ? paneRatio : 0.5;
  return EDIT_PRESENT_FONT_AT_HALF * (r / 0.5);
}
