import { useCallback, useEffect, useId, useState } from 'react';
import type { LangCode } from '../services/appSettings';
import type { LyricPreviewLine } from '../utils/lyricConfirm';
import ArrowRightIcon from './icons/ArrowRightIcon';

type Props = {
  visible: boolean;
  songTitle: string;
  artist?: string;
  language?: LangCode;
  lineCount: number;
  previewLines: LyricPreviewLine[];
  onConfirmLayout: () => void;
  onConfirmStudy: () => void;
  onRetry: () => void;
  onDismiss: () => void;
};

const LANGUAGE_LABELS: Record<LangCode, string> = {
  jp: 'JAP',
  ko: 'KOR',
  en: 'ENG',
  zh: 'ZH',
};

export default function LyricConfirmSheet({
  visible,
  songTitle,
  artist,
  language,
  lineCount,
  previewLines,
  onConfirmLayout,
  onConfirmStudy,
  onRetry,
  onDismiss,
}: Props) {
  const titleId = useId();
  const [wantStudy, setWantStudy] = useState(false);

  useEffect(() => {
    if (visible) setWantStudy(false);
  }, [visible]);

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

  const handlePrimary = useCallback(() => {
    if (wantStudy) onConfirmStudy();
    else onConfirmLayout();
  }, [wantStudy, onConfirmLayout, onConfirmStudy]);

  if (!visible) return null;

  return (
    <div className="lyric-confirm-overlay" onClick={handleOverlayClick}>
      <div
        className="lyric-confirm-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="lyric-confirm-sheet__handle" aria-hidden />

        <header className="lyric-confirm-sheet__header">
          <p className="lyric-confirm-sheet__eyebrow">确认歌词</p>
          <h2 id={titleId} className="lyric-confirm-sheet__title">
            《{songTitle}》
          </h2>
          <p className="lyric-confirm-sheet__meta">
            <span>{artist?.trim() || '佚名'}</span>
            <span aria-hidden>·</span>
            <span>{language ? LANGUAGE_LABELS[language] : 'AUTO'}</span>
            <span aria-hidden>·</span>
            <span>{lineCount} 行</span>
          </p>
        </header>

        <div className="lyric-confirm-sheet__preview" aria-label="歌词预览">
          {previewLines.map((line) => (
            <div key={line.index} className="lyric-confirm-sheet__line">
              <span className="lyric-confirm-sheet__line-no">{line.index}</span>
              <span className="lyric-confirm-sheet__line-text">
                {line.text}
                {line.gloss ? (
                  <span className="lyric-confirm-sheet__line-gloss"> {line.gloss}</span>
                ) : null}
              </span>
            </div>
          ))}
        </div>

        <label className="lyric-confirm-sheet__check">
          <input
            type="checkbox"
            checked={wantStudy}
            onChange={(e) => setWantStudy(e.target.checked)}
          />
          <span>让系统为我生成词解与语法讲解</span>
        </label>

        <p className="lyric-confirm-sheet__hint">
          {wantStudy
            ? '确认后将复制「学习材料口令」；粘贴 AI 结果后与本页歌词合并排版。'
            : '不需要词解时，确认后直接排版预览。'}
        </p>

        <div className="lyric-confirm-sheet__actions">
          <button type="button" className="btn-tonal lyric-confirm-sheet__btn" onClick={onRetry}>
            重试
          </button>
          <button
            type="button"
            className="btn-filled lyric-confirm-sheet__btn lyric-confirm-sheet__btn--primary"
            onClick={handlePrimary}
          >
            {wantStudy ? (
              <>
                <ArrowRightIcon size={16} />
                <span>去生成学习材料</span>
              </>
            ) : (
              '确认并排版'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
