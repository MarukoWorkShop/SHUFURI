/**
 * @deprecated colorTheme 固定为 mono，暗/亮切换由 useDarkMode 管理。
 * 此函数仅清除历史的 data-theme=blue/red 残留，不再覆盖 data-theme 属性，
 * 避免与 useDarkMode 的 data-theme=dark 冲突。
 */
export function applyColorTheme(_theme?: 'mono'): void {
  if (typeof document === 'undefined') return;
  // 仅在未设置暗色模式时移除残留属性（恢复默认浅色）
  if (document.documentElement.getAttribute('data-theme') === 'mono') {
    document.documentElement.removeAttribute('data-theme');
  }
}
