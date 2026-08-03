import { useEffect, useRef } from 'react';
import { L } from '../utils/i18n';
import { useHomeSessionContext } from '../context/HomeSessionContext';

/**
 * 自动读剪贴板失败时的兜底 modal：让用户用系统粘贴手势（Cmd+V / 长按 / iOS 键盘剪贴板）
 * 将内容写入 textarea，再走同一套检测逻辑。
 *
 * 触发场景：iOS WKWebView 非 focused 状态、Capacitor Clipboard 插件未注册、
 * 浏览器拒绝 readText 权限等。
 */
export default function ManualPasteModal() {
  const {
    manualPasteOpen,
    manualPasteText,
    setManualPasteText,
    handleManualPasteSubmit,
    handleManualPasteCancel,
  } = useHomeSessionContext();

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 打开时聚焦 textarea，让用户立即可以 Cmd+V / 长按粘贴
  useEffect(() => {
    if (!manualPasteOpen) return;
    const t = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(t);
  }, [manualPasteOpen]);

  if (!manualPasteOpen) return null;

  return (
    <div
      className="manual-paste-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={L('手动粘贴', 'Paste manually')}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleManualPasteCancel();
      }}
    >
      <div className="manual-paste-modal__panel">
        <h3 className="manual-paste-modal__title">
          {L('手动粘贴', 'Paste Manually')}
        </h3>
        <p className="manual-paste-modal__hint">
          {L(
            '系统未授权自动读取剪贴板。请长按或使用 ⌘V 将剪贴板返回的内容粘贴到下方文本框。',
            'Clipboard auto-read is blocked. Long-press or press ⌘V to paste clipboard content into the field below.',
          )}
        </p>
        <textarea
          ref={textareaRef}
          className="manual-paste-modal__textarea"
          value={manualPasteText}
          onChange={(e) => setManualPasteText(e.target.value)}
          placeholder={L('在这里粘贴剪贴板返回的内容…', 'Paste clipboard content here…')}
          rows={10}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
        <div className="manual-paste-modal__actions">
          <button
            type="button"
            className="manual-paste-modal__btn manual-paste-modal__btn--ghost"
            onClick={handleManualPasteCancel}
          >
            {L('取消', 'Cancel')}
          </button>
          <button
            type="button"
            className="manual-paste-modal__btn manual-paste-modal__btn--primary"
            disabled={!manualPasteText.trim()}
            onClick={() => handleManualPasteSubmit()}
          >
            {L('识别并排版', 'Detect & Format')}
          </button>
        </div>
      </div>
    </div>
  );
}
