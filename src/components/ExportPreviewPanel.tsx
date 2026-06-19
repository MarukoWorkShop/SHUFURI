import { useState, type RefObject } from 'react';
import ShufuriPosterPreview from './ShufuriPosterPreview';
import PosterLayoutWheel from './PosterLayoutWheel';
import AudioLinesIcon from './icons/AudioLinesIcon';
import ArrowLeftIcon from './icons/ArrowLeftIcon';
import type { PosterLayoutProfile, PosterPageSlice, PosterRenderOptions } from '../utils/shufuriPoster/types';
import {
  PREVIEW_FONT_SCALE_MAX,
  PREVIEW_FONT_SCALE_MIN,
  PREVIEW_LINE_SCALE_MAX,
  PREVIEW_LINE_SCALE_MIN,
  type PreviewTypography,
} from '../utils/shufuriPoster/types';
import type { LyricsLanguage, LangCode } from '../services/appSettings';

type Props = {
  pages: PosterPageSlice[];
  title: string;
  artist?: string;
  layoutProfile: PosterLayoutProfile;
  displayScale: number;
  exporting: boolean;
  saving: boolean;
  repaginating: boolean;
  showRuby: boolean;
  rubySupported: boolean;
  previewTypography: PreviewTypography;
  previewPagesRef: RefObject<HTMLDivElement | null>;
  onBackToEdit: () => void;
  onLayoutChange: (profile: PosterLayoutProfile) => void;
  onSave: () => void;
  onExportPdf: () => void;
  onShowRubyChange: (show: boolean) => void;
  onPreviewTypographyChange: (next: PreviewTypography) => void;
  onPreviewTypographyCommit: () => void;
  captureRef: (index: number) => (el: HTMLDivElement | null) => void;
  language?: LyricsLanguage;
  lang?: LangCode;
  renderOptions: PosterRenderOptions;
};

function formatPercent(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

export default function ExportPreviewPanel({
  pages,
  title,
  artist,
  layoutProfile,
  displayScale,
  exporting,
  saving,
  repaginating,
  showRuby,
  rubySupported,
  previewTypography,
  previewPagesRef,
  onBackToEdit,
  onLayoutChange,
  onSave,
  onExportPdf,
  onShowRubyChange,
  onPreviewTypographyChange,
  onPreviewTypographyCommit,
  captureRef,
  language = 'jp',
  lang,
  renderOptions,
}: Props) {
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
            onClick={onBackToEdit}
          >
            <ArrowLeftIcon className="preview-back-btn__icon" />
          </button>
          <PosterLayoutWheel
            value={layoutProfile}
            onChange={(profile) => onLayoutChange(profile)}
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
            <button
              type="button"
              className={`preview-pronunciation-btn${showRuby ? ' is-on' : ''}`}
              aria-label={showRuby ? '隐藏发音标注' : '显示发音标注'}
              aria-pressed={showRuby}
              disabled={!rubySupported || densityDisabled}
              onClick={() => onShowRubyChange(!showRuby)}
            >
              <AudioLinesIcon className="preview-pronunciation-btn__icon" />
            </button>

            <label className="preview-density-control preview-density-control--vertical">
              <span className="preview-density-control__label">字号</span>
              <input
                type="range"
                className="preview-density-control__range preview-density-control__range--vertical"
                min={PREVIEW_FONT_SCALE_MIN}
                max={PREVIEW_FONT_SCALE_MAX}
                step={0.02}
                value={previewTypography.fontScale}
                disabled={densityDisabled}
                onChange={(e) =>
                  onPreviewTypographyChange({
                    ...previewTypography,
                    fontScale: Number(e.target.value),
                  })
                }
                onPointerUp={onPreviewTypographyCommit}
                onTouchEnd={onPreviewTypographyCommit}
              />
              <span className="preview-density-control__value">
                {formatPercent(previewTypography.fontScale)}
              </span>
            </label>

            <label className="preview-density-control preview-density-control--vertical">
              <span className="preview-density-control__label">行距</span>
              <input
                type="range"
                className="preview-density-control__range preview-density-control__range--vertical"
                min={PREVIEW_LINE_SCALE_MIN}
                max={PREVIEW_LINE_SCALE_MAX}
                step={0.02}
                value={previewTypography.lineHeightScale}
                disabled={densityDisabled}
                onChange={(e) =>
                  onPreviewTypographyChange({
                    ...previewTypography,
                    lineHeightScale: Number(e.target.value),
                  })
                }
                onPointerUp={onPreviewTypographyCommit}
                onTouchEnd={onPreviewTypographyCommit}
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
                onPreviewTypographyChange({ fontScale: 1, lineHeightScale: 1 });
                onPreviewTypographyCommit();
              }}
            >
              重置
            </button>

            {repaginating && <span className="preview-repaginate-hint">排版中…</span>}
          </div>
        </div>

        <div className="preview-toolbar-actions">
          <span className="page-count">共 {pages.length} 页</span>
          <span className="export-gallery-hint">长按页面保存到图库</span>
          <div className="export-buttons">
            <button
              type="button"
              className="btn-export btn-export-save"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? '保存中…' : '保存'}
            </button>
            <button
              type="button"
              className="btn-export btn-export-pdf"
              onClick={onExportPdf}
              disabled={exporting}
            >
              {exporting ? '导出中…' : '导出 PDF'}
            </button>
          </div>
        </div>
      </div>

      <div ref={previewPagesRef} className="preview-pages-fit">
        <ShufuriPosterPreview
          title={title}
          artist={artist}
          pageSlices={pages}
          layoutProfile={layoutProfile}
          displayScale={displayScale}
          language={language}
          lang={lang}
          renderOptions={renderOptions}
          captureRef={captureRef}
        />
      </div>
    </div>
  );
}
