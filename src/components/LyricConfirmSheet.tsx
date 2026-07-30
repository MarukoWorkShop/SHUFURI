import { useCallback, useEffect, useId, useState } from 'react';
import { getAppSettings, type LangCode } from '../services/appSettings';
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
  /** 最近一次词解与语法是否来自缓存 */
  studyFromCache?: boolean;
  onReanalyze?: () => void;
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
  studyFromCache = false,
  onReanalyze,
  onConfirmLayout,
  onConfirmStudy,
  onFallbackExternal,
  onDismiss,
}: Props) {
  const titleId = useId();
  // 界面语言（P1 散点切换；切换时 App 重渲染会传导新值）
  const iface = getAppSettings().interfaceLanguage;
  const L = (zh: string, en: string) => (iface === 'en' ? en : zh);
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
          <p className="lyric-confirm-sheet__eyebrow">{L('确认歌词', 'Confirm Lyrics')}</p>
          <h2 id={titleId} className="lyric-confirm-sheet__title">
            《{songTitle}》
          </h2>
          <p className="lyric-confirm-sheet__meta">
            <span>{artist?.trim() || L('佚名', 'Unknown')}</span>
            <span aria-hidden>·</span>
            <span>{language ? LANGUAGE_LABELS[language] : 'AUTO'}</span>
            <span aria-hidden>·</span>
            <span>{L(`${lineCount} 行`, `${lineCount} lines`)}</span>
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
          <span>{L('AI自动补充词语与语法讲解', 'AI Vocab & Grammar Generation')}</span>
          <span className="lyric-confirm-sheet__pro-badge" title={L('PRO 功能', 'PRO Feature')}>PRO</span>
        </label>
        <p className="lyric-confirm-sheet__subhint">
          {L('语法级别可在首页「系统设置」中设置', 'Grammar level can be adjusted in Home > Settings.')}
        </p>

        {studyError ? (
          <p className="lyric-confirm-sheet__hint lyric-confirm-sheet__hint--error">
            <strong>{L('内部生成失败：', 'Internal generation failed:')}</strong>
            {studyError}
            <br />
            {L('可点击下方按钮重试，或改用外部 AI 口令继续。', 'Tap below to retry, or use an external AI prompt.')}
          </p>
        ) : (
          <p className="lyric-confirm-sheet__hint">
            {isGeneratingStudy
              ? L('AI 正在生成词解与语法讲解，请稍候…', 'AI generating vocab & grammar, please wait…')
              : wantStudy
                ? L('确认后由 AI 自动补充词语与语法讲解，并合并排版。', 'After confirming, AI will auto-fill vocab & grammar and format the layout.')
                : L('不需要词解时，确认后直接排版预览。', 'If no vocabulary is needed, confirm to view the layout preview.')}
          </p>
        )}

        {/* 缓存命中标识 + 重新 AI 分析按钮 */}
        {studyFromCache && !studyError && !isGeneratingStudy && (
          <div className="lyric-confirm-sheet__cache-bar">
            <span className="lyric-confirm-sheet__cache-tag" title={L('此语法词解来自已有缓存，未消耗 AI 配额', 'Retrieved from cache. No AI quota consumed.')}>
              ⚡ {L('缓存 · ', 'Cached ·')}{'<'}1s
            </span>
            {onReanalyze && (
              <button
                type="button"
                className="lyric-confirm-sheet__cache-reanalyze-btn"
                onClick={onReanalyze}
                title={L('发现缓存数据有误？重新调用 AI 生成并覆盖旧缓存', 'Found an error in cached data? Regenerate with AI to overwrite.')}
              >
                {L('重新进行 AI 分析', 'Re-analyze with AI')}
              </button>
            )}
          </div>
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
                {L('改用外部 AI 口令', 'Use External AI Prompt')}
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
                    <span>{L('生成中…', 'Generating…')}</span>
                  </>
                ) : (
                  L('重试内部生成', 'Retry Internal Generation')
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
                title={L('歌词不对，返回首页重新粘贴', 'Incorrect lyrics? Go back to Home and re-paste.')}
              >
                {L('歌词不对，返回重试', 'Incorrect lyrics? Go back and retry.')}
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
                    <span>{L('生成中…', 'Generating…')}</span>
                  </>
                ) : wantStudy ? (
                  <>
                    <ArrowRightIcon size={16} />
                    <span>{L('去生成学习材料', 'Generate Study Materials')}</span>
                  </>
                ) : (
                  L('确认并排版', 'Confirm & Format')
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
