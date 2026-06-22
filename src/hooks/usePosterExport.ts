import { useCallback, useRef, useState } from 'react';
import type { LangCode, LyricsLanguage } from '../services/appSettings';
import { exportPosterPdf } from '../utils/exportPosterPdf';
import {
  exportPosterPdfFromPageHtmls,
  exportPosterPngFromPageHtmls,
  posterPdfExportFilename,
} from '../utils/pdfExport';
import { resolveExportTitle } from '../utils/shufuriPoster/posterTitle';
import { ensurePosterFontsLoaded } from '../utils/shufuriPoster/fonts';
import { buildPosterPagesFromBody } from '../utils/shufuriPoster/buildPosterPages';
import { buildPosterRenderOptions } from '../utils/shufuriPoster/types';
import type {
  PosterLayoutProfile,
  PosterPageSlice,
  PosterRenderOptions,
} from '../utils/shufuriPoster/types';
import { postToNative } from '../bridge/nativeBridge';

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
  setPages: (pages: PosterPageSlice[]) => void;
  nativeExportingRef: { current: boolean };
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
  setPages,
  nativeExportingRef,
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
      postToNative({ event: 'error', data: { message: '没有可导出的内容' } });
      nativeExportingRef.current = false;
      setExporting(false);
      return;
    }

    try {
      await ensurePosterFontsLoaded();
      const currentPages = buildPosterPagesFromBody(
        currentBodyHtml,
        currentTitle,
        currentProfile,
        currentArtist,
        lyricsLanguage,
        lang,
        titleMarkupHtmlRef.current,
        buildPosterRenderOptions(showRubyRef.current, previewTypographyRef.current),
      );
      pagesRef.current = currentPages;
      setPages(currentPages);

      if (currentPages.length === 0) {
        postToNative({ event: 'error', data: { message: '分页结果为空' } });
        return;
      }

      const baseFilename = posterPdfExportFilename(resolveExportTitle(currentTitle), currentProfile);
      const renderOpts = buildPosterRenderOptions(showRubyRef.current, previewTypographyRef.current);

      if (exportType === 'export_pdf') {
        await exportPosterPdfFromPageHtmls(
          currentPages,
          currentTitle,
          currentProfile,
          baseFilename,
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
          baseFilename,
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
        data: { message: e instanceof Error ? e.message : '导出失败' },
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
      alert('没有可导出的页面');
      return;
    }
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);

    const deadline = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error(`导出超时（${EXPORT_DEADLINE_MS / 1000}s），请重试`)), EXPORT_DEADLINE_MS),
    );

    try {
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
      alert(e instanceof Error ? e.message : '导出失败');
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
