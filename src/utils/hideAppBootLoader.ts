/** 首页就绪后淡出并移除 #app-boot（由 main / HomeScreen 调用） */
export function hideAppBootLoader(): void {
  const boot = document.getElementById('app-boot');
  if (!boot) return;

  const rootStyle = getComputedStyle(document.documentElement);
  const bg = rootStyle.getPropertyValue('--ui-bg').trim();
  if (bg) {
    boot.style.background = bg;
  }

  const remove = () => boot.remove();
  boot.classList.add('app-boot--hide');
  boot.addEventListener('transitionend', remove, { once: true });
  window.setTimeout(remove, 400);
}
