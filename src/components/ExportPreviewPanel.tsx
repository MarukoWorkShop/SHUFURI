import type { RefObject } from 'react';
import FuriganaHtmlPosterPreview from './FuriganaPosterPreview';
import PosterLayoutToggle from './PosterLayoutToggle';
import type { PosterLayoutProfile, PosterPageSlice } from '../utils/furiganaLayout/types';
import type { LyricsLanguage, LangCode } from '../services/appSettings';

type Props = {
  pages: PosterPageSlice[];
  title: string;
  artist?: string;
  layoutProfile: PosterLayoutProfile;
  displayScale: number;
  exporting: boolean;
  saving: boolean;
  previewPagesRef: RefObject<HTMLDivElement | null>;
  onBackToEdit: () => void;
  onLayoutChange: (profile: PosterLayoutProfile) => void;
  onSave: () => void;
  onExportPdf: () => void;
  captureRef: (index: number) => (el: HTMLDivElement | null) => void;
  language?: LyricsLanguage;
  lang?: LangCode;
};

export default function ExportPreviewPanel({
  pages,
  title,
  artist,
  layoutProfile,
  displayScale,
  exporting,
  saving,
  previewPagesRef,
  onBackToEdit,
  onLayoutChange,
  onSave,
  onExportPdf,
  captureRef,
  language = 'jp',
  lang,
}: Props) {
  return (
    <div className="preview-area export-area">
      <div className="preview-toolbar">
        <div className="preview-toolbar-left">
          <button type="button" className="btn-secondary" onClick={onBackToEdit}>
            ← 返回编辑
          </button>
        </div>

        <div className="preview-toolbar-center">
          <PosterLayoutToggle
            value={layoutProfile}
            onChange={(profile) => onLayoutChange(profile)}
          />
        </div>

        <div className="preview-toolbar-right">
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
        <FuriganaHtmlPosterPreview
          title={title}
          artist={artist}
          pageSlices={pages}
          layoutProfile={layoutProfile}
          displayScale={displayScale}
          language={language}
          lang={lang}
          captureRef={captureRef}
        />
      </div>
    </div>
  );
}
