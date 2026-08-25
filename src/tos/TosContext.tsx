import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { TosModal } from './TosModal';

/** localStorage 中记录同意时间戳的键名 */
export const TOS_AGREED_KEY = 'shufuri_tos_agreed';

interface TosContextValue {
  /**
   * 受 ToS 拦截的动作包装器。
   * - 若已同意（localStorage 存在键），立即执行 callback。
   * - 否则打开 ToS Modal，暂存 callback，确认后写入时间戳并立即执行。
   */
  handleActionWithTos: (callback: () => void) => void;
  /** 是否已同意（用于 UI 预判断，非必须） */
  hasAgreed: boolean;
}

const TosContext = createContext<TosContextValue | null>(null);

function readAgreed(): boolean {
  try {
    return window.localStorage.getItem(TOS_AGREED_KEY) !== null;
  } catch {
    return false;
  }
}

export function TosProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [hasAgreed, setHasAgreed] = useState<boolean>(() => readAgreed());
  // 暂存被拦截的待执行回调
  const pendingCallbackRef = useRef<(() => void) | null>(null);

  const handleActionWithTos = useCallback((callback: () => void) => {
    if (readAgreed()) {
      callback();
      return;
    }
    pendingCallbackRef.current = callback;
    setOpen(true);
  }, []);

  const handleConfirm = useCallback(() => {
    try {
      window.localStorage.setItem(TOS_AGREED_KEY, String(Date.now()));
    } catch {
      // 忽略写入失败（如隐私模式），仍允许继续
    }
    setHasAgreed(true);
    setOpen(false);
    const cb = pendingCallbackRef.current;
    pendingCallbackRef.current = null;
    if (cb) cb();
  }, []);

  const handleClose = useCallback(() => {
    // 取消：丢弃 pending callback，不写入 localStorage
    pendingCallbackRef.current = null;
    setOpen(false);
  }, []);

  const value = useMemo<TosContextValue>(
    () => ({ handleActionWithTos, hasAgreed }),
    [handleActionWithTos, hasAgreed],
  );

  return (
    <TosContext.Provider value={value}>
      {children}
      <TosModal
        open={open}
        onConfirm={handleConfirm}
        onClose={handleClose}
      />
    </TosContext.Provider>
  );
}

/** 在组件内获取 ToS 拦截器 */
export function useTos(): TosContextValue {
  const ctx = useContext(TosContext);
  if (!ctx) {
    throw new Error('useTos must be used within a <TosProvider>');
  }
  return ctx;
}
