import { useCallback, useEffect, useRef } from 'react';

type Props = {
  /** 检测到的歌名 */
  songTitle: string;
  /** 检测到的歌手（可选） */
  artist?: string;
  /** 卡片可见 */
  visible: boolean;
  /** 点击「一键渲染排版」回调 */
  onRenderLayout: () => void;
  /** 点击「取消」或遮罩层回调 */
  onDismiss: () => void;
};

export default function ClipboardDetectCard({
  songTitle,
  artist,
  visible,
  onRenderLayout,
  onDismiss,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  // ESC 键关闭
  useEffect(() => {
    if (!visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [visible, onDismiss]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onDismiss();
    },
    [onDismiss],
  );

  if (!visible) return null;

  return (
    <div className="clipboard-detect-overlay" onClick={handleOverlayClick}>
      <div ref={cardRef} className="clipboard-detect-card">
        {/* 图标 */}
        <div className="clipboard-detect-card__icon">📜</div>

        {/* 标题 */}
        <h2 className="clipboard-detect-card__title">
          检测到《{songTitle}》的歌词数据
        </h2>

        {/* 副标题 */}
        {artist && (
          <p className="clipboard-detect-card__subtitle">歌手：{artist}</p>
        )}

        {/* 按钮区域 */}
        <div className="clipboard-detect-card__actions">
          <button
            type="button"
            className="clipboard-detect-card__btn clipboard-detect-card__btn--cancel"
            onClick={onDismiss}
          >
            取消
          </button>
          <button
            type="button"
            className="clipboard-detect-card__btn clipboard-detect-card__btn--primary"
            onClick={onRenderLayout}
          >
            一键渲染排版
          </button>
        </div>

        {/* 底部小字 */}
        <p className="clipboard-detect-card__hint">已自动检测到结构化歌词数据</p>
      </div>
    </div>
  );
}
