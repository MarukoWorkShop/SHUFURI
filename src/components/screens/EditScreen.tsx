import InkFineTuneEditor from '../InkFineTuneEditor';
import InkToolbox from '../InkToolbox';
import ShufuriPosterEditCanvas from '../ShufuriPosterEditCanvas';
import {
  usePosterDocumentContext,
  usePosterInkContext,
  usePosterTypographyContext,
} from '../../context/PosterWorkspaceContext';

export default function EditScreen() {
  const {
    bodyHtml,
    title,
    artist,
    titleMarkupHtml,
    lang,
    lyricsLanguage,
    colorTheme,
    handleReset,
    saving,
    handleSave,
    enterExportFlow,
    editCanvasRef,
    editScale,
  } = usePosterDocumentContext();

  const { showRubyAnnotations, rubyToggleSupported, handleShowRubyChange } =
    usePosterTypographyContext();

  const ink = usePosterInkContext();

  return (
    <div className="edit-area">
      <InkToolbox
        open={ink.inkToolboxOpen}
        canUndo={ink.canUndoInkEdit}
        inkEditActive={ink.inkEditTarget !== null}
        showRuby={showRubyAnnotations}
        rubySupported={rubyToggleSupported}
        onToggle={() => ink.setInkToolboxOpen((v) => !v)}
        onUndo={ink.handleInkUndo}
        onShowRubyChange={handleShowRubyChange}
      />
      <div className="edit-toolbar">
        <button type="button" className="btn-secondary" onClick={handleReset}>
          ← 重新输入
        </button>
        <div className="toolbar-actions">
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

      <div ref={editCanvasRef} className="edit-canvas-scroll">
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
    </div>
  );
}
