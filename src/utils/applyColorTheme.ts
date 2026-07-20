/** 固定墨色主题（清除历史 data-theme=blue/red） */
export function applyColorTheme(_theme?: 'mono'): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = 'mono';
}
