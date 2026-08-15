import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import InkFineTuneEditor from '../InkFineTuneEditor';
import InkToolbox from '../InkToolbox';
import ShufuriPosterEditCanvas from '../ShufuriPosterEditCanvas';
import ExplainMicroscopePanel from '../ExplainMicroscopePanel';
import EditNotebookPane from '../EditNotebookPane';
import EditItemOverlay from '../EditItemOverlay';
import MaximizeIcon from '../icons/MaximizeIcon';
import {
  usePosterDocumentContext,
  usePosterInkContext,
  usePosterTypographyContext,
} from '../../context/PosterWorkspaceContext';
import { useEditCanvasScrollPerfProbe } from '../../hooks/useEditCanvasScrollPerfProbe';
import { useEditCanvasScrollInteractionLock } from '../../hooks/useEditCanvasScrollInteractionLock';
import { presentFontScaleForPane, useEditPresentation } from '../../hooks/useEditPresentation';
import { useExplainSession } from '../../hooks/useExplainSession';
import { useAppToast } from '../../context/AppToastContext';
import { EDIT_DESKTOP_SPLIT_QUERY, useMediaQuery } from '../../hooks/useMediaQuery';
import {
  createBrushController,
  tokenizeBrushableHtml,
  originalLineClassesForLang,
  BRUSH_MAX_CHARS,
  BRUSH_READY_CLASS,
} from '../../utils/highlighterBrush';
import { listExplainNotesFromBodyHtml } from '../../utils/appendExplainNoteToBody';
import {
  listStudyEntriesFromBodyHtml,
  readVocabItemFromElement,
  readGrammarItemFromElement,
  type VocabItemPayload,
  type GrammarItemPayload,
} from '../../utils/studySectionItems';
import { extractLyricsOnlyBodyHtml } from '../../utils/lyricsOnlyBodyHtml';
import { L } from '../../utils/i18n';

type StudyEditorKind = 'vocab' | 'grammar';

// —— 弹窗共享样式常量（消除 22 处重复 rgba 硬编码） ——
const MODAL_BACKDROP_STYLE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 200,
  background: 'rgba(15, 23, 42, 0.35)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: 84,
  overflowY: 'auto',
};

const MODAL_PANEL_STYLE: React.CSSProperties = {
  width: 'min(560px, calc(100vw - 32px))',
  background: '#ffffff',
  borderRadius: 14,
  boxShadow: '0 16px 48px rgba(15, 23, 42, 0.18)',
  border: '1px solid rgba(148, 163, 184, 0.35)',
  padding: 16,
};

