import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  deleteSavedLyricsProject,
  listSavedLyricsProjects,
  type SavedLyricsProject,
} from '../services/savedLyricsStore';

type SavedLyricsLibraryProps = {
  onOpen: (project: SavedLyricsProject) => void;
  refreshKey?: number;
};

const DRAWER_MS = 400;
const UNLATCH_MS = 100;

function formatDrawerDate(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function displayArtist(item: SavedLyricsProject): string {
  return item.artist?.trim() || '—';
}

export default function SavedLyricsLibrary({ onOpen, refreshKey = 0 }: SavedLyricsLibraryProps) {
  const [items, setItems] = useState<SavedLyricsProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerActive, setDrawerActive] = useState(false);
  const [unlatching, setUnlatching] = useState(false);
  const [closing, setClosing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const closeTimerRef = useRef<number | null>(null);
  const unlatchTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    document.documentElement.classList.toggle('saved-library-drawer-open', drawerActive);
    return () => {
      document.documentElement.classList.remove('saved-library-drawer-open');
    };
  }, [drawerActive]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      if (unlatchTimerRef.current) window.clearTimeout(unlatchTimerRef.current);
    };
  }, []);

  const openDrawer = useCallback(() => {
    if (drawerOpen || unlatching) return;
    setUnlatching(true);
    unlatchTimerRef.current = window.setTimeout(() => {
      setUnlatching(false);
      setDrawerOpen(true);
      setDrawerVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setDrawerActive(true));
      });
    }, UNLATCH_MS);
  }, [drawerOpen, unlatching]);

  const closeDrawer = useCallback(() => {
    if (!drawerOpen || closing) return;
    setClosing(true);
    setDrawerActive(false);
    closeTimerRef.current = window.setTimeout(() => {
      setDrawerOpen(false);
      setDrawerVisible(false);
      setClosing(false);
      setSelectedIds(new Set());
    }, DRAWER_MS);
  }, [drawerOpen, closing]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, closeDrawer]);

  const handleToggle = () => {
    if (drawerOpen) {
      closeDrawer();
    } else {
      openDrawer();
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`确定删除「${title}」？`)) return;
    await deleteSavedLyricsProject(id);
    await reload();
  };

  const drawerPortal =
    drawerVisible &&
    createPortal(
      <div
        className={`saved-library-drawer${drawerActive ? ' is-open' : ''}${closing ? ' is-closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="我的歌词本"
      >
        <div className="saved-library-drawer__binding" aria-hidden />
        <header className="saved-library-drawer__header">
          <span className="saved-library-title">我的歌词本</span>
          <div className="saved-library-drawer__header-aside">
            <button type="button" className="saved-library-drawer__close" onClick={closeDrawer}>
              帰 / 收起
            </button>
          </div>
        </header>

        <div className="saved-library-drawer__body">
          {loading && <p className="saved-library-hint">加载中…</p>}
          {error && <p className="error-msg">{error}</p>}

          {!loading && items.length === 0 && (
            <p className="saved-library-hint saved-library-hint--drawer">
              暂无保存记录。生成后可点击预览页「保存」存入歌词库，无需再次调用 AI。
            </p>
          )}

          {!loading && items.length > 0 && (
            <ul className="saved-library-drawer__list">
              {items.map((item, index) => (
                <li
                  key={item.id}
                  className={`saved-library-drawer__row${selectedIds.has(item.id) ? ' is-selected' : ''}`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <label className="saved-library-drawer__row-check">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      aria-label={`选择 ${item.title}`}
                    />
                  </label>
                  <button
                    type="button"
                    className="saved-library-drawer__row-btn"
                    onClick={() => onOpen(item)}
                  >
                    <span className="saved-library-drawer__row-title">{item.title}</span>
                    <span className="saved-library-drawer__row-artist">{displayArtist(item)}</span>
                    <span className="saved-library-drawer__row-date">
                      {formatDrawerDate(item.savedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="saved-library-drawer__row-delete"
                    onClick={() => void handleDelete(item.id, item.title)}
                    aria-label={`删除 ${item.title}`}
                  >
                    删除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="saved-library-drawer__notice">
          <p className="saved-library-drawer__notice-title">关于数据与书写所有权</p>
          <p className="saved-library-drawer__notice-text">
            SHUFURI 是一款纯粹的个人字音排版与数字活页工具。本应用不内置、不传输、不存储任何有版权的音乐及歌词内容。您所保存的「歌词本」及所有标注、释义、微调文本，均属于您个人的学习摘录与书写内容。请在合规范围内使用个人摘录。
          </p>
        </footer>
      </div>,
      document.body,
    );

  return (
    <>
      <section className={`saved-library${unlatching ? ' is-unlatching' : ''}`}>
        <button
          type="button"
          className="saved-library-toggle"
          onClick={handleToggle}
          aria-expanded={drawerOpen}
          aria-controls="saved-library-drawer"
        >
          <span className="saved-library-title">Archive</span>
          <span className="saved-library-toggle__aside">
            {!loading && (
              <span className="saved-library-count">
                <span className="saved-library-count__num">{items.length}</span>
                <span className="saved-library-count__unit">篇</span>
              </span>
            )}
          </span>
        </button>
      </section>
      {drawerPortal}
    </>
  );
}
