import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import InkFineTuneEditor from '../InkFineTuneEditor';
import InkToolbox from '../InkToolbox';
import ShufuriPosterEditCanvas from '../ShufuriPosterEditCanvas';
import ExplainMicroscopePanel from '../ExplainMicroscopePanel';
import EditNotebookPane from '../EditNotebookPane';
import {
  usePosterDocumentContext,
  usePosterInkContext,
  usePosterTypographyContext,
} from '../../context/PosterWorkspaceContext';
import { useEditCanvasScrollPerfProbe } from '../../hooks/useEditCanvasScrollPerfProbe';
import { useEditCanvasScrollInteractionLock } from '../../hooks/useEditCanvasScrollInteractionLock';
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
  } = usePosterDocumentContext();

  const { showRubyAnnotations, rubyToggleSupported, handleShowRubyChange } =
    usePosterTypographyContext();

  const ink = usePosterInkContext();
  const showToast = useAppToast();
  const isDesktopSplit = useMediaQuery(EDIT_DESKTOP_SPLIT_QUERY);
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
  const explain = useExplainSession({
    title,
    artist,
    lyrics,
    lang,
    savedProjectId,
    showToast,
    appendExplainNote: appendExplainNoteAndScroll,
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

  /** 划词开启时禁用铅笔点选；铅笔模式与侧栏开合解耦 */
  const inkEditArmed = ink.inkEditMode && !explain.explainMode;
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
    if (explain.explainMode) {
      showToast(L('划词已开启：在左侧选中词语', 'Selection mode on: select text on the left.'));
      return;
    }
    ink.closeInkPopover();
    ink.setInkEditMode(false);
    explain.arm();
    collapseToolbox();
    showToast(L('划词已开启：选中后先出本地释义，需要时再点 AI讲解', 'Selection mode on: shows local definition first, tap "AI Explain" for more.'));
  }, [collapseToolbox, explain, ink, showToast]);

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

  // 讲解模式：用 Highlighter Brush（笔刷涂抹）彻底替代原生划词。
  // 笔刷计算出的选区文本 + 上下文原样喂给 analyzeSelection，不改 AI 管线。
  useEffect(() => {
    if (!explain.explainMode) return;
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
    brushBodyHtml,
    explain.analyzeSelection,
    showToast,
    lang,
  ]);

  return (
    <div
      className={`edit-area${explain.panelOpen ? ' edit-area--explain' : ''}${
        isDesktopSplit ? ' edit-area--desktop-split' : ''
      }`}
    >
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

      <div className="edit-area__workspace">
        <div className="edit-area__lyrics-pane">
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
          <div ref={editCanvasRef} className={scrollClass}>
            <InkFineTuneEditor
              containerRef={editCanvasRef}
              focusGroupIndex={ink.inkFocusGroupIndex}
              editTarget={ink.inkEditTarget}
              popoverClosing={ink.inkPopoverClosing}
              draftKanji={ink.inkDraftKanji}
              draftKana={ink.inkDraftKana}
              draftZh={ink.inkDraftZh}
              draftTitle={ink.inkDraftTitle}
              draftArtist={ink.inkDraftArtist}
              draftJp={ink.inkDraftJp}
              interaction="click"
              interactionEnabled={inkEditArmed}
              onOpenTarget={ink.handleInkOpenTarget}
              onClose={ink.closeInkPopover}
              onKanjiChange={ink.setInkDraftKanji}
              onKanaChange={ink.setInkDraftKana}
              onZhChange={ink.setInkDraftZh}
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
          <EditNotebookPane
            bodyHtml={bodyHtml}
            explainMode={explain.explainMode}
            aiOpen={explain.panelOpen}
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
              explain.panelOpen ? (
                <ExplainMicroscopePanel session={explain} variant="embedded" />
              ) : null
            }
          />
        ) : (
          <ExplainMicroscopePanel session={explain} />
        )}
      </div>

        {editingNoteId && (
          <div
            role="dialog"
            aria-modal="true"
            className="shufuri-explain-note-editor-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeEditors();
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
              background: 'rgba(15, 23, 42, 0.35)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              paddingTop: 84,
              overflowY: 'auto',
            }}
          >
            <div
              className="shufuri-explain-note-editor-panel"
              style={{
                width: 'min(560px, calc(100vw - 32px))',
                background: '#ffffff',
                borderRadius: 14,
                boxShadow: '0 16px 48px rgba(15, 23, 42, 0.18)',
                border: '1px solid rgba(148, 163, 184, 0.35)',
                padding: 16,
              }}
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

        {editingStudy?.kind === 'vocab' && (
          <div
            role="dialog"
            aria-modal="true"
            className="shufuri-explain-note-editor-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeEditors();
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
              background: 'rgba(15, 23, 42, 0.35)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              paddingTop: 84,
              overflowY: 'auto',
            }}
          >
            <div
              className="shufuri-explain-note-editor-panel"
              style={{
                width: 'min(560px, calc(100vw - 32px))',
                background: '#ffffff',
                borderRadius: 14,
                boxShadow: '0 16px 48px rgba(15, 23, 42, 0.18)',
                border: '1px solid rgba(148, 163, 184, 0.35)',
                padding: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, letterSpacing: '0.02em' }}>{L('编辑重点词汇', 'Edit Key Vocabulary')}</h3>
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
                      updateVocabItem(editingStudy.id, {
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
              </div>
            </div>
          </div>
        )}

        {editingStudy?.kind === 'grammar' && (
          <div
            role="dialog"
            aria-modal="true"
            className="shufuri-explain-note-editor-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeEditors();
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
              background: 'rgba(15, 23, 42, 0.35)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              paddingTop: 84,
              overflowY: 'auto',
            }}
          >
            <div
              className="shufuri-explain-note-editor-panel"
              style={{
                width: 'min(560px, calc(100vw - 32px))',
                background: '#ffffff',
                borderRadius: 14,
                boxShadow: '0 16px 48px rgba(15, 23, 42, 0.18)',
                border: '1px solid rgba(148, 163, 184, 0.35)',
                padding: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, letterSpacing: '0.02em' }}>{L('编辑重点语法', 'Edit Key Grammar')}</h3>
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
                      updateGrammarItem(editingStudy.id, {
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
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
