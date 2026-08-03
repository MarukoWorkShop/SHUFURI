import { useCallback, useEffect, useId, useRef } from 'react';
import type { LangCode } from '../services/appSettings';
import { L } from '../utils/i18n';

type Props = {
  /** 检测到的歌名 */
  songTitle: string;
  /** 检测到的歌手（可选） */
  artist?: string;
  /** 结构化歌词声明的语言（可选） */
  language?: LangCode;
  /** 卡片可见 */
  visible: boolean;
  /** 点击「一键渲染排版」回调 */
  onRenderLayout: () => void;
  /** 点击「取消」或遮罩层回调 */
  onDismiss: () => void;
};

const LANGUAGE_LABELS: Record<LangCode, string> = {
  jp: '日本語',
  ko: '한국어',
  en: 'ENG',
  zh: '中文',
};

function formatLanguageLabel(language?: LangCode): string {
  if (!language) return 'AUTO';
  return LANGUAGE_LABELS[language];
}

export default function ClipboardDetectCard({
  songTitle,
  artist,
  language,
  visible,
  onRenderLayout,
  onDismiss,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

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
      <div
        ref={cardRef}
        className="clipboard-detect-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="clipboard-detect-card__field">
          <span className="clipboard-detect-card__label">{L('歌名', 'Title')}</span>
          <p id={titleId} className="clipboard-detect-card__value clipboard-detect-card__value--title">
            《{songTitle}》
          </p>
        </div>

        <div className="clipboard-detect-card__field">
          <span className="clipboard-detect-card__label">{L('歌手', 'Artist')}</span>
          <p className="clipboard-detect-card__value">{artist?.trim() || '—'}</p>
        </div>

        <div className="clipboard-detect-card__field">
          <span className="clipboard-detect-card__label">{L('语言', 'Language')}</span>
          <p className="clipboard-detect-card__value">{formatLanguageLabel(language)}</p>
        </div>

        <div className="clipboard-detect-card__actions">
          <button
            type="button"
            className="btn-tonal clipboard-detect-card__btn"
            onClick={onDismiss}
          >
            {L('取消', 'Cancel')}
          </button>
          <button
            type="button"
            className="btn-filled clipboard-detect-card__btn"
            onClick={onRenderLayout}
          >
            {L('一键渲染排版', 'Render Layout')}
          </button>
        </div>
      </div>
    </div>
  );
}
