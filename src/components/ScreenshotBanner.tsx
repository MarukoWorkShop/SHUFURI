/**
 * 发现音乐分享横幅提示
 *
 * 当用户从 QQ 音乐等 App 截屏后打开 SHUFURI 时，
 * 在顶部显示横幅："发现音乐分享，要帮你搜索歌词吗？"
 */
import { useCallback } from 'react';

type Props = {
  songTitle?: string;
  artist?: string;
  onConfirm: (title: string, artist: string) => void;
  onDismiss: () => void;
};

export function ScreenshotBanner({ songTitle, artist, onConfirm, onDismiss }: Props) {
  const handleConfirm = useCallback(() => {
    onConfirm(songTitle || '', artist || '');
  }, [songTitle, artist, onConfirm]);

  const displayText = songTitle
    ? `识别到「${artist || '佚名'}《${songTitle}》」`
    : '发现音乐分享，要帮你搜索歌词吗？';

  return (
    <div className="screenshot-banner">
      <span className="screenshot-banner__text">{displayText}</span>
      {songTitle ? (
        <>
          <button
            type="button"
            className="screenshot-banner__yes"
            onClick={handleConfirm}
          >
            开始生成
          </button>
          <button
            type="button"
            className="screenshot-banner__no"
            onClick={onDismiss}
          >
            忽略
          </button>
        </>
      ) : (
        <button
          type="button"
          className="screenshot-banner__no"
          onClick={onDismiss}
        >
          关闭
        </button>
      )}
    </div>
  );
}
