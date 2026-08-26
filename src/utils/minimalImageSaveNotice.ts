/** 极简封面图：保存到歌词库时的「下次不再提醒」偏好 */
const STORAGE_KEY = 'shufuri.minimalImageSaveNotice.dismissed';

export function isMinimalImageSaveNoticeDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMinimalImageSaveNoticeDismissed(dismissed = true): void {
  try {
    if (dismissed) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

/** 是否应在保存前弹出封面图无法入库的提示 */
export function shouldShowMinimalImageSaveNotice(
  layoutVariant: string | undefined,
  minimalImageUrl: string | undefined,
): boolean {
  if (layoutVariant !== 'minimal') return false;
  if (!minimalImageUrl?.trim()) return false;
  return !isMinimalImageSaveNoticeDismissed();
}
