import { useCallback, useEffect, useState } from 'react';
import {
  deleteSavedLyricsProject,
  listSavedLyricsProjects,
  type SavedLyricsProject,
} from '../services/savedLyricsStore';

type SavedLyricsLibraryProps = {
  onOpen: (project: SavedLyricsProject) => void;
  refreshKey?: number;
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SavedLyricsLibrary({ onOpen, refreshKey = 0 }: SavedLyricsLibraryProps) {
  const [items, setItems] = useState<SavedLyricsProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await listSavedLyricsProjects());
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`确定删除「${title}」？`)) return;
    await deleteSavedLyricsProject(id);
    await reload();
  };

  return (
    <section className="saved-library">
      <button
        type="button"
        className="saved-library-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="saved-library-panel"
      >
        <span className="saved-library-toggle-label">
          <span className="saved-library-title">我的歌词库</span>
          {!loading && (
            <span className="saved-library-count">总数 {items.length} 首</span>
          )}
        </span>
        <span className="saved-library-chevron" aria-hidden />
      </button>

      {expanded && (
        <div id="saved-library-panel" className="saved-library-panel">
          {loading && <p className="saved-library-hint">加载中…</p>}
          {error && <p className="error-msg">{error}</p>}

          {!loading && items.length === 0 && (
            <p className="saved-library-hint">
              暂无保存记录。生成后可点击预览页「保存」存入歌词库，无需再次调用 AI。
            </p>
          )}

          {!loading && items.length > 0 && (
            <ul className="saved-library-list">
              {items.map((item) => (
                <li key={item.id} className="saved-library-item">
                  <div className="saved-library-item-main">
                    <span className="saved-library-item-accent" aria-hidden />
                    <button
                      type="button"
                      className="saved-library-open"
                      onClick={() => onOpen(item)}
                    >
                      <span className="saved-library-item-title">{item.title}</span>
                      <span className="saved-library-item-meta">{formatDate(item.savedAt)}</span>
                    </button>
                  </div>
                  <div className="saved-library-actions">
                    <button
                      type="button"
                      className="btn-secondary btn-small btn-danger-text"
                      onClick={() => void handleDelete(item.id, item.title)}
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
