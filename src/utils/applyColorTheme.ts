import type { ColorTheme } from '../services/appSettings';

/** 将换肤主题应用到 documentElement（data-theme） */
export function applyColorTheme(theme: ColorTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}
