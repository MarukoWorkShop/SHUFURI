import { useEffect, useRef, useState } from 'react';
import { listSavedLyricsProjects } from '../services/savedLyricsStore';
import type { SavedLyricsProject } from '../services/savedLyricsStore';
import {
  renderBatchPdf,
  deliverBatchPdf,
  type BatchSongResult,
} from '../utils/batchExportPdf';
import type { PosterLayoutProfile } from '../utils/shufuriPoster/types';

type Phase = 'select' | 'rendering' | 'finish' | 'done';

interface BatchExportPanelProps {
  onClose: () => void;
  /** 受控可见性，由父组件条件渲染时通常恒为 true；传 false 时不渲染 */
  open?: boolean;
  /** 来自歌词库的预选集（已勾选的歌词本），提供时直接进入尺寸选择并预填勾选 */
  initialSelectedProjects?: SavedLyricsProject[];
}

const PROFILE_OPTIONS: { key: string; label: string; dim: string; desc: string; profile: PosterLayoutProfile }[] = [
  { key: 'b5', label: 'B5 打印', dim: '600 × 852', desc: '适合 A4/B5 纸打印，体积小、清晰', profile: 'clipPosterPrint' },
  { key: 'mobile', label: '手机竖屏', dim: '1080 × 1920', desc: '适合手机阅读 / 长图，高清', profile: 'mobilePoster' },
];

