import { useEffect, useState, useRef, useCallback } from 'react';
import { checkInstalledAiApps, openAiApp, isNativeWebView } from '../utils/nativeBridge';
import type { AiAppInfo } from '../bridge/deepLinkPlugin';
import { L } from '../utils/i18n';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 已复制到剪贴板的内容（仅用于检查后状态显示） */
  copiedText?: string;
  /** 打开指定 AI 应用；未提供时直接 deep link */
  onOpenApp?: (app: AiAppInfo) => void | Promise<void>;
};

const AI_APP_ICONS: Record<string, string> = {
  chatgpt: '/assets/app-icons/chatgpt.png',
  kimi: '/assets/app-icons/kimi.png',
  doubao: '/assets/app-icons/doubao.png',
  wenxin: '/assets/app-icons/wenxin.png',
  tongyi: '/assets/app-icons/tongyi.png',
  deepseek: '/assets/app-icons/deepseek.png',
};

export default function AiAppActionSheet({ visible, onClose, copiedText, onOpenApp }: Props) {
  const [apps, setApps] = useState<AiAppInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    // 浏览器端无法检测已安装 App，scheme 跳转又常失败 → 直接显示成功卡片，不再列 LOGO
    if (!isNativeWebView()) return;
    setLoading(true);
    checkInstalledAiApps()
      .then(setApps)
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, [visible]);

  const handleOpenApp = useCallback(
    async (app: AiAppInfo) => {
      if (onOpenApp) {
        await onOpenApp(app);
      } else {
        await openAiApp(app);
        onClose();
      }
    },
    [onOpenApp, onClose],
  );

  // 浏览器端「点击这里复制」：再次把口令写入剪贴板，关闭弹窗去 AI 窗口粘贴
  const handleSelfService = useCallback(async () => {
    if (copiedText) {
      try {
        await navigator.clipboard?.writeText(copiedText);
      } catch {
        /* 忽略，剪贴板可能已在打开弹窗前写好 */
      }
    }
    onClose();
  }, [copiedText, onClose]);

  if (!visible) return null;

  return (
    <div className="ai-action-sheet-overlay" onClick={onClose}>
      <div
        ref={sheetRef}
        className="ai-action-sheet-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {!isNativeWebView() ? (
          /* 浏览器端：复制成功提示 + 打勾动效，引导去 AI 粘贴 */
          <div className="ai-action-sheet__success">
            <svg className="ai-action-sheet__check" viewBox="0 0 52 52" aria-hidden="true">
              <circle className="ai-action-sheet__check-ring" cx="26" cy="26" r="24" fill="none" />
              <path className="ai-action-sheet__check-path" fill="none" d="M14 27l8 8 16-16" />
            </svg>
            <p className="ai-action-sheet__success-title">{L('复制口令成功', 'Share code copied')}</p>

            <div className="ai-action-sheet__footer">
              <button
                type="button"
                className="ai-action-sheet__self-service"
                onClick={handleSelfService}
              >
                {L('去AI智能体对话窗口直接粘贴', 'Open an AI chat app and paste there')}
              </button>
            </div>
            <p className="ai-action-sheet__success-note">
              {L(
                '不同AI表现有差异，可能出现幻觉，可切换不同AI尝试',
                'Different AIs perform differently — hallucinations may occur. Try switching AIs if needed.',
              )}
            </p>
            <button
              type="button"
              className="ai-action-sheet__cancel"
              onClick={onClose}
            >
              {L('取消', 'Cancel')}
            </button>
          </div>
        ) : (
          <>
            {/* 标题 */}
            <div className="ai-action-sheet__header">
              {copiedText ? (
                <p className="ai-action-sheet__title">{L('✓ 指令已复制', '✓ Prompt copied')}</p>
              ) : (
                <p className="ai-action-sheet__title">{L('选择 AI 应用打开', 'Choose an AI app to open')}</p>
              )}
            </div>

            {loading ? (
              <div className="ai-action-sheet__loading">{L('检测中…', 'Detecting…')}</div>
            ) : apps.length === 0 ? (
              <div className="ai-action-sheet__empty">
                <p>{L('未检测到 AI 应用', 'No AI app detected')}</p>
                <p className="ai-action-sheet__empty-hint">
                  {L('请先安装 ChatGPT、Kimi 或豆包等应用', 'Please install ChatGPT, Kimi, Doubao, etc. first.')}
                </p>
              </div>
            ) : (
              <div className="ai-action-sheet__list">
                {apps.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    className="ai-action-sheet__item"
                    onClick={() => handleOpenApp(app)}
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
                {L('复制好了，自己打开', "It's copied — open it myself")}
              </button>
            </div>

            {/* 取消按钮 */}
            <button
              type="button"
              className="ai-action-sheet__cancel"
              onClick={onClose}
            >
              {L('取消', 'Cancel')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
