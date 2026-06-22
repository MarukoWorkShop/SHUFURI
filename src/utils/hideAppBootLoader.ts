/** 首页就绪后淡出并移除 #app-boot（由 HomeScreen 在字体加载后调用） */
export function hideAppBootLoader(): void {
  const boot = document.getElementById('app-boot');
  if (!boot) return;

  const rootStyle = getComputedStyle(document.documentElement);
  const bg = rootStyle.getPropertyValue('--ui-bg').trim();
  if (bg) {
    boot.style.background = bg;
  }

  const spinner = boot.querySelector('.app-boot__spinner');
  if (spinner instanceof HTMLElement) {
    const accent = rootStyle.getPropertyValue('--color-accent').trim();
    const border = rootStyle.getPropertyValue('--color-border').trim();
    if (border) spinner.style.borderColor = border;
    if (accent) spinner.style.borderTopColor = accent;
  }

  const remove = () => boot.remove();
  boot.classList.add('app-boot--hide');
  boot.addEventListener('transitionend', remove, { once: true });
  window.setTimeout(remove, 400);
}
