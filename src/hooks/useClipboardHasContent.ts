import { useCallback, useRef } from 'react';
import { readClipboardText } from '../utils/clipboard';

/**
 * 检查剪贴板是否有可粘贴内容（按需，不自动轮询）。
 * 避免 iOS 持续弹出"从 xxx 粘贴"的系统提示。
 */
export function useClipboardHasContent() {
  const lastResultRef = useRef(false);

  const check = useCallback(async (): Promise<boolean> => {
    try {
      const has = (await readClipboardText()).trim().length > 0;
      lastResultRef.current = has;
      return has;
    } catch {
      lastResultRef.current = false;
      return false;
    }
  }, []);

  return { check, lastResult: lastResultRef };
}
