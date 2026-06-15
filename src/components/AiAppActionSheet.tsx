import { useEffect, useState, useRef, useCallback } from 'react';
import { checkInstalledAiApps, openAiApp } from '../utils/nativeBridge';
import type { AiAppInfo } from '../bridge/deepLinkPlugin';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 已复制到剪贴板的内容（仅用于检查后状态显示） */
  copiedText?: string;
};

const AI_APP_ICONS: Record<string, string> = {
  chatgpt: '/assets/app-icons/chatgpt.png',
  kimi: '/assets/app-icons/kimi.png',
  doubao: '/assets/app-icons/doubao.png',
  wenxin: '/assets/app-icons/wenxin.png',
  tongyi: '/assets/app-icons/tongyi.png',
  deepseek: '/assets/app-icons/deepseek.png',
};

export default function AiAppActionSheet({ visible, onClose, copiedText }: Props) {
  const [apps, setApps] = useState<AiAppInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    checkInstalledAiApps()
      .then(setApps)
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, [visible]);

  const handleOpenApp = useCallback(
    async (scheme: string) => {
      await openAiApp(scheme);
      onClose();
    },
    [onClose],
  );

  if (!visible) return null;

  return (
    <div className="ai-action-sheet-overlay" onClick={onClose}>
      <div
        ref={sheetRef}
        className="ai-action-sheet-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="ai-action-sheet__header">
          {copiedText ? (
            <p className="ai-action-sheet__title">✓ 指令已复制</p>
          ) : (
            <p className="ai-action-sheet__title">选择 AI 应用打开</p>
          )}
        </div>

        {loading ? (
          <div className="ai-action-sheet__loading">检测中…</div>
        ) : apps.length === 0 ? (
          <div className="ai-action-sheet__empty">
            <p>未检测到 AI 应用</p>
            <p className="ai-action-sheet__empty-hint">请先安装 ChatGPT、Kimi 或豆包等应用</p>
          </div>
        ) : (
          <div className="ai-action-sheet__list">
            {apps.map((app) => (
              <button
                key={app.id}
                type="button"
                className="ai-action-sheet__item"
                onClick={() => handleOpenApp(app.scheme)}
              >
                <img
                  className="ai-action-sheet__item-icon"
                  src={AI_APP_ICONS[app.id]}
                  alt={app.name}
                />
                <span className="ai-action-sheet__item-name">{app.name}</span>
                <span className="ai-action-sheet__item-arrow">›</span>
              </button>
            ))}
          </div>
        )}

        {/* 兜底：复制好了自己打开 */}
        <div className="ai-action-sheet__footer">
          <button
            type="button"
            className="ai-action-sheet__self-service"
            onClick={onClose}
          >
            复制好了，自己打开
          </button>
        </div>

        {/* 取消按钮 */}
        <button
          type="button"
          className="ai-action-sheet__cancel"
          onClick={onClose}
        >
          取消
        </button>
      </div>
    </div>
  );
}
