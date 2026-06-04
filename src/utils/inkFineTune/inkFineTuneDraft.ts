const DRAFT_PREFIX = 'shufu-ink-draft:';

export function saveInkFineTuneDraft(key: string, bodyHtml: string): void {
  try {
    sessionStorage.setItem(`${DRAFT_PREFIX}${key}`, bodyHtml);
  } catch {
    /* quota / private mode */
  }
}

export function loadInkFineTuneDraft(key: string): string | null {
  try {
    return sessionStorage.getItem(`${DRAFT_PREFIX}${key}`);
  } catch {
    return null;
  }
}
