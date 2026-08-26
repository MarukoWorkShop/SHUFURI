import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isMinimalImageSaveNoticeDismissed,
  setMinimalImageSaveNoticeDismissed,
  shouldShowMinimalImageSaveNotice,
} from '../minimalImageSaveNotice.ts';

describe('minimalImageSaveNotice', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('仅极简 + 有图 + 未关闭提醒时才弹出', () => {
    expect(shouldShowMinimalImageSaveNotice('minimal', 'data:image/png;base64,xx')).toBe(true);
    expect(shouldShowMinimalImageSaveNotice('minimal', '  ')).toBe(false);
    expect(shouldShowMinimalImageSaveNotice('minimal', '')).toBe(false);
    expect(shouldShowMinimalImageSaveNotice('standard', 'data:image/png;base64,xx')).toBe(false);
    expect(shouldShowMinimalImageSaveNotice('notebook', 'data:image/png;base64,xx')).toBe(false);
  });

  it('下次不再提醒后不再弹出', () => {
    expect(isMinimalImageSaveNoticeDismissed()).toBe(false);
    setMinimalImageSaveNoticeDismissed(true);
    expect(isMinimalImageSaveNoticeDismissed()).toBe(true);
    expect(shouldShowMinimalImageSaveNotice('minimal', 'data:image/png;base64,xx')).toBe(false);
  });
});
