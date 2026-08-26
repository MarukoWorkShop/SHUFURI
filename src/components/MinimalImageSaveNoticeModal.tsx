import { useState } from 'react';
import { L } from '../utils/i18n';
import { setMinimalImageSaveNoticeDismissed } from '../utils/minimalImageSaveNotice';

type Props = {
  open: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
};

/**
 * 极简版式已插入封面图时，保存到歌词库前的说明弹窗。
 * 「我知道了」继续保存；可选「下次不再提醒」。
 */
export default function MinimalImageSaveNoticeModal({ open, onConfirm, onCancel }: Props) {
  const [dontRemind, setDontRemind] = useState(false);

  if (!open) return null;

  const handleConfirm = () => {
    if (dontRemind) setMinimalImageSaveNoticeDismissed(true);
    setDontRemind(false);
    onConfirm();
  };

  const handleCancel = () => {
    setDontRemind(false);
    onCancel?.();
  };

  return (
    <div
      className="manual-paste-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="minimal-image-save-notice-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div className="manual-paste-modal__panel minimal-image-save-notice">
        <h3 id="minimal-image-save-notice-title" className="manual-paste-modal__title">
          {L('封面图片不会入库', 'Cover image won’t be saved')}
        </h3>
        <p className="manual-paste-modal__hint">
          {L(
            '图片无法保存在歌词库中，只能导出为 PDF 保存。歌词与排版仍会照常写入「我的歌词库」。',
            'Images cannot be saved in the lyrics library—export as PDF to keep the cover. Lyrics and layout will still be saved to My Lyrics.',
          )}
        </p>
        <label className="minimal-image-save-notice__check">
          <input
            type="checkbox"
            checked={dontRemind}
            onChange={(e) => setDontRemind(e.target.checked)}
          />
          <span>{L('下次不再提醒', 'Don’t remind me again')}</span>
        </label>
        <div className="manual-paste-modal__actions">
          {onCancel ? (
            <button
              type="button"
              className="manual-paste-modal__btn manual-paste-modal__btn--ghost"
              onClick={handleCancel}
            >
              {L('取消', 'Cancel')}
            </button>
          ) : null}
          <button
            type="button"
            className="manual-paste-modal__btn manual-paste-modal__btn--primary"
            onClick={handleConfirm}
          >
            {L('我知道了', 'Got it')}
          </button>
        </div>
      </div>
    </div>
  );
}
