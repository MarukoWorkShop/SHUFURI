/**
 * 细腻的触觉震动反馈
 * Capacitor 原生环境使用 Haptics 插件；Web 回退无操作。
 */
import { Capacitor } from '@capacitor/core';

let hapticsMod: typeof import('@capacitor/haptics') | null = null;

async function loadMod() {
  if (hapticsMod) return hapticsMod;
  if (!Capacitor.isNativePlatform()) return null;
  try {
    hapticsMod = await import('@capacitor/haptics');
    return hapticsMod;
  } catch {
    return null;
  }
}

/** 按钮轻触（最常用）- impact: light；Web 回退 navigator.vibrate */
export function hapticButton(): void {
  void (async () => {
    const mod = await loadMod();
    if (mod) {
      try {
        await mod.Haptics.impact({ style: mod.ImpactStyle.Light });
      } catch {
        /* noop */
      }
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(8);
      } catch {
        /* noop */
      }
    }
  })();
}

/** 开关 / 选项选中 - impact: light */
export function hapticSelectionChanged(): void {
  hapticButton();
}

/** 保存成功 - notification: success */
export function hapticSuccess(): void {
  void (async () => {
    const mod = await loadMod();
    if (!mod) return;
    try { await mod.Haptics.notification({ type: mod.NotificationType.Success }); } catch { /* noop */ }
  })();
}

/** 操作失败 - notification: error */
export function hapticError(): void {
  void (async () => {
    const mod = await loadMod();
    if (!mod) return;
    try { await mod.Haptics.notification({ type: mod.NotificationType.Error }); } catch { /* noop */ }
  })();
}

// 保留别名向后兼容
export const hapticSelection = hapticSelectionChanged;
