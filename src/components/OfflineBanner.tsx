/**
 * 离线模式提示横幅
 * 网络断开时显示提示：当前为离线模式，可本地浏览与排版
 */
import { useEffect, useState } from 'react';

type Props = {
  online: boolean;
  loading: boolean;
};

export default function OfflineBanner({ online, loading }: Props) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!online) {
      setExiting(false);
      // 延迟一小段再显示，避免网络瞬间抖动
      const t = window.setTimeout(() => setVisible(true), 600);
      return () => window.clearTimeout(t);
    } else {
      if (visible) {
        setExiting(true);
        const t = window.setTimeout(() => {
          setVisible(false);
          setExiting(false);
        }, 1200);
        return () => window.clearTimeout(t);
      }
    }
  }, [online, loading, visible]);

  if (!visible && !exiting) return null;

  return (
    <div
      className={`offline-banner${online ? ' offline-banner--restored' : ''}${exiting ? ' offline-banner--exit' : ''}`}
      role="alert"
    >
      <span className="offline-banner__dot" />
      <span className="offline-banner__text">
        {online ? '网络已恢复' : '当前为离线模式，可本地浏览与排版'}
      </span>
    </div>
  );
}
