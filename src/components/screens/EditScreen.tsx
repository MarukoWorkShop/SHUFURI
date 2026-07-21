import { useCallback, useEffect, useState } from 'react';
import InkFineTuneEditor from '../InkFineTuneEditor';
import InkToolbox from '../InkToolbox';
import ShufuriPosterEditCanvas from '../ShufuriPosterEditCanvas';
import ExplainMicroscopePanel from '../ExplainMicroscopePanel';
import {
  usePosterDocumentContext,
  usePosterInkContext,
  usePosterTypographyContext,
} from '../../context/PosterWorkspaceContext';
import { useEditCanvasScrollPerfProbe } from '../../hooks/useEditCanvasScrollPerfProbe';
import { useEditCanvasScrollInteractionLock } from '../../hooks/useEditCanvasScrollInteractionLock';
import { useExplainSession } from '../../hooks/useExplainSession';
import { useAppToast } from '../../context/AppToastContext';
import { readSelectionForExplain, clampSelectionToExplainBlock } from '../../utils/readSelectionForExplain';
import {
  readVocabItemFromElement,
  readGrammarItemFromElement,
  type VocabItemPayload,
  type GrammarItemPayload,
} from '../../utils/studySectionItems';

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
        const el = editCanvasRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      });
    },
    [appendExplainNote, editCanvasRef],
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
        showToast('笔记已刷新，请再点一次编辑');
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
        showToast('条目已刷新，请再点一次编辑');
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
      showToast('已退出铅笔编辑');
      return;
    }
    if (explain.explainMode) explain.disarm();
    ink.setInkEditMode(true);
    collapseToolbox();
    showToast('铅笔编辑已开启：点选注音或译文');
  }, [collapseToolbox, explain, ink, showToast]);

  const handleToggleExplain = useCallback(() => {
    if (explain.explainMode) {
      explain.disarm();
      collapseToolbox();
      showToast('已退出划词解释');
      return;
    }
    ink.closeInkPopover();
    ink.setInkEditMode(false);
    explain.arm();
    collapseToolbox();
    showToast('划词已开启：选中后先出本地释义，需要时再点 AI讲解');
  }, [collapseToolbox, explain, ink, showToast]);

  const handleRubyChangeAndCollapse = useCallback(
    (show: boolean) => {
      handleShowRubyChange(show);
      collapseToolbox();
    },
    [collapseToolbox, handleShowRubyChange],
  );

  useEffect(() => {
    if (!explain.explainMode) return;

    let timer = 0;
    const onUp = () => {
      window.clearTimeout(timer);
      // WKWebView 松手后选区可能略晚稳定
      timer = window.setTimeout(() => {
        void (async () => {
          const sel = window.getSelection();
          if (sel?.anchorNode) {
            const el =
              sel.anchorNode.nodeType === Node.ELEMENT_NODE
                ? (sel.anchorNode as Element)
                : sel.anchorNode.parentElement;
            // 划词笔记 / 学习条目区内的选区不触发 AI，留给条目编辑
            if (el?.closest('.shufuri-explain-note, .shufuri-study-item')) return;
          }
          const snapJp = (lang ?? lyricsLanguage ?? 'jp') === 'jp';
          const picked = await readSelectionForExplain({
            enableJapaneseTokenSnap: snapJp,
          });
          if (!picked) return;
          explain.analyzeSelection(picked.text, picked);
        })();
      }, 40);
    };

    /** 拖选过程中实时钳到单行/单块，避免蓝选区跨日文行+译文 */
    let clamping = false;
    const onSelectionChange = () => {
      if (clamping) return;
      const root = editCanvasRef.current;
      if (!root) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount < 1) return;
      const anchorEl =
        sel.anchorNode?.nodeType === Node.ELEMENT_NODE
          ? (sel.anchorNode as Element)
          : sel.anchorNode?.parentElement;
      if (!anchorEl || !root.contains(anchorEl)) return;
      clamping = true;
      try {
        clampSelectionToExplainBlock(sel);
      } finally {
        clamping = false;
      }
    };

    const root = editCanvasRef.current;
    root?.addEventListener('mouseup', onUp);
    root?.addEventListener('touchend', onUp);
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      window.clearTimeout(timer);
      root?.removeEventListener('mouseup', onUp);
      root?.removeEventListener('touchend', onUp);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [
    editCanvasRef,
    explain.explainMode,
    explain.analyzeSelection,
    lang,
    lyricsLanguage,
  ]);

  const scrollClass = [
    'edit-canvas-scroll',
    inkEditArmed ? 'is-ink-edit-armed' : '',
    explain.explainMode ? 'is-explain-mode' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`edit-area${explain.panelOpen ? ' edit-area--explain' : ''}`}>
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
      <div className="edit-toolbar">
        <button type="button" className="btn-secondary" onClick={handleReset}>
          ← 重新输入
        </button>
        <div className="toolbar-actions">
          {explain.explainMode && (
            <span className="preview-explain-hint">划词解释中</span>
          )}
          <button
            type="button"
            className="btn-export btn-export-save"
            onClick={() => void handleSave()}
            disabled={saving || !bodyHtml.trim()}
          >
            {saving ? '保存中…' : '保存'}
          </button>
          <button
            type="button"
            className="btn-export btn-export-primary"
            onClick={() => void enterExportFlow()}
            disabled={!bodyHtml.trim()}
          >
            导出
          </button>
        </div>
      </div>

      <div className="edit-area__workspace">
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
            interaction="click"
            interactionEnabled={inkEditArmed}
            onOpenTarget={ink.handleInkOpenTarget}
            onClose={ink.closeInkPopover}
            onKanjiChange={ink.setInkDraftKanji}
            onKanaChange={ink.setInkDraftKana}
            onZhChange={ink.setInkDraftZh}
            onTitleChange={ink.setInkDraftTitle}
            onArtistChange={ink.setInkDraftArtist}
            onConfirm={() => void ink.handleInkConfirm()}
          >
            <ShufuriPosterEditCanvas
              title={title}
              artist={artist}
              bodyHtml={bodyHtml}
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

        <ExplainMicroscopePanel session={explain} />

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
                <h3 style={{ margin: 0, fontSize: 15, letterSpacing: '0.02em' }}>编辑划词笔记</h3>
                <button
                  type="button"
                  aria-label="关闭"
                  className="btn-tonal"
                  onClick={closeEditors}
                  style={{ minHeight: 30, padding: '0 10px' }}
                >
                  ×
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  词条
                  <input
                    className="shufuri-explain-note-editor__input"
                    value={draftTerm}
                    onChange={(ev) => setDraftTerm(ev.target.value)}
                    style={{ border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, padding: '8px 10px' }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  语境释义
                  <textarea
                    value={draftContextSense}
                    rows={2}
                    onChange={(ev) => setDraftContextSense(ev.target.value)}
                    style={{ border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, padding: '8px 10px', resize: 'vertical' }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  语法
                  <textarea
                    value={draftGrammar}
                    rows={2}
                    onChange={(ev) => setDraftGrammar(ev.target.value)}
                    style={{ border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, padding: '8px 10px', resize: 'vertical' }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  意境
                  <textarea
                    value={draftMood}
                    rows={2}
                    onChange={(ev) => setDraftMood(ev.target.value)}
                    style={{ border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, padding: '8px 10px', resize: 'vertical' }}
                  />
                </label>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button type="button" className="btn-tonal" onClick={closeEditors}>
                    取消
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
                    保存
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
                <h3 style={{ margin: 0, fontSize: 15, letterSpacing: '0.02em' }}>编辑重点词汇</h3>
                <button
                  type="button"
                  aria-label="关闭"
                  className="btn-tonal"
                  onClick={closeEditors}
                  style={{ minHeight: 30, padding: '0 10px' }}
                >
                  ×
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  词条
                  <input
                    value={vocabDraft.term}
                    onChange={(ev) =>
                      setVocabDraft((d) => ({ ...d, term: ev.target.value }))
                    }
                    style={{ border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, padding: '8px 10px' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  释义
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
                  例句
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
                  例句译文
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
                    取消
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
                    保存
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
                <h3 style={{ margin: 0, fontSize: 15, letterSpacing: '0.02em' }}>编辑重点语法</h3>
                <button
                  type="button"
                  aria-label="关闭"
                  className="btn-tonal"
                  onClick={closeEditors}
                  style={{ minHeight: 30, padding: '0 10px' }}
                >
                  ×
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  语法点
                  <input
                    value={grammarDraft.titlePrimary}
                    onChange={(ev) =>
                      setGrammarDraft((d) => ({ ...d, titlePrimary: ev.target.value }))
                    }
                    style={{ border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, padding: '8px 10px' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  旁注释义
                  <input
                    value={grammarDraft.titleSecondary}
                    onChange={(ev) =>
                      setGrammarDraft((d) => ({ ...d, titleSecondary: ev.target.value }))
                    }
                    style={{ border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, padding: '8px 10px' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  详细解析
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
                  例句
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
                  例句译文
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
                    取消
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
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