export function BatchExportPanel({ onClose, open = true, initialSelectedProjects }: BatchExportPanelProps) {
  if (open === false) return null;
  const [phase, setPhase] = useState<Phase>('select');
  const [items, setItems] = useState<SavedLyricsProject[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialSelectedProjects?.map((p) => p.id) ?? [])
  );
  const [selectedProfile, setSelectedProfile] = useState<PosterLayoutProfile>('clipPosterPrint');
  const [error, setError] = useState<string | null>(null);

  // 逐首状态
  const [songStates, setSongStates] = useState<Record<string, BatchSongResult>>({});
  const [currentTitle, setCurrentTitle] = useState<string>('');
  const [doneCount, setDoneCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const pdfRef = useRef<import('jspdf').jsPDF | null>(null);
  const lastResultsRef = useRef<BatchSongResult[]>([]);

  useEffect(() => {
    listSavedLyricsProjects()
      .then((list) => setItems(list as SavedLyricsProject[]))
      .catch(() => setItems([]));
  }, []);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedProjects = items.filter((it) => selectedIds.has(it.id));

  const onSongStart = (id: string, title: string) => {
    setCurrentTitle(title);
    setSongStates((prev) => ({ ...prev, [id]: { id, title, status: 'rendering', pages: 0 } }));
  };
  const onSongDone = (id: string, pages: number) => {
    setSongStates((prev) => ({ ...prev, [id]: { id, title: prev[id]?.title ?? '', status: 'done', pages } }));
    setDoneCount((c) => c + 1);
  };
  const onSongError = (id: string, title: string, message: string) => {
    setSongStates((prev) => ({ ...prev, [id]: { id, title, status: 'failed', error: message, pages: 0 } }));
  };

  const runExport = async (projects: SavedLyricsProject[], existingPdf?: import('jspdf').jsPDF) => {
    setPhase('rendering');
    setError(null);
    setCurrentTitle('');
    if (!existingPdf) {
      setSongStates({});
      setDoneCount(0);
      setTotalCount(projects.length);
    }
    try {
      const { pdf, results } = await renderBatchPdf({
        targetProfile: selectedProfile,
        projects,
        existingPdf,
        onSongStart,
        onSongDone,
        onSongError,
      });
      pdfRef.current = pdf;
      // 合并结果：续写时用新结果覆盖对应项
      const merged = existingPdf
        ? lastResultsRef.current.map((r) => results.find((x) => x.id === r.id) ?? r)
        : results;
      lastResultsRef.current = merged;
      setPhase('finish');
    } catch (e) {
      setError(e instanceof Error ? e.message : '批量导出初始化失败');
      setPhase('finish');
    }
  };

  const handleStart = () => {
    if (selectedProjects.length === 0) {
      setError('请至少选择一首歌词');
      return;
    }
    void runExport(selectedProjects);
  };

  const failedProjects = () =>
    lastResultsRef.current
      .filter((r) => r.status === 'failed')
      .map((r) => selectedProjects.find((p) => p.id === r.id))
      .filter(Boolean) as SavedLyricsProject[];

  const succeededCount = () => lastResultsRef.current.filter((r) => r.status === 'done').length;

  // 完成阶段：无失败项则自动交付
  useEffect(() => {
    if (phase !== 'finish') return;
    const failed = lastResultsRef.current.filter((r) => r.status === 'failed');
    if (failed.length === 0 && pdfRef.current) {
      const total = lastResultsRef.current.length;
      deliverBatchPdf(pdfRef.current, `shufuri-lyrics-batch-${total}-songs.pdf`)
        .then(() => setPhase('done'))
        .catch((e) => setError(e instanceof Error ? e.message : '交付失败'));
    }
  }, [phase]);

  const handleRetryFailed = () => {
    const failed = failedProjects();
    if (failed.length === 0) return;
    void runExport(failed, pdfRef.current ?? undefined);
  };

  const handleSkipAndDownload = () => {
    if (!pdfRef.current || succeededCount() === 0) return;
    deliverBatchPdf(pdfRef.current, `shufuri-lyrics-batch-${succeededCount()}-songs.pdf`)
      .then(() => setPhase('done'))
      .catch((e) => setError(e instanceof Error ? e.message : '交付失败'));
  };

  const handleOverlayClick = () => {
    if (phase === 'select') onClose();
  };

  return (
    <div className="batch-export-overlay" onClick={handleOverlayClick}>
      <div className="batch-export-card" onClick={(e) => e.stopPropagation()}>
        {phase === 'select' && (
          <>
            <h3 className="batch-export-card__title">批量导出 PDF</h3>
            <p className="batch-export-card__hint">勾选要导出的歌词本，选择尺寸后开始。</p>
            <div className="batch-export-sizes">
              {PROFILE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  className={`batch-export-size-card${selectedProfile === opt.profile ? ' is-active' : ''}`}
                  onClick={() => setSelectedProfile(opt.profile)}
                >
                  <span className="batch-export-size-card__label">{opt.label}</span>
                  <span className="batch-export-size-card__dim">{opt.dim}</span>
                  <span className="batch-export-size-card__desc">{opt.desc}</span>
                </button>
              ))}
            </div>
            <div className="batch-export-select-list">
              {items.map((it) => (
                <label key={it.id} className="batch-export-select-item">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(it.id)}
                    onChange={() => toggle(it.id)}
                  />
                  <span>{it.title || '未命名歌词'}</span>
                </label>
              ))}
              {items.length === 0 && <p className="batch-export-card__hint">暂存库为空</p>}
            </div>
            {error && <p className="batch-export-error">{error}</p>}
            <div className="batch-export-actions">
              <button className="batch-export-btn batch-export-btn--secondary" onClick={onClose}>
                取消
              </button>
              <button
                className="batch-export-btn batch-export-btn--primary"
                onClick={handleStart}
                disabled={selectedProjects.length === 0}
              >
                导出 {selectedProjects.length > 0 ? `(${selectedProjects.length})` : ''}
              </button>
            </div>
          </>
        )}

        {phase === 'rendering' && (
          <div className="batch-export-progress">
            <p className="batch-export-progress__text">
              正在导出 {doneCount} / {totalCount}
            </p>
            <p className="batch-export-progress__song">{currentTitle || '准备中…'}</p>
            <div className="batch-export-progress__bar">
              <div
                className="batch-export-progress__fill"
                style={{ width: totalCount ? `${(doneCount / totalCount) * 100}%` : '0%' }}
              />
            </div>
            <ul className="batch-export-song-list">
              {Object.values(songStates).map((s) => (
                <li key={s.id} className={`batch-export-song-item is-${s.status}`}>
                  <span className="batch-export-song-item__icon">
                    {s.status === 'done' ? '✓' : s.status === 'failed' ? '✕' : '…'}
                  </span>
                  <span className="batch-export-song-item__title">{s.title}</span>
                  {s.status === 'failed' && (
                    <span className="batch-export-song-item__err">{s.error}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {phase === 'finish' && (
          <div className="batch-export-finish">
            <h3 className="batch-export-card__title">导出完成</h3>
            <ul className="batch-export-song-list">
              {lastResultsRef.current.map((s) => (
                <li key={s.id} className={`batch-export-song-item is-${s.status}`}>
                  <span className="batch-export-song-item__icon">
                    {s.status === 'done' ? '✓' : '✕'}
                  </span>
                  <span className="batch-export-song-item__title">{s.title}</span>
                  {s.status === 'failed' && (
                    <span className="batch-export-song-item__err">{s.error}</span>
                  )}
                </li>
              ))}
            </ul>
            {error && <p className="batch-export-error">{error}</p>}
            <div className="batch-export-actions">
              <button className="batch-export-btn batch-export-btn--secondary" onClick={onClose}>
                取消
              </button>
              {failedProjects().length > 0 && (
                <button className="batch-export-btn batch-export-btn--secondary" onClick={handleRetryFailed}>
                  重试失败项
                </button>
              )}
              {succeededCount() > 0 ? (
                <button className="batch-export-btn batch-export-btn--primary" onClick={handleSkipAndDownload}>
                  下载（{succeededCount()}）
                </button>
              ) : (
                <button className="batch-export-btn batch-export-btn--primary" disabled>
                  无成功项
                </button>
              )}
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="batch-export-done">
            <div className="batch-export-done__icon-wrap">
              <svg viewBox="0 0 52 52" className="batch-export-done__check-svg">
                <circle className="batch-export-done__circle" cx="26" cy="26" r="24" />
                <path className="batch-export-done__check" d="M14 27 L23 36 L39 18" />
              </svg>
            </div>
            <p className="batch-export-done__text">PDF 已交付</p>
            <div className="batch-export-actions">
              <button className="batch-export-btn batch-export-btn--primary" onClick={onClose}>
                完成
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BatchExportPanel;
