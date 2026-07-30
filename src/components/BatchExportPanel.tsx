import { useState, useCallback } from 'react';
import { L } from '../utils/i18n';
import type { PosterLayoutProfile } from '../utils/shufuriPoster/types';
import { executeBatchExport } from '../utils/batchExportPdf';
import type { BatchExportProgress } from '../utils/batchExportPdf';

/* ---------- 尺寸选项 ---------- */

interface SizeOption {
  profile: PosterLayoutProfile;
  label: string;
  activeLabel: string;
  desc: string;
  dimLabel: string;
}

const SIZE_OPTIONS: SizeOption[] = [
  {
    profile: 'clipPosterPrint',
    label: L('打印尺寸', 'Print'),
    activeLabel: L('打印尺寸 (A5/B5)', 'Print (A5/B5)'),
    desc: L('600×852 像素，适合 A5/B5/B6 纸张打印', '600×852 px, fits A5/B5/B6 paper'),
    dimLabel: '600 × 852 px',
  },
  {
    profile: 'squarePoster',
    label: L('1:1 方形', '1:1 Square'),
    activeLabel: L('1:1 方形', '1:1 Square'),
    desc: L('1080×1080 像素，适合社交媒体分享', '1080×1080 px, social media'),
    dimLabel: '1080 × 1080 px',
  },
  {
    profile: 'mobilePoster',
    label: L('手机预览', 'Mobile'),
    activeLabel: L('手机预览 (9:16)', 'Mobile (9:16)'),
    desc: L('1080×1920 像素，适合手机竖屏查看', '1080×1920 px, mobile portrait'),
    dimLabel: '1080 × 1920 px',
  },
];

/* ---------- Props ---------- */

export interface BatchExportPanelProps {
  open: boolean;
  onClose: () => void;
}

/* ---------- Component ---------- */

export default function BatchExportPanel({ open, onClose }: BatchExportPanelProps) {
  const [selectedProfile, setSelectedProfile] = useState<PosterLayoutProfile>('clipPosterPrint');
  const [phase, setPhase] = useState<'select' | 'exporting' | 'done'>('select');
  const [progress, setProgress] = useState<BatchExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStartExport = useCallback(async () => {
    setPhase('exporting');
    setError(null);
    setProgress(null);

    try {
      await executeBatchExport(selectedProfile, (p) => setProgress({ ...p }));
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败，请重试');
      setPhase('select');
    }
  }, [selectedProfile]);

  const handleClose = useCallback(() => {
    setPhase('select');
    setError(null);
    setProgress(null);
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="batch-export-overlay" onClick={handleClose}>
      <div
        className="batch-export-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <h3 className="batch-export-card__title">
          {L('批量导出 PDF', 'Batch Export PDF')}
        </h3>

        {/* 选择阶段 */}
        {phase === 'select' && (
          <>
            <p className="batch-export-card__hint">
              {L('将歌词本中全部歌词合并为一份 PDF，每首歌独立起页', 'Export all lyrics as one PDF — each song starts a new page')}
            </p>

            {/* 尺寸选项 */}
            <div className="batch-export-sizes">
              {SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.profile}
                  type="button"
                  className={`batch-export-size-card${
                    opt.profile === selectedProfile ? ' is-active' : ''
                  }`}
                  onClick={() => setSelectedProfile(opt.profile)}
                  aria-pressed={opt.profile === selectedProfile}
                  aria-label={opt.activeLabel}
                >
                  <span className="batch-export-size-card__label">{opt.activeLabel}</span>
                  <span className="batch-export-size-card__dim">{opt.dimLabel}</span>
                  <span className="batch-export-size-card__desc">{opt.desc}</span>
                </button>
              ))}
            </div>

            {/* 错误 */}
            {error && (
              <p className="batch-export-error">{error}</p>
            )}

            {/* 按钮 */}
            <div className="batch-export-actions">
              <button
                type="button"
                className="batch-export-btn batch-export-btn--secondary"
                onClick={handleClose}
              >
                {L('取消', 'Cancel')}
              </button>
              <button
                type="button"
                className="batch-export-btn batch-export-btn--primary"
                onClick={handleStartExport}
              >
                {L('开始导出', 'Start Export')}
              </button>
            </div>
          </>
        )}

        {/* 导出中 */}
        {phase === 'exporting' && progress && (
          <div className="batch-export-progress">
            <p className="batch-export-progress__text">
              {L('正在导出', 'Exporting')} {progress.current}/{progress.total}…
            </p>
            <p className="batch-export-progress__song">{progress.projectTitle}</p>
            <div className="batch-export-progress__bar">
              <div
                className="batch-export-progress__fill"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* 完成 */}
        {phase === 'done' && (
          <div className="batch-export-done">
            <div className="batch-export-done__icon-wrap">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path className="batch-export-done__check" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="batch-export-done__text">
              {L('导出完成', 'Export Complete')}
            </p>
            <button
              type="button"
              className="batch-export-btn batch-export-btn--primary"
              onClick={handleClose}
            >
              {L('关闭', 'Close')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
