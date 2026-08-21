import ShufuriPosterPreview from './ShufuriPosterPreview';
import PosterLayoutWheel from './PosterLayoutWheel';
import PosterLayoutVariantPicker from './PosterLayoutVariantPicker';
import ArrowLeftIcon from './icons/ArrowLeftIcon';
import { useCallback, useState } from 'react';
import {
  usePosterDocumentContext,
  usePosterTypographyContext,
} from '../context/PosterWorkspaceContext';
import type { PosterLayoutProfile } from '../utils/shufuriPoster/types';
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

  const {
    repaginating,
    posterRenderOpts,
    layoutVariant,
    handleLayoutVariantChange,
  } = usePosterTypographyContext();
  const [layoutChanging, setLayoutChanging] = useState(false);
  const layoutBusy = layoutChanging || repaginating;

  const onLayoutProfileChange = useCallback(
    async (profile: PosterLayoutProfile) => {
      setLayoutChanging(true);
      try {
        await handleLayoutChange(profile);
      } finally {
        setLayoutChanging(false);
      }
    },
    [handleLayoutChange],
  );

  return (
    <div className="preview-area export-area">
      <div className="preview-toolbar">
        <div className="preview-toolbar-nav">
          <button
            type="button"
            className="preview-back-btn"
            aria-label={L('返回编辑', 'Back to Editor')}
            onClick={handleBackToEdit}
          >
            <ArrowLeftIcon className="preview-back-btn__icon" />
          </button>
          <PosterLayoutWheel
            value={layoutProfile}
            onChange={(profile) => void onLayoutProfileChange(profile)}
          />
        </div>

        <div className="preview-toolbar-actions">
          <span className="page-count">
            {L(`共 ${pages.length} 页`, `${pages.length} pages in total`)}
          </span>
          {layoutBusy && (
            <span className="preview-repaginate-hint">{L('排版中…', 'Formatting layout…')}</span>
          )}
          <span className="export-gallery-hint">
            {L('长按页面保存到图库', 'Long-press a page to save to Photo Library.')}
          </span>
          <div className="export-buttons">
            <button
              type="button"
              className="btn-export btn-export-save"
              onClick={() => void handleSave()}
              disabled={saving || layoutBusy}
            >
              {saving ? L('保存中…', 'Saving…') : L('保存', 'Save')}
            </button>
            <button
              type="button"
              className="btn-export btn-export-pdf"
              onClick={() => void handleExportPdf()}
              disabled={exporting || layoutBusy}
            >
              {exporting ? L('导出中…', 'Exporting…') : L('导出 PDF', 'Export as PDF')}
            </button>
          </div>
        </div>
      </div>

      <PosterLayoutVariantPicker value={layoutVariant} onChange={handleLayoutVariantChange} />

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
