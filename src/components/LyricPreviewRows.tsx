import type { LyricPreviewLine } from '../utils/lyricConfirm';

/**
 * 逐行歌词预览（与 LyricConfirmSheet 完全一致的可视样式）。
 * 纯展示组件：流式揭示由调用方通过 visibleLineCount 控制，
 * 以便 LyricConfirmSheet 保留其既有逐行动画行为。
 */
export function LyricPreviewRows({
  lines,
  streamingDelayMs = 0,
  visibleLineCount,
}: {
  lines: LyricPreviewLine[];
  streamingDelayMs?: number;
  visibleLineCount?: number;
}) {
  const resolved = visibleLineCount ?? lines.length;

  return (
    <div
      className={`lyric-confirm-sheet__preview${streamingDelayMs > 0 ? ' lyric-confirm-sheet__preview--streaming' : ''}`}
      aria-label="歌词预览"
    >
      {lines.map((line) => {
        const isVisible = streamingDelayMs <= 0 || line.index <= resolved;
        return (
          <div
            key={line.index}
            className={`lyric-confirm-sheet__line${
              isVisible ? ' lyric-confirm-sheet__line--reveal' : ' lyric-confirm-sheet__line--hidden'
            }`}
            style={
              streamingDelayMs > 0 && isVisible
                ? { animationDelay: `${Math.min((line.index - 1) * 0.03, 0.6)}s` }
                : undefined
            }
          >
            <span className="lyric-confirm-sheet__line-no">{line.index}</span>
            <span className="lyric-confirm-sheet__line-text">
              {line.text}
              {line.gloss ? (
                <span className="lyric-confirm-sheet__line-gloss"> {line.gloss}</span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
