import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { deleteStudyCard, deleteStudyCards, listStudyCards, subscribeStudyCardsStore } from '../services/studyCardsStore';
import type { StudyCard } from '../studyCards/types';
import type { LangCode } from '../services/appSettings';
import { shareAnkiDeckTsv } from '../studyCards/shareAnkiDeck';
import StudyCardDetailOverlay from './StudyCardDetailOverlay';
import { L } from '../utils/i18n';
import './StudyCardsLibrary.css';

type Props = Record<string, never>;

const DRAWER_MS = 400;
const UNLATCH_MS = 100;
const DISMISS_DRAG_THRESHOLD_PX = 72;

type LangFilter = 'all' | LangCode;

const LANG_FILTER_ORDER: LangFilter[] = ['all', 'jp', 'ko', 'en', 'zh'];

function kindLabel(kind: StudyCard['kind']): string {
  return kind === 'vocab' ? L('词汇', 'Vocab') : L('语法', 'Grammar');
}

function langTagLabel(lang: LangCode): string {
  if (lang === 'jp') return 'JAP';
  if (lang === 'ko') return 'KOR';
  if (lang === 'en') return 'ENG';
  return 'ZH';
}

function langFilterLabel(filter: LangFilter): string {
  if (filter === 'all') return 'ALL';
  return langTagLabel(filter);
}

