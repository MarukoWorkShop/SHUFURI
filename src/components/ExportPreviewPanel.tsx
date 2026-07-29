import ShufuriPosterPreview from './ShufuriPosterPreview';
import PosterLayoutWheel from './PosterLayoutWheel';
import ArrowLeftIcon from './icons/ArrowLeftIcon';
import {
  usePosterDocumentContext,
  usePosterTypographyContext,
} from '../context/PosterWorkspaceContext';
import { L } from '../utils/i18n';

export default function ExportPreviewPanel() {
  const {
    pages,
    title,
    artist,
    layoutProfile,
    exportScale,
    exporting,
    saving,
    lyricsLanguage,
    lang,
    exportPagesRef,
    handleBackToEdit,
    handleLayoutChange,
    handleSave,
    handleExportPdf,
    capturePageRef,
  } = usePosterDocumentContext();

  const { repaginating, posterRenderOpts } = usePosterTypographyContext();

  return (
    <div className="preview-area export-area">
      <div className="preview-toolbar">
        <div className="preview-toolbar-nav">
          <button
            type="button"
            className="preview-back-btn"
            aria-label={L('返回编辑', 'Back to editor')}
            onClick={handleBackToEdit}
          >
            <ArrowLeftIcon className="preview-back-btn__icon" />
          </button>
          <PosterLayoutWheel
            value={layoutProfile}
            onChange={(profile) => void handleLayoutChange(profile)}
          />
        </div>

        <div className="preview-toolbar-actions">
          <span className="page-count">
            {L(`共 ${pages.length} 页`, `${pages.length} pages in total`)}
          </span>
          {repaginating && (
            <span className="preview-repaginate-hint">{L('排版中…', 'Repaginating…')}</span>
          )}
          <span className="export-gallery-hint">
            {L('长按页面保存到图库', 'Long-press a page to save to gallery')}
          </span>
          <div className="export-buttons">
            <button
              type="button"
              className="btn-export btn-export-save"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? L('保存中…', 'Saving…') : L('保存', 'Save')}
            </button>
            <button
              type="button"
              className="btn-export btn-export-pdf"
              onClick={() => void handleExportPdf()}
              disabled={exporting}
            >
              {exporting ? L('导出中…', 'Exporting…') : L('导出 PDF', 'Export PDF')}
            </button>
          </div>
        </div>
      </div>

      <div ref={exportPagesRef} className="preview-pages-fit export-pages-scroll">
        <ShufuriPosterPreview
          title={title}
          artist={artist}
          pageSlices={pages}
          layoutProfile={layoutProfile}
          displayScale={exportScale}
          language={lyricsLanguage}
          lang={lang}
          renderOptions={posterRenderOpts}
          captureRef={capturePageRef}
        />
      </div>
    </div>
  );
}
