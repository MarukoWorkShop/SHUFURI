import { useCallback, useEffect, useId, useState } from 'react';
import type { LangCode } from '../services/appSettings';
import type { LyricPreviewLine } from '../utils/lyricConfirm';
import { LyricPreviewRows } from './LyricPreviewRows';
import ArrowRightIcon from './icons/ArrowRightIcon';

type Props = {
  visible: boolean;
  songTitle: string;
  artist?: string;
  language?: LangCode;
  lineCount: number;
  previewLines: LyricPreviewLine[];
  /** 逐行流式动画间隔(ms)，0 表示全部立即显示 */
  streamingDelayMs?: number;
  /** 是否正在内部生成学习材料 */
  isGeneratingStudy?: boolean;
  /** 内部生成学习材料的错误信息 */
  studyError?: string | null;
  onConfirmLayout: () => void;
  onConfirmStudy: () => void;
  onFallbackExternal: () => void;
  /** 旧"复制口令重试"，已改为返回首页（onDismiss）；保留可选以兼容外部传值 */
  onRetry?: () => void;
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
  streamingDelayMs = 0,
  isGeneratingStudy = false,
  studyError,
  onConfirmLayout,
  onConfirmStudy,
  onFallbackExternal,
  onDismiss,
}: Props) {
  const titleId = useId();
  // 默认开启内部 AI 生成，用户可手动关闭
  const [wantStudy, setWantStudy] = useState(true);
  /** 流式模式下，当前已显示的最后一行索引（-1 = 尚未开始） */
  const [visibleLineCount, setVisibleLineCount] = useState(-1);

  // 打开/关闭时重置流式状态
  useEffect(() => {
    if (visible) {
      setWantStudy(true);
      if (streamingDelayMs > 0) {
        setVisibleLineCount(-1);
      } else {
        setVisibleLineCount(previewLines.length);
      }
    }
  }, [visible, streamingDelayMs, previewLines.length]);

  // 流式逐行动画：用 setTimeout 逐行显示
  useEffect(() => {
    if (!visible || streamingDelayMs <= 0) return;
    if (visibleLineCount >= previewLines.length) return;

    const timer = setTimeout(() => {
      setVisibleLineCount((prev) => Math.min(prev + 1, previewLines.length));
    }, visibleLineCount < 0 ? 120 : streamingDelayMs);

    return () => clearTimeout(timer);
  }, [visible, streamingDelayMs, visibleLineCount, previewLines.length]);

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
    if (isGeneratingStudy) return;
    if (wantStudy) onConfirmStudy();
    else onConfirmLayout();
  }, [isGeneratingStudy, wantStudy, onConfirmLayout, onConfirmStudy]);

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

        <LyricPreviewRows
          lines={previewLines}
          streamingDelayMs={streamingDelayMs}
          visibleLineCount={visibleLineCount}
        />

        <label className="lyric-confirm-sheet__check">
          <input
            type="checkbox"
            checked={wantStudy}
            onChange={(e) => setWantStudy(e.target.checked)}
          />
          <span>AI自动补充词语与语法讲解</span>
          <span className="lyric-confirm-sheet__pro-badge" title="PRO 功能">PRO</span>
        </label>
        <p className="lyric-confirm-sheet__subhint">
          语法级别可在首页「系统设置」中设置
        </p>

        {studyError ? (
          <p className="lyric-confirm-sheet__hint lyric-confirm-sheet__hint--error">
            <strong>内部生成失败：</strong>
            {studyError}
            <br />
            可点击下方按钮重试，或改用外部 AI 口令继续。
          </p>
        ) : (
          <p className="lyric-confirm-sheet__hint">
            {isGeneratingStudy
              ? 'AI 正在生成词解与语法讲解，请稍候…'
              : wantStudy
                ? '确认后由 AI 自动补充词语与语法讲解，并合并排版。'
                : '不需要词解时，确认后直接排版预览。'}
          </p>
        )}

        <div className="lyric-confirm-sheet__actions">
          {studyError ? (
            <>
              <button
                type="button"
                className="btn-tonal lyric-confirm-sheet__btn"
                onClick={onFallbackExternal}
                disabled={isGeneratingStudy}
              >
                改用外部 AI 口令
              </button>
              <button
                type="button"
                className="btn-filled lyric-confirm-sheet__btn lyric-confirm-sheet__btn--primary"
                onClick={onConfirmStudy}
                disabled={isGeneratingStudy}
              >
                {isGeneratingStudy ? (
                  <>
                    <span className="lyric-confirm-sheet__spinner" aria-hidden />
                    <span>生成中…</span>
                  </>
                ) : (
                  '重试内部生成'
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn-tonal lyric-confirm-sheet__btn"
                onClick={onDismiss}
                disabled={isGeneratingStudy}
                title="歌词不对，返回首页重新粘贴"
              >
                歌词不对，返回重试
              </button>
              <button
                type="button"
                className="btn-filled lyric-confirm-sheet__btn lyric-confirm-sheet__btn--primary"
                onClick={handlePrimary}
                disabled={isGeneratingStudy}
              >
                {isGeneratingStudy ? (
                  <>
                    <span className="lyric-confirm-sheet__spinner" aria-hidden />
                    <span>生成中…</span>
                  </>
                ) : wantStudy ? (
                  <>
                    <ArrowRightIcon size={16} />
                    <span>去生成学习材料</span>
                  </>
                ) : (
                  '确认并排版'
                )}
              </button>
            </>
          )}
        </div>

        {isGeneratingStudy && <div className="lyric-confirm-sheet__loading-overlay" aria-busy />}
      </div>
    </div>
  );
}