export default function StudyCardsLibrary(_props: Props) {
  const [items, setItems] = useState<StudyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerActive, setDrawerActive] = useState(false);
  const [unlatching, setUnlatching] = useState(false);
  const [closing, setClosing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [langFilter, setLangFilter] = useState<LangFilter>('all');
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const unlatchTimerRef = useRef<number | null>(null);
  const dismissDragStartYRef = useRef(0);
  const dismissDragStartOffsetRef = useRef(0);
  const [dismissDragY, setDismissDragY] = useState(0);
  const [dismissDragging, setDismissDragging] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await listStudyCards());
    } catch (e) {
      setError(e instanceof Error ? e.message : L('加载失败', 'Load failed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    return subscribeStudyCardsStore(() => {
      void reload();
    });
  }, [reload]);

  useEffect(() => {
    document.documentElement.classList.toggle('study-cards-drawer-open', drawerActive);
    return () => {
      document.documentElement.classList.remove('study-cards-drawer-open');
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
    setDetailIndex(null);
    closeTimerRef.current = window.setTimeout(() => {
      setDrawerOpen(false);
      setDrawerVisible(false);
      setClosing(false);
      setSelectedIds(new Set());
      setLangFilter('all');
    }, DRAWER_MS);
  }, [drawerOpen, closing]);

  useEffect(() => {
    if (drawerActive) return;
    setDismissDragY(0);
    setDismissDragging(false);
  }, [drawerActive]);

  const onDismissHandlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (detailIndex != null || closing || !drawerActive) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dismissDragStartYRef.current = e.clientY;
      dismissDragStartOffsetRef.current = dismissDragY;
      setDismissDragging(true);
    },
    [detailIndex, closing, drawerActive, dismissDragY],
  );

  const onDismissHandlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!dismissDragging) return;
      const dy = e.clientY - dismissDragStartYRef.current;
      setDismissDragY(Math.max(0, dismissDragStartOffsetRef.current + dy));
    },
    [dismissDragging],
  );

  const onDismissHandlePointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!dismissDragging) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      const dy = e.clientY - dismissDragStartYRef.current;
      const finalY = Math.max(0, dismissDragStartOffsetRef.current + dy);
      setDismissDragging(false);
      setDismissDragY(0);
      if (finalY >= DISMISS_DRAG_THRESHOLD_PX) {
        closeDrawer();
      }
    },
    [dismissDragging, closeDrawer],
  );

  const onDismissHandlePointerCancel = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!dismissDragging) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      setDismissDragging(false);
      setDismissDragY(0);
    },
    [dismissDragging],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const visibleItems =
    langFilter === 'all' ? items : items.filter((item) => item.lang === langFilter);

  const cycleLangFilter = useCallback(() => {
    setDetailIndex(null);
    setLangFilter((prev) => {
      const idx = LANG_FILTER_ORDER.indexOf(prev);
      return LANG_FILTER_ORDER[(idx + 1) % LANG_FILTER_ORDER.length] ?? 'all';
    });
  }, []);

  const allSelected =
    visibleItems.length > 0 && visibleItems.every((item) => selectedIds.has(item.id));

  const toggleSelectAll = useCallback(() => {
    if (!visibleItems.length) return;
    setSelectedIds((prev) => {
      const allVisibleSelected = visibleItems.every((item) => prev.has(item.id));
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const item of visibleItems) next.delete(item.id);
      } else {
        for (const item of visibleItems) next.add(item.id);
      }
      return next;
    });
  }, [visibleItems]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (detailIndex != null) return;
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, closeDrawer, detailIndex]);

  const handleToggle = () => {
    if (drawerOpen) closeDrawer();
    else openDrawer();
  };

  const cardsToExport =
    selectedIds.size > 0
      ? visibleItems.filter((item) => selectedIds.has(item.id))
      : visibleItems;

  const handleExport = async () => {
    if (!cardsToExport.length || exporting) return;
    setExporting(true);
    setError('');
    try {
      await shareAnkiDeckTsv(cardsToExport);
    } catch (e) {
      setError(e instanceof Error ? e.message : L('导出失败', 'Export failed'));
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedIds.size || deleting) return;
    const count = selectedIds.size;
    const msg =
      count === items.length
        ? `${L('确定删除全部', 'Delete all')} ${count} ${L('张学习卡？', ' study cards?')}`
        : `${L('确定删除已选的', 'Delete selected')} ${count} ${L('张学习卡？', ' study cards?')}`;
    if (!window.confirm(msg)) return;
    setDeleting(true);
    setError('');
    try {
      await deleteStudyCards([...selectedIds]);
      setSelectedIds(new Set());
      setDetailIndex(null);
      const nextItems = await listStudyCards();
      setItems(nextItems);
    } catch (e) {
      setError(e instanceof Error ? e.message : L('删除失败', 'Delete failed'));
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = async (id: string, front: string) => {
    const label = front.trim() || L('此卡片', 'this card');
    if (!window.confirm(`${L('确定删除「', 'Delete "')}${label}」？`)) return;
    const removedIndex = items.findIndex((item) => item.id === id);
    await deleteStudyCard(id);
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    const nextItems = await listStudyCards();
    setItems(nextItems);
    setLoading(false);
    if (detailIndex != null) {
      if (!nextItems.length) {
        setDetailIndex(null);
      } else {
        let next = detailIndex;
        if (removedIndex >= 0 && detailIndex > removedIndex) next -= 1;
        else if (removedIndex === detailIndex) next = Math.min(detailIndex, nextItems.length - 1);
        setDetailIndex(Math.max(0, next));
      }
    }
  };

  const openDetail = (index: number) => {
    setDetailIndex(index);
  };

  const drawerDragStyle =
    drawerActive && (dismissDragging || dismissDragY > 0)
      ? { transform: `translate(-50%, ${dismissDragY}px)` }
      : undefined;

  const drawerPortal =
    drawerVisible &&
    createPortal(
      <div
        className={`study-cards-drawer${drawerActive ? ' is-open' : ''}${closing ? ' is-closing' : ''}${dismissDragging ? ' is-dismiss-dragging' : ''}`}
        style={drawerDragStyle}
        role="dialog"
        aria-modal="true"
        aria-label={L('学习卡片', 'Study Cards')}
      >
        <div
          className="study-cards-drawer__dismiss-handle"
          onPointerDown={onDismissHandlePointerDown}
          onPointerMove={onDismissHandlePointerMove}
          onPointerUp={onDismissHandlePointerUp}
          onPointerCancel={onDismissHandlePointerCancel}
          aria-label={L('下拉收起', 'Collapse')}
        >
          <div className="study-cards-drawer__binding" aria-hidden />
        </div>
        <header className="study-cards-drawer__header">
          <div className="study-cards-drawer__header-title">
            <span className="saved-library-title">Study Cards</span>
            {items.length > 0 && (
              <button
                type="button"
                className="study-cards-drawer__lang-filter"
                onClick={cycleLangFilter}
                aria-label={`${L('语言筛选：', 'Lang filter: ')}${langFilterLabel(langFilter)}`}
              >
                {langFilterLabel(langFilter)}
              </button>
            )}
          </div>
          <div className="study-cards-drawer__header-aside">
            {selectedIds.size > 0 && (
              <button
                type="button"
                className="study-cards-drawer__delete-selected"
                disabled={deleting}
                onClick={() => void handleDeleteSelected()}
              >
                {deleting ? L('删除中…', 'Deleting…') : L('删除所选', 'Delete selected')}
              </button>
            )}
            {items.length > 0 && (
              <button type="button" className="study-cards-drawer__select-all" onClick={toggleSelectAll}>
                {allSelected ? L('取消全选', 'Deselect all') : L('全选', 'Select all')}
              </button>
            )}
            <button type="button" className="study-cards-drawer__close" onClick={closeDrawer}>
              {L('帰 / 收起', 'Collapse')}
            </button>
          </div>
        </header>

        <div className="study-cards-drawer__body">
          {loading && <p className="saved-library-hint">{L('加载中…', 'Loading…')}</p>}
          {error && <p className="error-msg">{error}</p>}

          {!loading && items.length === 0 && (
            <p className="saved-library-hint saved-library-hint--drawer">
              {L('暂无学习卡。粘贴含「重点词汇 / 重点语法」的 AI 歌词并排版后，卡片会自动收录于此。', 'No study cards. Paste AI lyrics with vocab/grammar and layout to auto-populate.')}
            </p>
          )}

          {!loading && items.length > 0 && visibleItems.length === 0 && (
            <p className="saved-library-hint saved-library-hint--drawer">
              {L('暂无', 'No')} {langFilterLabel(langFilter)} {L('卡片，点击标题旁标签切换语言。', 'cards. Tap tags near title to switch language.')}
            </p>
          )}

          {!loading && visibleItems.length > 0 && (
            <ul className="study-cards-drawer__list">
              {visibleItems.map((item, index) => (
                <li
                  key={item.id}
                  className={`study-cards-drawer__row${selectedIds.has(item.id) ? ' is-selected' : ''}`}
                  style={{ animationDelay: `${index * 0.04}s` }}
                >
                  <label
                    className="study-cards-drawer__row-check"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="study-cards-drawer__checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      aria-label={`${L('选择', 'Select')} ${item.front}`}
                    />
                  </label>
                  <button
                    type="button"
                    className="study-cards-drawer__row-open"
                    onClick={() => openDetail(index)}
                  >
                    <div className="study-cards-drawer__row-main">
                      <span className="study-cards-drawer__row-front" data-lang={item.lang}>
                        {item.front}
                      </span>
                      <span className="study-cards-drawer__row-meta">
                        {kindLabel(item.kind)} · {item.songTitle}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="study-cards-drawer__row-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(item.id, item.front);
                    }}
                    aria-label={`${L('删除', 'Delete')} ${item.front}`}
                  >
                    {L('删除', 'Delete')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="study-cards-drawer__footer">
          <button
            type="button"
            className="study-cards-drawer__export"
            disabled={!cardsToExport.length || exporting}
            onClick={() => void handleExport()}
          >
            {exporting ? L('导出中…', 'Exporting…') : ` ${L('导出至 Anki', 'Export to Anki')} `}
          </button>
          {selectedIds.size > 0 && (
            <p className="study-cards-drawer__export-hint">{`${L('已选', 'Selected')} ${selectedIds.size} ${L('张；未选时导出全部', 'cards; export all if none selected')}`}</p>
          )}
        </footer>
      </div>,
      document.body,
    );

  return (
    <>
      <section className={`saved-library study-cards-library${unlatching ? ' is-unlatching' : ''}`}>
        <button
          type="button"
          className="saved-library-toggle"
          onClick={handleToggle}
          aria-expanded={drawerOpen}
          aria-controls="study-cards-drawer"
        >
          <span className="saved-library-title">Study Cards</span>
          <span className="saved-library-toggle__aside">
            {!loading && (
              <span className="saved-library-count">
                <span className="saved-library-count__num">{items.length}</span>
                <span className="saved-library-count__unit">{L('张', 'cards')}</span>
              </span>
            )}
          </span>
        </button>
      </section>
      {drawerPortal}
      {detailIndex != null && visibleItems.length > 0 && (
        <StudyCardDetailOverlay
          cards={visibleItems}
          index={Math.min(detailIndex, visibleItems.length - 1)}
          onIndexChange={setDetailIndex}
          onClose={() => setDetailIndex(null)}
        />
      )}
    </>
  );
}
