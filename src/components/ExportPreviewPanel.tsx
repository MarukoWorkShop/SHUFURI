import ShufuriPosterPreview from './ShufuriPosterPreview';
import PosterLayoutWheel from './PosterLayoutWheel';
import ArrowLeftIcon from './icons/ArrowLeftIcon';
import {
  usePosterDocumentContext,
  usePosterTypographyContext,
} from '../context/PosterWorkspaceContext';

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
            aria-label="返回编辑"
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
          <span className="page-count">共 {pages.length} 页</span>
          {repaginating && <span className="preview-repaginate-hint">排版中…</span>}
          <span className="export-gallery-hint">长按页面保存到图库</span>
          <div className="export-buttons">
            <button
              type="button"
              className="btn-export btn-export-save"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? '保存中…' : '保存'}
            </button>
            <button
              type="button"
              className="btn-export btn-export-pdf"
              onClick={() => void handleExportPdf()}
              disabled={exporting}
            >
              {exporting ? '导出中…' : '导出 PDF'}
            </button>
          </div>
        </div>
      </div>

      <div ref={exportPagesRef} className="preview-pages-fit">
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
