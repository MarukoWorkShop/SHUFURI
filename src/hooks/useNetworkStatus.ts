/**
 * 网络状态监听
 * Capacitor 原生环境使用 Network 插件；Web 回退 navigator.onLine。
 */
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

export function useNetworkStatus(): { online: boolean; loading: boolean } {
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Capacitor 原生环境：使用 Network 插件
    if (Capacitor.isNativePlatform()) {
      void (async () => {
        try {
          const { Network } = await import('@capacitor/network');
          const status = await Network.getStatus();
          if (!cancelled) {
            setOnline(status.connected);
            setLoading(false);
          }

          const handler = await Network.addListener('networkStatusChange', (s) => {
            if (!cancelled) {
              setOnline(s.connected);
            }
          });
          return () => {
            void handler.remove();
          };
        } catch {
          if (!cancelled) setLoading(false);
        }
      })();
    } else {
      // Web 环境：回退到 navigator.onLine
      setLoading(false);
      const handleOnline = () => setOnline(true);
      const handleOffline = () => setOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        cancelled = true;
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return { online, loading };
}
