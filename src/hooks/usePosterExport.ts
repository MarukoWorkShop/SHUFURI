import { useCallback, useRef, useState } from 'react';
import type { LangCode, LyricsLanguage } from '../services/appSettings';
// 导出链（html2canvas + jspdf）体积大，改为按需动态加载，避免拖慢首屏
import { resolveExportTitle } from '../utils/shufuriPoster/posterTitle';
import { ensurePosterFontsLoaded } from '../utils/shufuriPoster/fonts';
import { buildPosterPagesFromBody } from '../utils/shufuriPoster/buildPosterPages';
import type {
  PosterLayoutProfile,
  PosterPageSlice,
  PosterRenderOptions,
} from '../utils/shufuriPoster/types';
import { postToNative } from '../bridge/nativeBridge';
import { L } from '../utils/i18n';
import type { ShowAppToast } from '../context/AppToastContext';

const EXPORT_DEADLINE_MS = 180_000;

type WorkspaceRefs = {
  bodyHtmlRef: { current: string };
  titleRef: { current: string };
  artistRef: { current: string };
  pagesRef: { current: PosterPageSlice[] };
  layoutProfileRef: { current: PosterLayoutProfile };
  titleMarkupHtmlRef: { current: string | undefined };
};

type Options = WorkspaceRefs & {
  pages: PosterPageSlice[];
  title: string;
  layoutProfile: PosterLayoutProfile;
  artist: string;
  lyricsLanguage: LyricsLanguage;
  lang: LangCode | undefined;
  posterRenderOpts: PosterRenderOptions;
  showRubyRef: { current: boolean };
  previewTypographyRef: { current: import('../utils/shufuriPoster/types').PreviewTypography };
  getPosterRenderOpts: () => PosterRenderOptions;
  setPages: (pages: PosterPageSlice[]) => void;
  nativeExportingRef: { current: boolean };
  showToast: ShowAppToast;
};

export function usePosterExport({
  pages,
  title,
  layoutProfile,
  artist,
  lyricsLanguage,
  lang,
  posterRenderOpts,
  bodyHtmlRef,
  titleRef,
  artistRef,
  pagesRef,
  layoutProfileRef,
  titleMarkupHtmlRef,
  showRubyRef,
  previewTypographyRef,
  getPosterRenderOpts,
  setPages,
  nativeExportingRef,
  showToast,
}: Options) {
  const [exporting, setExporting] = useState(false);
  const exportingRef = useRef(false);

  const handleNativeExport = useCallback(async (exportType: string) => {
    if (nativeExportingRef.current) return;
    nativeExportingRef.current = true;
    setExporting(true);

    const currentBodyHtml = bodyHtmlRef.current;
    const currentTitle = titleRef.current;
    const currentArtist = artistRef.current;
    const currentProfile = layoutProfileRef.current;

    if (!currentBodyHtml.trim()) {
      postToNative({ event: 'error', data: { message: L('没有可导出的内容', 'No content to export.') } });
      nativeExportingRef.current = false;
      setExporting(false);
      return;
    }

    try {
      const posterRenderOpts = getPosterRenderOpts();
      await ensurePosterFontsLoaded();
      const currentPages = buildPosterPagesFromBody(
        currentBodyHtml,
        currentTitle,
        currentProfile,
        currentArtist,
        lyricsLanguage,
        lang,
        titleMarkupHtmlRef.current,
        posterRenderOpts,
      );
      pagesRef.current = currentPages;
      setPages(currentPages);

      if (currentPages.length === 0) {
        postToNative({ event: 'error', data: { message: L('分页结果为空', 'No pages to display.') } });
        return;
      }

      const baseFilename = resolveExportTitle(currentTitle);
      const renderOpts = posterRenderOpts;

      // 按需加载导出链（html2canvas + jspdf）
      const { exportPosterPngFromPageHtmls, posterPdfExportFilename } = await import('../utils/pdfExport');
      const { exportPosterPdf } = await import('../utils/exportPosterPdf');

      if (exportType === 'export_pdf') {
        await exportPosterPdf(
          currentPages,
          currentTitle,
          currentProfile,
          currentArtist,
          lyricsLanguage,
          lang,
          renderOpts,
        );
      } else {
        await exportPosterPngFromPageHtmls(
          currentPages,
          currentTitle,
          currentProfile,
          posterPdfExportFilename(baseFilename, currentProfile),
          currentArtist,
          lyricsLanguage,
          lang,
          renderOpts,
        );
      }

      postToNative({
        event: 'export_complete',
        data: {
          type: exportType === 'export_pdf' ? 'pdf' : 'png',
          dataBase64: '',
          filename: baseFilename,
          requestId: '',
        },
      });
    } catch (e) {
      console.error('[native-export]', e);
      postToNative({
        event: 'error',
        data: { message: e instanceof Error ? e.message : L('导出失败', 'Failed to export.') },
      });
    } finally {
      nativeExportingRef.current = false;
      setExporting(false);
    }
  }, [
    bodyHtmlRef,
    titleRef,
    artistRef,
    layoutProfileRef,
    titleMarkupHtmlRef,
    pagesRef,
    lyricsLanguage,
    lang,
    showRubyRef,
    previewTypographyRef,
    setPages,
    nativeExportingRef,
  ]);

  const handleExportPdf = useCallback(async () => {
    if (!pages.length) {
      showToast(L('没有可导出的页面', 'No pages to export.'), 3000);
      return;
    }
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);

    const deadline = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error(L(`导出超时（${EXPORT_DEADLINE_MS / 1000}s），请重试`, `Export timed out (${EXPORT_DEADLINE_MS / 1000}s). Please try again.`))), EXPORT_DEADLINE_MS),
    );

    try {
      const { exportPosterPdf } = await import('../utils/exportPosterPdf');
      await Promise.race([
        exportPosterPdf(
          pages,
          resolveExportTitle(title),
          layoutProfile,
          artist,
          lyricsLanguage,
          lang,
          posterRenderOpts,
        ),
        deadline,
      ]);
    } catch (e) {
      console.error('[export-pdf]', e);
      showToast(e instanceof Error ? e.message : L('导出失败', 'Failed to export.'), 5000);
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }, [pages, layoutProfile, title, artist, lyricsLanguage, lang, posterRenderOpts]);

  return {
    exporting,
    handleExportPdf,
    handleNativeExport,
  };
}