export default function EditScreen() {
  const {
    bodyHtml,
    title,
    artist,
    lyrics,
    titleMarkupHtml,
    lang,
    lyricsLanguage,
    colorTheme,
    savedProjectId,
    handleReset,
    saving,
    handleSave,
    enterExportFlow,
    editCanvasRef,
    editScale,
    appendExplainNote,
    removeExplainNote,
    updateExplainNote,
    ensureExplainNoteIds,
    ensureStudyItemIds,
    removeStudyItem,
    updateVocabItem,
    updateGrammarItem,
    appendGrammarStudyItem,
  } = usePosterDocumentContext();

  const {
    showRubyAnnotations,
    rubyToggleSupported,
    handleShowRubyChange,
  } = usePosterTypographyContext();

  const ink = usePosterInkContext();
  const showToast = useAppToast();
  const isDesktopSplit = useMediaQuery(EDIT_DESKTOP_SPLIT_QUERY);
  const present = useEditPresentation();
  const editAreaRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const explainPausedForPresentRef = useRef(false);
  const splitDraggingRef = useRef(false);
  const notebookScrollRef = useRef<HTMLDivElement>(null);
  const appendExplainNoteAndScroll = useCallback(
    (payload: {
      id: string;
      term: string;
      contextSense: string;
      grammar?: string;
      mood?: string;
    }) => {
      appendExplainNote(payload);
      window.requestAnimationFrame(() => {
        if (isDesktopSplit) {
          const nb = notebookScrollRef.current;
          if (nb) {
            nb.scrollTo({ top: nb.scrollHeight, behavior: 'smooth' });
            return;
          }
        }
        const el = editCanvasRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      });
    },
    [appendExplainNote, editCanvasRef, isDesktopSplit],
  );

  const appendGrammarStudyItemAndScroll = useCallback(
    (payload: {
      id: string;
      titlePrimary: string;
      titleSecondary: string;
      detail: string;
      example: string;
      translation: string;
    }) => {
      appendGrammarStudyItem(payload);
      window.requestAnimationFrame(() => {
        if (isDesktopSplit) {
          const nb = notebookScrollRef.current;
          if (nb) {
            nb.scrollTo({ top: nb.scrollHeight, behavior: 'smooth' });
            return;
          }
        }
        const el = editCanvasRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      });
    },
    [appendGrammarStudyItem, editCanvasRef, isDesktopSplit],
  );

  const explain = useExplainSession({
    title,
    artist,
    lyrics,
    lang,
    savedProjectId,
    showToast,
    appendExplainNote: appendExplainNoteAndScroll,
    appendGrammarStudyItem: appendGrammarStudyItemAndScroll,
  });

  // —— 划词笔记 / 重点词汇 / 重点语法：删除与点选编辑（与划词/铅笔模式解耦） ——
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [draftTerm, setDraftTerm] = useState('');
  const [draftContextSense, setDraftContextSense] = useState('');
  const [draftGrammar, setDraftGrammar] = useState('');
  const [draftMood, setDraftMood] = useState('');

  const [editingStudy, setEditingStudy] = useState<{
    id: string;
    kind: StudyEditorKind;
  } | null>(null);
  const [vocabDraft, setVocabDraft] = useState<VocabItemPayload>({
    term: '',
    meaning: '',
    example: '',
    translation: '',
  });
  const [grammarDraft, setGrammarDraft] = useState<GrammarItemPayload>({
    titlePrimary: '',
    titleSecondary: '',
    detail: '',
    example: '',
    translation: '',
  });

  const closeEditors = useCallback(() => {
    setEditingNoteId(null);
    setEditingStudy(null);
  }, []);

  const openEditForNoteEl = useCallback(
    (noteEl: HTMLElement) => {
      const noteId = noteEl.getAttribute('data-shufuri-explain-note-id')?.trim() ?? '';
      if (!noteId) {
        // 旧笔记无 id：先补齐后请用户再点一次（避免 DOM 与 bodyHtml 脱节）
        ensureExplainNoteIds();
        showToast(L('笔记已刷新，请再点一次编辑', 'Notes refreshed, tap edit again.'));
        return;
      }

      const termEl = noteEl.querySelector(
        '.vocab-line1 span[class^="vocab-word"]',
      ) as HTMLElement | null;
      const meaningEl = noteEl.querySelector(
        '.vocab-line1 .vocab-meaning',
      ) as HTMLElement | null;
      const grammarEl = noteEl.querySelector('.grammar-detail') as HTMLElement | null;
      const moodEl = noteEl.querySelector('.vocab-ex-zh') as HTMLElement | null;

      // 点笔记时关掉划词 AI 面板，避免与编辑浮层抢焦点
      if (explain.panelOpen) explain.closePanel();
      window.getSelection()?.removeAllRanges();

      setEditingStudy(null);
      setEditingNoteId(noteId);
      setDraftTerm(termEl?.textContent?.trim() ?? '');
      setDraftContextSense(meaningEl?.textContent?.trim() ?? '');
      setDraftGrammar(grammarEl?.textContent?.trim() ?? '');
      setDraftMood(moodEl?.textContent?.trim() ?? '');
    },
    [ensureExplainNoteIds, explain, showToast],
  );

  const openEditForNoteId = useCallback(
    (noteId: string) => {
      const note = listExplainNotesFromBodyHtml(bodyHtml).find((n) => n.id === noteId);
      if (!note || note.id.startsWith('orphan-')) {
        ensureExplainNoteIds();
        showToast(L('笔记已刷新，请再点一次编辑', 'Notes refreshed, tap edit again.'));
        return;
      }
      if (explain.panelOpen) explain.closePanel();
      window.getSelection()?.removeAllRanges();
      setEditingStudy(null);
      setEditingNoteId(note.id);
      setDraftTerm(note.term);
      setDraftContextSense(note.contextSense);
      setDraftGrammar(note.grammar);
      setDraftMood(note.mood);
    },
    [bodyHtml, ensureExplainNoteIds, explain, showToast],
  );

  const openEditForVocabId = useCallback(
    (itemId: string) => {
      const item = listStudyEntriesFromBodyHtml(bodyHtml).vocab.find((n) => n.id === itemId);
      if (!item || item.id.startsWith('orphan-')) {
        ensureStudyItemIds();
        showToast(L('条目已刷新，请再点一次编辑', 'Entries refreshed, tap edit again.'));
        return;
      }
      if (explain.panelOpen) explain.closePanel();
      window.getSelection()?.removeAllRanges();
      setEditingNoteId(null);
      setEditingStudy({ id: item.id, kind: 'vocab' });
      setVocabDraft({
        term: item.term,
        meaning: item.meaning,
        example: item.example,
        translation: item.translation,
      });
    },
    [bodyHtml, ensureStudyItemIds, explain, showToast],
  );

  const openEditForGrammarId = useCallback(
    (itemId: string) => {
      const item = listStudyEntriesFromBodyHtml(bodyHtml).grammar.find((n) => n.id === itemId);
      if (!item || item.id.startsWith('orphan-')) {
        ensureStudyItemIds();
        showToast(L('条目已刷新，请再点一次编辑', 'Entries refreshed, tap edit again.'));
        return;
      }
      if (explain.panelOpen) explain.closePanel();
      window.getSelection()?.removeAllRanges();
      setEditingNoteId(null);
      setEditingStudy({ id: item.id, kind: 'grammar' });
      setGrammarDraft({
        titlePrimary: item.titlePrimary,
        titleSecondary: item.titleSecondary,
        detail: item.detail,
        example: item.example,
        translation: item.translation,
      });
    },
    [bodyHtml, ensureStudyItemIds, explain, showToast],
  );

  const openEditForStudyEl = useCallback(
    (itemEl: HTMLElement) => {
      const itemId = itemEl.getAttribute('data-shufuri-study-id')?.trim() ?? '';
      const kindAttr = itemEl.getAttribute('data-shufuri-study-kind')?.trim();
      const kind: StudyEditorKind =
        kindAttr === 'grammar' || itemEl.classList.contains('lyrics-grammar-item')
          ? 'grammar'
          : 'vocab';
      if (!itemId) {
        ensureStudyItemIds();
        showToast(L('条目已刷新，请再点一次编辑', 'Entries refreshed, tap edit again.'));
        return;
      }

      if (explain.panelOpen) explain.closePanel();
      window.getSelection()?.removeAllRanges();

      setEditingNoteId(null);
      setEditingStudy({ id: itemId, kind });
      if (kind === 'vocab') {
        setVocabDraft(readVocabItemFromElement(itemEl));
      } else {
        setGrammarDraft(readGrammarItemFromElement(itemEl));
      }
    },
    [ensureStudyItemIds, explain, showToast],
  );

  useEffect(() => {
    ensureExplainNoteIds();
    ensureStudyItemIds();
  }, [ensureExplainNoteIds, ensureStudyItemIds]);

  useEffect(() => {
    const root = editCanvasRef.current;
    if (!root) return;

    const onClickCapture = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;

      const noteDeleteBtn = target.closest(
        '.shufuri-explain-note__delete',
      ) as HTMLElement | null;
      if (noteDeleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const noteId = noteDeleteBtn.getAttribute('data-shufuri-explain-note-id') ?? '';
        if (noteId) {
          removeExplainNote(noteId);
          if (editingNoteId === noteId) setEditingNoteId(null);
        }
        return;
      }

      const studyDeleteBtn = target.closest(
        '.shufuri-study-item__delete',
      ) as HTMLElement | null;
      if (studyDeleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const itemId = studyDeleteBtn.getAttribute('data-shufuri-study-id') ?? '';
        if (itemId) {
          removeStudyItem(itemId);
          if (editingStudy?.id === itemId) setEditingStudy(null);
        }
        return;
      }

      // 任意模式下，点划词笔记 / 学习条目都打开编辑（不再被划词模式挡住）
      const noteEl = target.closest(
        '.shufuri-explain-note[data-shufuri-explain-note="1"]',
      ) as HTMLElement | null;
      if (noteEl) {
        e.preventDefault();
        e.stopPropagation();
        openEditForNoteEl(noteEl);
        return;
      }

      const studyEl = target.closest(
        '.shufuri-study-item[data-shufuri-study-id]',
      ) as HTMLElement | null;
      if (!studyEl || studyEl.getAttribute('data-shufuri-explain-note') === '1') return;

      e.preventDefault();
      e.stopPropagation();
      openEditForStudyEl(studyEl);
    };

    const options = { capture: true } as const;
    root.addEventListener('click', onClickCapture, options);
    return () => {
      root.removeEventListener('click', onClickCapture, options);
    };
  }, [
    editCanvasRef,
    openEditForNoteEl,
    openEditForStudyEl,
    removeExplainNote,
    removeStudyItem,
    editingNoteId,
    editingStudy,
  ]);

  /** 划词开启或授课态时禁用铅笔点选；铅笔模式与侧栏开合解耦 */
  const inkEditArmed = ink.inkEditMode && !explain.explainMode && !present.presentationOn;
  useEditCanvasScrollPerfProbe(editCanvasRef);
  const closeInkOnScrollStart = useCallback(() => {
    if (ink.inkEditTarget) ink.closeInkPopover();
  }, [ink.inkEditTarget, ink.closeInkPopover]);
  useEditCanvasScrollInteractionLock(editCanvasRef, {
    onScrollStart: closeInkOnScrollStart,
  });

  const collapseToolbox = useCallback(() => {
    ink.setInkToolboxOpen(false);
  }, [ink]);

  const enableExplainFromNotebook = useCallback(() => {
    if (present.presentationOn) {
      showToast(L('请先退出全屏再划词', 'Exit fullscreen before selection explain.'));
      return;
    }
    if (explain.explainMode) {
      showToast(L('划词已开启：在左侧选中词语', 'Selection mode on: select text on the left.'));
      return;
    }
    ink.closeInkPopover();
    ink.setInkEditMode(false);
    explain.arm();
    collapseToolbox();
    showToast(L('划词已开启：选中后先出本地释义，需要时再点 AI讲解', 'Selection mode on: shows local definition first, tap "AI Explain" for more.'));
  }, [collapseToolbox, explain, ink, present.presentationOn, showToast]);

  const toggleInkToolbox = useCallback(() => {
    if (ink.inkToolboxOpen) {
      ink.closeInkPopover();
      ink.setInkToolboxOpen(false);
      return;
    }
    ink.setInkToolboxOpen(true);
  }, [ink]);

  const handleToggleInkEdit = useCallback(() => {
    if (ink.inkEditMode) {
      ink.setInkEditMode(false);
      ink.closeInkPopover();
      collapseToolbox();
      showToast(L('已退出铅笔编辑', 'Exited quick edit.'));
      return;
    }
    if (explain.explainMode) explain.disarm();
    ink.setInkEditMode(true);
    collapseToolbox();
    showToast(L('铅笔编辑已开启：点选注音或译文', 'Quick edit on: tap to edit readings or translations.'));
  }, [collapseToolbox, explain, ink, showToast]);

  const handleToggleExplain = useCallback(() => {
    if (explain.explainMode) {
      explain.disarm();
      collapseToolbox();
      showToast(L('已退出划词解释', 'Exited highlight explanation.'));
      return;
    }
    ink.closeInkPopover();
    ink.setInkEditMode(false);
    explain.arm();
    collapseToolbox();
    showToast(L('划词已开启：选中后先出本地释义，需要时再点 AI讲解', 'Selection mode on: shows local definition first, tap "AI Explain" for more.'));
  }, [collapseToolbox, explain, ink, showToast]);

  const handleEnterPresentation = useCallback(() => {
    if (explain.explainMode) {
      explain.disarm();
      explainPausedForPresentRef.current = true;
    } else {
      explainPausedForPresentRef.current = false;
    }
    ink.closeInkPopover();
    ink.setInkEditMode(false);
    ink.setInkToolboxOpen(false);
    present.enter();
    const el = editAreaRef.current;
    if (el && typeof el.requestFullscreen === 'function') {
      void el.requestFullscreen().catch(() => {
        /* CSS 伪全屏兜底 */
      });
    }
  }, [explain, ink, present]);

  const handleExitPresentation = useCallback(() => {
    present.exit();
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    if (explainPausedForPresentRef.current) {
      explainPausedForPresentRef.current = false;
      explain.arm();
    }
  }, [explain, present]);

  const handleSplitPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDesktopSplit) return;
      e.preventDefault();
      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);
      splitDraggingRef.current = true;
      handle.classList.add('is-dragging');
      document.body.classList.add('is-resizing-edit-split');

      const onMove = (ev: PointerEvent) => {
        const workspace = workspaceRef.current;
        if (!workspace) return;
        const rect = workspace.getBoundingClientRect();
        if (rect.width < 1) return;
        present.setRatio((ev.clientX - rect.left) / rect.width);
      };
      const onUp = (ev: PointerEvent) => {
        splitDraggingRef.current = false;
        handle.classList.remove('is-dragging');
        document.body.classList.remove('is-resizing-edit-split');
        try {
          handle.releasePointerCapture(ev.pointerId);
        } catch {
          /* already released */
        }
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    },
    [isDesktopSplit, present],
  );

  const handleRubyChangeAndCollapse = useCallback(
    (show: boolean) => {
      handleShowRubyChange(show);
      collapseToolbox();
    },
    [collapseToolbox, handleShowRubyChange],
  );

  const scrollClass = [
    'edit-canvas-scroll',
    inkEditArmed ? 'is-ink-edit-armed' : '',
    explain.explainMode ? 'is-explain-mode' : '',
    present.presentationOn ? 'is-present-spotlight' : '',
  ]
    .filter(Boolean)
    .join(' ');

  /** 桌面左栏只渲染歌词原文；完整正文仍用于笔记本 / 保存 */
  const lyricsPaneBodyHtml = useMemo(
    () => (isDesktopSplit ? extractLyricsOnlyBodyHtml(bodyHtml) : bodyHtml),
    [bodyHtml, isDesktopSplit],
  );

  // 讲解模式下把正文拆成字符级 span 供笔刷命中；关闭时退回原始 HTML
  const brushBodyHtml = useMemo(
    () => (explain.explainMode ? tokenizeBrushableHtml(lyricsPaneBodyHtml) : lyricsPaneBodyHtml),
    [explain.explainMode, lyricsPaneBodyHtml],
  );

  /** 授课态：点击 lyrics-group 聚光灯 */
  useEffect(() => {
    if (!present.presentationOn) return;
    const root = editCanvasRef.current;
    if (!root) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const group = target.closest('.lyrics-group') as HTMLElement | null;
      // 授课态下 .lyrics-group 为 inline-flex + margin:auto，行间/行内留有大量空白。
      // 点中空白(命中 .fv-body-h 但不命中 .lyrics-group)时绝不清空聚光灯，否则极易误触清空。
      // 取消聚焦仅通过：再次点同一行(toggle) 或 Esc 键。
      if (!group || !root.contains(group)) {
        return;
      }
      const body = root.querySelector('.fv-body-h');
      const groups = body ? Array.from(body.querySelectorAll('.lyrics-group')) : [];
      const idx = groups.indexOf(group);
      const id = group.getAttribute('data-ink-g') ?? (idx >= 0 ? String(idx) : null);
      if (id == null) return;
      e.preventDefault();
      e.stopPropagation();
      if (present.spotlightGroupId === id) {
        present.clearSpotlight();
        return;
      }
      present.setSpotlight(id);
      group.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };

    root.addEventListener('click', onClick, true);
    return () => root.removeEventListener('click', onClick, true);
  }, [present.presentationOn, present.spotlightGroupId, present.setSpotlight, present.clearSpotlight, editCanvasRef]);

  /** 同步聚光灯 class（HTML 重渲后同帧重贴，避免闪烁丢失） */
  useLayoutEffect(() => {
    const root = editCanvasRef.current;
    if (!root) return;
    const body = root.querySelector('.fv-body-h');
    if (!body) return;
    const groups = body.querySelectorAll('.lyrics-group');
    if (!present.presentationOn || present.spotlightGroupId == null) {
      groups.forEach((g) => {
        g.classList.remove('is-spotlight-focus', 'is-spotlight-dim');
      });
      return;
    }
    groups.forEach((g, idx) => {
      const id = g.getAttribute('data-ink-g') ?? String(idx);
      if (id === present.spotlightGroupId) {
        g.classList.add('is-spotlight-focus');
        g.classList.remove('is-spotlight-dim');
      } else {
        g.classList.add('is-spotlight-dim');
        g.classList.remove('is-spotlight-focus');
      }
    });
  }, [present.presentationOn, present.spotlightGroupId, brushBodyHtml, editCanvasRef]);

  /** Esc：清聚光灯 / 退出全屏；↑↓：上一句 / 下一句对焦（滚轮只滚动，不换句） */
  useEffect(() => {
    if (!present.presentationOn) return;

    const resolveGroups = () => {
      const root = editCanvasRef.current;
      const body = root?.querySelector('.fv-body-h');
      if (!body) return [] as HTMLElement[];
      return Array.from(body.querySelectorAll('.lyrics-group')) as HTMLElement[];
    };

    const groupIdAt = (groups: HTMLElement[], idx: number) =>
      groups[idx]?.getAttribute('data-ink-g') ?? String(idx);

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.closest?.(
        'input, textarea, select, [contenteditable="true"]',
      );
      if (tag) return;

      if (e.key === 'Escape') {
        if (present.spotlightGroupId) return; /* hook 已清聚光灯 */
        e.preventDefault();
        handleExitPresentation();
        return;
      }

      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const groups = resolveGroups();
      if (groups.length === 0) return;
      e.preventDefault();

      let nextIdx: number;
      if (present.spotlightGroupId == null) {
        nextIdx = e.key === 'ArrowDown' ? 0 : groups.length - 1;
      } else {
        const cur = groups.findIndex((_, i) => groupIdAt(groups, i) === present.spotlightGroupId);
        const from = cur >= 0 ? cur : 0;
        nextIdx =
          e.key === 'ArrowDown'
            ? Math.min(groups.length - 1, from + 1)
            : Math.max(0, from - 1);
      }

      const id = groupIdAt(groups, nextIdx);
      present.setSpotlight(id);
      groups[nextIdx]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [present.presentationOn, present.spotlightGroupId, present, handleExitPresentation, editCanvasRef]);

  // 讲解模式：用 Highlighter Brush（笔刷涂抹）彻底替代原生划词。
  // 笔刷计算出的选区文本 + 上下文原样喂给 analyzeSelection，不改 AI 管线。
  useEffect(() => {
    if (!explain.explainMode || present.presentationOn) return;
    const root = editCanvasRef.current;
    const body = root?.querySelector<HTMLElement>('.fv-body-h') ?? null;
    if (!root || !body) return;

    root.classList.add(BRUSH_READY_CLASS);

    const controller = createBrushController({
      root,
      body,
      maxChars: BRUSH_MAX_CHARS,
      originalLineClasses: originalLineClassesForLang(lang),
      onSelect: (sel) => {
        explain.analyzeSelection(sel.text, sel.context);
      },
      onOverflow: () => showToast(L('已超出讲解范围，请缩小选区', 'Selection too large, please narrow it down.')),
      onTranslationOnly: () => showToast(L('请涂抹原文行，不要选中翻译部分', 'Please select the original text, not the translation.')),
    });

    return () => {
      controller.destroy();
      root.classList.remove(BRUSH_READY_CLASS);
    };
  }, [
    editCanvasRef,
    explain.explainMode,
    present.presentationOn,
    brushBodyHtml,
    explain.analyzeSelection,
    showToast,
    lang,
  ]);

  const splitLeftPercent = `${Math.round(present.splitRatio * 1000) / 10}%`;
  const leftFontScale = presentFontScaleForPane(present.splitRatio);
  const rightFontScale = presentFontScaleForPane(1 - present.splitRatio);
  const editAreaClass = [
    'edit-area',
    explain.panelOpen ? 'edit-area--explain' : '',
    isDesktopSplit ? 'edit-area--desktop-split' : '',
    present.presentationOn ? 'edit-area--presentation edit-area--presentation-fs' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={editAreaRef}
      className={editAreaClass}
      style={
        {
          ['--edit-split-left' as string]: splitLeftPercent,
          ['--edit-present-font-scale-left' as string]: String(leftFontScale),
          ['--edit-present-font-scale-right' as string]: String(rightFontScale),
        } as React.CSSProperties
      }
    >
      {present.presentationOn ? (
        <button
          type="button"
          className="edit-present-exit"
          onClick={handleExitPresentation}
        >
          {L('退出全屏', 'Exit fullscreen')}
        </button>
      ) : null}
      <div className="edit-toolbar">
        <button type="button" className="btn-secondary" onClick={handleReset}>
          ← {L('重新输入', 'Re-enter')}
        </button>
        <div className="toolbar-actions">
          {explain.explainMode && (
            <span className="preview-explain-hint">{L('划词解释中', 'Explaining Selection…')}</span>
          )}
          <button
            type="button"
            className="btn-export btn-export-save edit-toolbar__present-btn"
            onClick={handleEnterPresentation}
            disabled={!bodyHtml.trim()}
            title={L('全屏', 'Fullscreen')}
            aria-label={L('全屏', 'Fullscreen')}
          >
            <MaximizeIcon size={16} />
            {L('全屏', 'Fullscreen')}
          </button>
          <button
            type="button"
            className="btn-export btn-export-save"
            onClick={() => void handleSave()}
            disabled={saving || !bodyHtml.trim()}
          >
            {saving ? L('保存中…', 'Saving…') : L('保存', 'Save')}
          </button>
          <button
            type="button"
            className="btn-export btn-export-primary"
            onClick={() => void enterExportFlow()}
            disabled={!bodyHtml.trim()}
          >
            {L('导出', 'Export')}
          </button>
        </div>
      </div>

      {!bodyHtml.trim() ? (
        <div className="edit-area__workspace edit-area__empty-state" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            textAlign: 'center',
            maxWidth: 420,
            padding: '48px 24px',
          }}>
            <p style={{
              fontSize: 'var(--ui-text-lg, 18px)',
              color: 'var(--color-fg-secondary, #64748b)',
              margin: '0 0 20px 0',
              lineHeight: 1.6,
            }}>
              {L('请先输入日语歌词', 'Please enter Japanese lyrics first')}
            </p>
            <p style={{
              fontSize: 'var(--ui-text-sm, 13px)',
              color: 'var(--color-fg-tertiary, #94a3b8)',
              margin: '0 0 28px 0',
            }}>
              {L('在首页粘贴日语歌词即可开始编辑', 'Paste Japanese lyrics on the home screen to get started')}
            </p>
            <button type="button" className="btn-export btn-export-primary" onClick={handleReset}>
              ← {L('返回首页', 'Back to Home')}
            </button>
          </div>
        </div>
      ) : (
      <div className="edit-area__workspace" ref={workspaceRef}>
        <div className="edit-area__lyrics-pane">
          {!present.presentationOn ? (
            <InkToolbox
              open={ink.inkToolboxOpen}
              canUndo={ink.canUndoInkEdit}
              inkEditActive={ink.inkEditMode}
              showRuby={showRubyAnnotations}
              rubySupported={rubyToggleSupported}
              explainActive={explain.explainMode}
              onToggle={toggleInkToolbox}
              onUndo={ink.handleInkUndo}
              onShowRubyChange={handleRubyChangeAndCollapse}
              onToggleInkEdit={handleToggleInkEdit}
              onToggleExplain={handleToggleExplain}
            />
          ) : null}
          <div ref={editCanvasRef} className={scrollClass}>
            <InkFineTuneEditor
              containerRef={editCanvasRef}
              focusGroupIndex={ink.inkFocusGroupIndex}
              editTarget={ink.inkEditTarget}
              popoverClosing={ink.inkPopoverClosing}
              draftKanji={ink.inkDraftKanji}
              draftKana={ink.inkDraftKana}
              draftZh={ink.inkDraftZh}
              draftKo={ink.inkDraftKo}
              draftTitle={ink.inkDraftTitle}
              draftArtist={ink.inkDraftArtist}
              draftJp={ink.inkDraftJp}
              interaction="click"
              interactionEnabled={inkEditArmed && !present.presentationOn}
              onOpenTarget={ink.handleInkOpenTarget}
              onClose={ink.closeInkPopover}
              onKanjiChange={ink.setInkDraftKanji}
              onKanaChange={ink.setInkDraftKana}
              onZhChange={ink.setInkDraftZh}
              onKoChange={ink.setInkDraftKo}
              onTitleChange={ink.setInkDraftTitle}
              onArtistChange={ink.setInkDraftArtist}
              onJpChange={ink.setInkDraftJp}
              onConfirm={() => void ink.handleInkConfirm()}
              onRemoveRuby={() => ink.handleInkRemoveRuby()}
            >
              <ShufuriPosterEditCanvas
                title={title}
                artist={artist}
                bodyHtml={brushBodyHtml}
                layoutProfile="mobilePoster"
                displayScale={editScale}
                contentScale={present.presentationOn ? leftFontScale : 1}
                titleMarkupHtml={titleMarkupHtml}
                lang={lang}
                language={lyricsLanguage}
                colorTheme={colorTheme}
                showRuby={showRubyAnnotations}
              />
            </InkFineTuneEditor>
          </div>
        </div>

        {isDesktopSplit ? (
          <>
            <div
              className="edit-split-handle"
              role="separator"
              aria-orientation="vertical"
              aria-label={L('调整分栏', 'Resize panels')}
              onPointerDown={handleSplitPointerDown}
            />
            <EditNotebookPane
              bodyHtml={bodyHtml}
              explainMode={explain.explainMode}
              aiOpen={explain.panelOpen && !present.presentationOn}
              onEnableExplain={enableExplainFromNotebook}
              onOpenExplainNote={openEditForNoteId}
              onOpenVocab={openEditForVocabId}
              onOpenGrammar={openEditForGrammarId}
              onDeleteExplainNote={(noteId) => {
                removeExplainNote(noteId);
                if (editingNoteId === noteId) setEditingNoteId(null);
              }}
              onDeleteStudy={(itemId) => {
                removeStudyItem(itemId);
                if (editingStudy?.id === itemId) setEditingStudy(null);
              }}
              scrollRef={notebookScrollRef}
              microscope={
                explain.panelOpen && !present.presentationOn ? (
                  <ExplainMicroscopePanel session={explain} variant="embedded" />
                ) : null
              }
            />
          </>
        ) : (
          <ExplainMicroscopePanel session={explain} />
        )}
      </div>
        )}

        {editingNoteId && (
          <div
            role="dialog"
            aria-modal="true"
            className="shufuri-explain-note-editor-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeEditors();
            }}
            style={MODAL_BACKDROP_STYLE}
          >
            <div
              className="shufuri-explain-note-editor-panel"
              style={MODAL_PANEL_STYLE}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, letterSpacing: '0.02em' }}>{L('编辑划词笔记', 'Edit Selection Note')}</h3>
                <button
                  type="button"
                  aria-label={L('关闭', 'Close')}
                  className="btn-tonal"
                  onClick={closeEditors}
                  style={{ minHeight: 30, padding: '0 10px' }}
                >
                  ×
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {L('词条', 'Entry')}
                  <input
                    className="shufuri-explain-note-editor__input"
                    value={draftTerm}
                    onChange={(ev) => setDraftTerm(ev.target.value)}
                    style={{ border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, padding: '8px 10px' }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {L('语境释义', 'Contextual Meaning')}
                  <textarea
                    value={draftContextSense}
                    rows={2}
                    onChange={(ev) => setDraftContextSense(ev.target.value)}
                    style={{ border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, padding: '8px 10px', resize: 'vertical' }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {L('语法', 'Grammar')}
                  <textarea
                    value={draftGrammar}
                    rows={2}
                    onChange={(ev) => setDraftGrammar(ev.target.value)}
                    style={{ border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, padding: '8px 10px', resize: 'vertical' }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {L('意境', 'Mood')}
                  <textarea
                    value={draftMood}
                    rows={2}
                    onChange={(ev) => setDraftMood(ev.target.value)}
                    style={{ border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, padding: '8px 10px', resize: 'vertical' }}
                  />
                </label>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button type="button" className="btn-tonal" onClick={closeEditors}>
                    {L('取消', 'Cancel')}
                  </button>
                  <button
                    type="button"
                    className="btn-export btn-export-primary"
                    disabled={!draftTerm.trim()}
                    onClick={() => {
                      updateExplainNote(editingNoteId, {
                        term: draftTerm.trim(),
                        contextSense: draftContextSense.trim(),
                        grammar: draftGrammar.trim() || undefined,
                        mood: draftMood.trim() || undefined,
                      });
                      closeEditors();
                    }}
                  >
                    {L('保存', 'Save')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <EditItemOverlay
          open={editingStudy?.kind === 'vocab'}
          title={L('编辑重点词汇', 'Edit Key Vocabulary')}
          onClose={closeEditors}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {L('词条', 'Entry')}
            <input
              value={vocabDraft.term}
              onChange={(ev) =>
                setVocabDraft((d) => ({ ...d, term: ev.target.value }))
              }
              style={{ border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, padding: '8px 10px' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {L('释义', 'Meaning')}
            <textarea
              value={vocabDraft.meaning}
              rows={2}
              onChange={(ev) =>
                setVocabDraft((d) => ({ ...d, meaning: ev.target.value }))
              }
              style={{ border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, padding: '8px 10px', resize: 'vertical' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {L('例句', 'Example')}
            <textarea
              value={vocabDraft.example}
              rows={2}
              onChange={(ev) =>
                setVocabDraft((d) => ({ ...d, example: ev.target.value }))
              }
              style={{ border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, padding: '8px 10px', resize: 'vertical' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {L('例句译文', 'Example Translation')}
            <textarea
              value={vocabDraft.translation}
              rows={2}
              onChange={(ev) =>
                setVocabDraft((d) => ({ ...d, translation: ev.target.value }))
              }
              style={{ border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, padding: '8px 10px', resize: 'vertical' }}
            />
          </label>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn-tonal" onClick={closeEditors}>
              {L('取消', 'Cancel')}
            </button>
            <button
              type="button"
              className="btn-export btn-export-primary"
              disabled={!vocabDraft.term.trim()}
              onClick={() => {
                updateVocabItem(editingStudy!.id, {
                  term: vocabDraft.term.trim(),
                  meaning: vocabDraft.meaning.trim(),
                  example: vocabDraft.example.trim(),
                  translation: vocabDraft.translation.trim(),
                });
                closeEditors();
              }}
            >
              {L('保存', 'Save')}
            </button>
          </div>
        </EditItemOverlay>

        <EditItemOverlay
          open={editingStudy?.kind === 'grammar'}
          title={L('编辑重点语法', 'Edit Key Grammar')}
          onClose={closeEditors}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {L('语法点', 'Grammar Point')}
            <input
              value={grammarDraft.titlePrimary}
              onChange={(ev) =>
                setGrammarDraft((d) => ({ ...d, titlePrimary: ev.target.value }))
              }
              style={{ border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, padding: '8px 10px' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {L('旁注释义', 'Definition')}
            <input
              value={grammarDraft.titleSecondary}
              onChange={(ev) =>
                setGrammarDraft((d) => ({ ...d, titleSecondary: ev.target.value }))
              }
              style={{ border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, padding: '8px 10px' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {L('详细解析', 'Detailed Analysis')}
            <textarea
              value={grammarDraft.detail}
              rows={3}
              onChange={(ev) =>
                setGrammarDraft((d) => ({ ...d, detail: ev.target.value }))
              }
              style={{ border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, padding: '8px 10px', resize: 'vertical' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {L('例句', 'Example')}
            <textarea
              value={grammarDraft.example}
              rows={2}
              onChange={(ev) =>
                setGrammarDraft((d) => ({ ...d, example: ev.target.value }))
              }
              style={{ border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, padding: '8px 10px', resize: 'vertical' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {L('例句译文', 'Example Translation')}
            <textarea
              value={grammarDraft.translation}
              rows={2}
              onChange={(ev) =>
                setGrammarDraft((d) => ({ ...d, translation: ev.target.value }))
              }
              style={{ border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, padding: '8px 10px', resize: 'vertical' }}
            />
          </label>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn-tonal" onClick={closeEditors}>
              {L('取消', 'Cancel')}
            </button>
            <button
              type="button"
              className="btn-export btn-export-primary"
              disabled={!grammarDraft.titlePrimary.trim()}
              onClick={() => {
                updateGrammarItem(editingStudy!.id, {
                  titlePrimary: grammarDraft.titlePrimary.trim(),
                  titleSecondary: grammarDraft.titleSecondary.trim(),
                  detail: grammarDraft.detail.trim(),
                  example: grammarDraft.example.trim(),
                  translation: grammarDraft.translation.trim(),
                });
                closeEditors();
              }}
            >
              {L('保存', 'Save')}
            </button>
          </div>
        </EditItemOverlay>
    </div>
  );
}
