import { useCallback, useEffect, useRef, useState } from 'react';

/** 定时自动清空的轻量消息（Toast / 提示条） */
export function useTimedMessage(defaultDurationMs = 3000) {
  const [message, setMessage] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMessage('');
  }, []);

  const show = useCallback(
    (msg: string, durationMs = defaultDurationMs) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setMessage(msg);
      timerRef.current = setTimeout(() => {
        setMessage('');
        timerRef.current = null;
      }, durationMs);
    },
    [defaultDurationMs],
  );

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  return { message, show, clear };
}
