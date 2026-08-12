import { useEffect } from 'react';
import './ExportImagePreviewSheet.css';
import { L } from '../utils/i18n';

export type ExportImagePreviewSheetProps = {
  blobUrl: string;
  filename: string;
  onClose: () => void;
};

/**
 * Web 端导出图片后的全屏预览层。
 * iOS/Android 浏览器无「写入系统相册」API，唯一可靠方式是让用户长按 <img>
 * 调起系统「存储图像」菜单；桌面浏览器可用「下载」按钮兜底。
 */
export function ExportImagePreviewSheet({ blobUrl, filename, onClose }: ExportImagePreviewSheetProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="export-img-sheet" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="export-img-sheet__stage" onClick={(e) => e.stopPropagation()}>
        <img className="export-img-sheet__img" src={blobUrl} alt={filename} />
      </div>
      <div className="export-img-sheet__bar" onClick={(e) => e.stopPropagation()}>
        <p className="export-img-sheet__hint">{L('长按图片即可保存到相册', 'Long-press the image to save to Photo Library')}</p>
        <div className="export-img-sheet__actions">
          <button type="button" className="export-img-sheet__btn" onClick={handleDownload}>
            {L('下载', 'Download')}
          </button>
          <button type="button" className="export-img-sheet__btn export-img-sheet__btn--close" onClick={onClose}>
            {L('关闭', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}
