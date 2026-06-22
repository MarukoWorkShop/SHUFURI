import { useEffect } from 'react';
import {
  triggerButtonPressFeedback,
  triggerLogitechPressFeedback,
} from '../utils/buttonFeedback';

/** 可按压控件选择器（与设计规范 .ui-pressable 一致） */
const PRESSABLE_SELECTOR = [
  'button:not(:disabled):not([data-no-press-feedback])',
  '[role="button"]:not([aria-disabled="true"]):not([data-no-press-feedback])',
  'label.app-settings__row',
  '.saved-library-toggle:not([aria-disabled="true"])',
].join(',');

const LOGITECH_PRESSABLE_SELECTOR = '.saved-library-toggle';

function findPressableTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) {
    return null;
  }
  const el = target.closest(PRESSABLE_SELECTOR);
  if (!el) {
    return null;
  }
  if (el.matches('button:disabled, [aria-disabled="true"]')) {
    return null;
  }
  return el;
}

/** 全局捕获 pointerdown，为所有可点击按钮触发震动反馈 */
export function useGlobalButtonFeedback(): void {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      const pressable = findPressableTarget(event.target);
      if (!pressable) {
        return;
      }
      if (pressable.matches(LOGITECH_PRESSABLE_SELECTOR)) {
        triggerLogitechPressFeedback();
      } else {
        triggerButtonPressFeedback();
      }
    };

    document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, { capture: true });
    };
  }, []);
}
