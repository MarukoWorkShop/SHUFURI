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
import { readSelectionForExplain } from '../../utils/readSelectionForExplain';

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

  // —— 划词笔记条目：删除 / 自主编辑 ——
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [draftTerm, setDraftTerm] = useState('');
  const [draftContextSense, setDraftContextSense] = useState('');
  const [draftGrammar, setDraftGrammar] = useState('');
  const [draftMood, setDraftMood] = useState('');

  const canEditNotes = !explain.explainMode;

  const openEditForNoteEl = useCallback((noteEl: HTMLElement) => {
    const noteId = noteEl.getAttribute('data-shufuri-explain-note-id') ?? '';
    if (!noteId) return;

    const termEl = noteEl.querySelector('.vocab-line1 span[class^="vocab-word"]') as HTMLElement | null;
    const meaningEl = noteEl.querySelector('.vocab-line1 .vocab-meaning') as HTMLElement | null;
    const grammarEl = noteEl.querySelector('.grammar-detail') as HTMLElement | null;
    const moodEl = noteEl.querySelector('.vocab-ex-zh') as HTMLElement | null;

    setEditingNoteId(noteId);
    setDraftTerm(termEl?.textContent?.trim() ?? '');
    setDraftContextSense(meaningEl?.textContent?.trim() ?? '');
    setDraftGrammar(grammarEl?.textContent?.trim() ?? '');
    setDraftMood(moodEl?.textContent?.trim() ?? '');
  }, []);

  useEffect(() => {
    const root = editCanvasRef.current;
    if (!root) return;

    const onClickCapture = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;

      const deleteBtn = target.closest('.shufuri-explain-note__delete') as HTMLElement | null;
      if (deleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const noteId = deleteBtn.getAttribute('data-shufuri-explain-note-id') ?? '';
        if (noteId) {
          removeExplainNote(noteId);
          if (editingNoteId === noteId) setEditingNoteId(null);
        }
        return;
      }

      if (!canEditNotes) return;
      const noteEl = target.closest(
        '.shufuri-explain-note[data-shufuri-explain-note="1"]',
      ) as HTMLElement | null;
      if (!noteEl) return;

      e.preventDefault();
      e.stopPropagation();
      openEditForNoteEl(noteEl);
    };

    const options = { capture: true } as const;
    root.addEventListener('click', onClickCapture, options);
    return () => {
      root.removeEventListener('click', onClickCapture, options);
    };
  }, [canEditNotes, editCanvasRef, openEditForNoteEl, removeExplainNote, editingNoteId]);

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
          const snapJp = (lang ?? lyricsLanguage ?? 'jp') === 'jp';
          const picked = await readSelectionForExplain({
            enableJapaneseTokenSnap: snapJp,
          });
          if (!picked) return;
          explain.analyzeSelection(picked.text, picked);
        })();
      }, 40);
    };

    const root = editCanvasRef.current;
    root?.addEventListener('mouseup', onUp);
    root?.addEventListener('touchend', onUp);
    return () => {
      window.clearTimeout(timer);
      root?.removeEventListener('mouseup', onUp);
      root?.removeEventListener('touchend', onUp);
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
              if (e.target === e.currentTarget) setEditingNoteId(null);
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
                  onClick={() => setEditingNoteId(null)}
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
                  <button type="button" className="btn-tonal" onClick={() => setEditingNoteId(null)}>
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
                      setEditingNoteId(null);
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
