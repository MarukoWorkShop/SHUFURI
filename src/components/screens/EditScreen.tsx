import { useCallback, useEffect } from 'react';
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
  } = usePosterDocumentContext();

  const { showRubyAnnotations, rubyToggleSupported, handleShowRubyChange } =
    usePosterTypographyContext();

  const ink = usePosterInkContext();
  const showToast = useAppToast();
  const appendExplainNoteAndScroll = useCallback(
    (payload: {
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

  /** 划词模式与铅笔点选互斥：划词开启时不武装墨水编辑 */
  const inkEditArmed = ink.inkToolboxOpen && !explain.explainMode;
  useEditCanvasScrollPerfProbe(editCanvasRef);
  const closeInkOnScrollStart = useCallback(() => {
    if (ink.inkEditTarget) ink.closeInkPopover();
  }, [ink.inkEditTarget, ink.closeInkPopover]);
  useEditCanvasScrollInteractionLock(editCanvasRef, {
    onScrollStart: closeInkOnScrollStart,
  });

  const toggleInkToolbox = useCallback(() => {
    if (ink.inkToolboxOpen) {
      ink.closeInkPopover();
      ink.setInkToolboxOpen(false);
      return;
    }
    ink.setInkToolboxOpen(true);
  }, [ink]);

  const handleToggleExplain = useCallback(() => {
    if (explain.explainMode) {
      explain.disarm();
      showToast('已退出划词解释');
      return;
    }
    ink.closeInkPopover();
    if (!ink.inkToolboxOpen) ink.setInkToolboxOpen(true);
    explain.arm();
    showToast('划词已开启：选中后先出本地释义，需要时再点 AI讲解');
  }, [explain, ink, showToast]);

  useEffect(() => {
    if (!explain.explainMode) return;

    const onUp = () => {
      window.setTimeout(() => {
        const picked = readSelectionForExplain();
        if (!picked) return;
        explain.analyzeSelection(picked.text, picked);
      }, 0);
    };

    const root = editCanvasRef.current;
    root?.addEventListener('mouseup', onUp);
    root?.addEventListener('touchend', onUp);
    return () => {
      root?.removeEventListener('mouseup', onUp);
      root?.removeEventListener('touchend', onUp);
    };
  }, [editCanvasRef, explain.explainMode, explain.analyzeSelection]);

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
        inkEditActive={ink.inkEditTarget !== null}
        showRuby={showRubyAnnotations}
        rubySupported={rubyToggleSupported}
        explainActive={explain.explainMode}
        onToggle={toggleInkToolbox}
        onUndo={ink.handleInkUndo}
        onShowRubyChange={handleShowRubyChange}
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
      </div>
    </div>
  );
}
