import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';

export const DRAWER_MS = 400;
export const UNLATCH_MS = 100;
export const DISMISS_DRAG_THRESHOLD_PX = 72;

export interface UseDrawerOptions {
  /** CSS class to toggle on document.documentElement when drawer is active */
  cssClass: string;
  /** Called just before close animation starts (for component-specific cleanup) */
  onBeforeClose?: () => void;
  /** Return true to suppress dismiss drag (e.g. detail overlay is open) */
  disableDrag?: () => boolean;
}

export interface UseDrawerReturn {
  drawerOpen: boolean;
  drawerVisible: boolean;
  drawerActive: boolean;
  unlatching: boolean;
  closing: boolean;
  dismissDragY: number;
  dismissDragging: boolean;
  drawerRef: React.RefObject<HTMLDivElement | null>;
  openDrawer: () => void;
  closeDrawer: () => void;
  onDismissHandlePointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  onDismissHandlePointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  onDismissHandlePointerUp: (e: PointerEvent<HTMLDivElement>) => void;
  onDismissHandlePointerCancel: (e: PointerEvent<HTMLDivElement>) => void;
}

export function useDrawer({
  cssClass,
  onBeforeClose,
  disableDrag,
}: UseDrawerOptions): UseDrawerReturn {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerActive, setDrawerActive] = useState(false);
  const [unlatching, setUnlatching] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dismissDragY, setDismissDragY] = useState(0);
  const [dismissDragging, setDismissDragging] = useState(false);

  const closeTimerRef = useRef<number | null>(null);
  const unlatchTimerRef = useRef<number | null>(null);
  const dismissDragStartYRef = useRef(0);
  const dismissDragStartOffsetRef = useRef(0);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  // Toggle CSS class on document
  useEffect(() => {
    document.documentElement.classList.toggle(cssClass, drawerActive);
    return () => {
      document.documentElement.classList.remove(cssClass);
    };
  }, [drawerActive, cssClass]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      if (unlatchTimerRef.current) window.clearTimeout(unlatchTimerRef.current);
    };
  }, []);

  // Reset drag state when drawer becomes inactive
  useEffect(() => {
    if (drawerActive) return;
    setDismissDragY(0);
    setDismissDragging(false);
  }, [drawerActive]);

  const openDrawer = useCallback(() => {
    if (drawerOpen || unlatching) return;
    setUnlatching(true);
    unlatchTimerRef.current = window.setTimeout(() => {
      setUnlatching(false);
      setDrawerOpen(true);
      setDrawerVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setDrawerActive(true));
      });
    }, UNLATCH_MS);
  }, [drawerOpen, unlatching]);

  const closeDrawer = useCallback(() => {
    if (!drawerOpen || closing) return;
    setClosing(true);
    setDrawerActive(false);
    onBeforeClose?.();
    closeTimerRef.current = window.setTimeout(() => {
      setDrawerOpen(false);
      setDrawerVisible(false);
      setClosing(false);
    }, DRAWER_MS);
  }, [drawerOpen, closing, onBeforeClose]);

  const onDismissHandlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (disableDrag?.() || closing || !drawerActive) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dismissDragStartYRef.current = e.clientY;
      dismissDragStartOffsetRef.current = dismissDragY;
      setDismissDragging(true);
    },
    [disableDrag, closing, drawerActive, dismissDragY],
  );

  const onDismissHandlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!dismissDragging) return;
      const dy = e.clientY - dismissDragStartYRef.current;
      setDismissDragY(Math.max(0, dismissDragStartOffsetRef.current + dy));
    },
    [dismissDragging],
  );

  const onDismissHandlePointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!dismissDragging) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      const dy = e.clientY - dismissDragStartYRef.current;
      const finalY = Math.max(0, dismissDragStartOffsetRef.current + dy);
      setDismissDragging(false);
      setDismissDragY(0);
      if (finalY >= DISMISS_DRAG_THRESHOLD_PX) {
        closeDrawer();
      }
    },
    [dismissDragging, closeDrawer],
  );

  const onDismissHandlePointerCancel = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!dismissDragging) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      setDismissDragging(false);
      setDismissDragY(0);
    },
    [dismissDragging],
  );

  return {
    drawerOpen,
    drawerVisible,
    drawerActive,
    unlatching,
    closing,
    dismissDragY,
    dismissDragging,
    drawerRef,
    openDrawer,
    closeDrawer,
    onDismissHandlePointerDown,
    onDismissHandlePointerMove,
    onDismissHandlePointerUp,
    onDismissHandlePointerCancel,
  };
}
