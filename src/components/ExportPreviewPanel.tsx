import { useState } from 'react';
import ShufuriPosterPreview from './ShufuriPosterPreview';
import PosterLayoutWheel from './PosterLayoutWheel';
import ArrowLeftIcon from './icons/ArrowLeftIcon';
import PosterRubyToggleButton from './PosterRubyToggleButton';
import {
  usePosterDocumentContext,
  usePosterTypographyContext,
} from '../context/PosterWorkspaceContext';
import {
  PREVIEW_FONT_SCALE_MAX,
  PREVIEW_FONT_SCALE_MIN,
  PREVIEW_LINE_SCALE_MAX,
  PREVIEW_LINE_SCALE_MIN,
} from '../utils/shufuriPoster/types';

function formatPercent(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

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
    showRubyAnnotations,
    rubyToggleSupported,
    previewTypography,
    repaginating,
    posterRenderOpts,
    handleShowRubyChange,
    setPreviewTypography,
    scheduleRebuildExportPages,
  } = usePosterTypographyContext();

  const densityDisabled = exporting || saving || repaginating;
  const [densityOpen, setDensityOpen] = useState(false);

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

        <div className="preview-density-toggle-wrap">
          <button
            type="button"
            className={`preview-density-toggle${densityOpen ? ' is-open' : ''}`}
            aria-expanded={densityOpen}
            aria-controls="preview-density-panel"
            aria-label={densityOpen ? '收起文本调节' : '展开文本调节'}
            onClick={() => setDensityOpen((v) => !v)}
          >
            <span className="preview-density-toggle__chevron" aria-hidden />
          </button>
          {repaginating && !densityOpen && (
            <span className="preview-repaginate-hint preview-repaginate-hint--beside-toggle">
              排版中…
            </span>
          )}
        </div>

        <div
          id="preview-density-panel"
          className={`preview-toolbar-density-panel${densityOpen ? ' is-open' : ''}`}
          hidden={!densityOpen}
        >
          <div className="preview-toolbar-density">
            <div className="preview-toolbar-density__row">
              <PosterRubyToggleButton
                showRuby={showRubyAnnotations}
                disabled={!rubyToggleSupported || densityDisabled}
                onClick={() => handleShowRubyChange(!showRubyAnnotations)}
              />

              <label className="preview-density-control preview-density-control--horizontal">
                <span className="preview-density-control__label">字号</span>
                <input
                  type="range"
                  className="preview-density-control__range"
                  min={PREVIEW_FONT_SCALE_MIN}
                  max={PREVIEW_FONT_SCALE_MAX}
                  step={0.02}
                  value={previewTypography.fontScale}
                  disabled={densityDisabled}
                  onChange={(e) =>
                    setPreviewTypography({
                      ...previewTypography,
                      fontScale: Number(e.target.value),
                    })
                  }
                  onPointerUp={scheduleRebuildExportPages}
                  onTouchEnd={scheduleRebuildExportPages}
                />
                <span className="preview-density-control__value">
                  {formatPercent(previewTypography.fontScale)}
                </span>
              </label>

              <label className="preview-density-control preview-density-control--horizontal">
                <span className="preview-density-control__label">行距</span>
                <input
                  type="range"
                  className="preview-density-control__range"
                  min={PREVIEW_LINE_SCALE_MIN}
                  max={PREVIEW_LINE_SCALE_MAX}
                  step={0.02}
                  value={previewTypography.lineHeightScale}
                  disabled={densityDisabled}
                  onChange={(e) =>
                    setPreviewTypography({
                      ...previewTypography,
                      lineHeightScale: Number(e.target.value),
                    })
                  }
                  onPointerUp={scheduleRebuildExportPages}
                  onTouchEnd={scheduleRebuildExportPages}
                />
                <span className="preview-density-control__value">
                  {formatPercent(previewTypography.lineHeightScale)}
                </span>
              </label>

              <button
                type="button"
                className="preview-density-reset"
                disabled={
                  densityDisabled ||
                  (previewTypography.fontScale === 1 && previewTypography.lineHeightScale === 1)
                }
                onClick={() => {
                  setPreviewTypography({ fontScale: 1, lineHeightScale: 1 });
                  scheduleRebuildExportPages();
                }}
              >
                重置
              </button>

              {repaginating && <span className="preview-repaginate-hint">排版中…</span>}
            </div>
          </div>
        </div>

        <div className="preview-toolbar-actions">
          <span className="page-count">共 {pages.length} 页</span>
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
