import { useMemo, useRef, useLayoutEffect, useState, useCallback } from 'react';
import type { Ref, CSSProperties } from 'react';
import {
  applyPosterBodyMaxHeight,
  buildShufuriPosterInnerCss,
  buildShufuriPosterRootStyle,
  getShufuriCanvasInsets,
  getShufuriPosterCanvasDimensions,
} from '../utils/shufuriPoster/shufuriPosterShared';
import { rasterizePageHtmlToBlob } from '../utils/pdfExport';
import { isNativeWebView, postSaveImageToLibrary } from '../utils/nativeBridge';
import type { SaveImageResult } from '../utils/nativeBridge';
import {
  getPosterTitleArtistClass,
  getPosterTitleNameClass,
  resolveDisplayArtist,
  resolveDisplayTitle,
} from '../utils/shufuriPoster/posterTitle';
import { ZH_FONT_FAMILY } from '../utils/shufuriPoster/fonts';
import { resolvePosterPipelineLang } from '../utils/shufuriPoster/inferPosterLang';
import { PAGE_GAP_PX } from '../hooks/usePosterPreviewFitScale';
import type { PosterLayoutProfile, PosterPageSlice, PosterRenderOptions } from '../utils/shufuriPoster/types';
import type { LyricsLanguage, LangCode } from '../services/appSettings';
import { getAppSettings } from '../services/appSettings';
import { useTimedMessage } from '../hooks/useTimedMessage';
import AppToast from './AppToast';

/** 页码字体常量 */
const PAGE_NUMBER_FONT_PX = 13;
const PAGE_NUMBER_TEXT_COLOR = '#94A3B8';
const PAGE_NUMBER_FONT_FAMILY = ZH_FONT_FAMILY;

/** 最小净化：防脚本注入 */
export function sanitizeShufuriPosterHtml(html: string): string {
  let s = html.replace(/\r\n/g, '\n');
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  return s;
}

function formatPosterPageNo(current: number, total: number): string {
  const a = String(current).padStart(2, '0');
  const b = String(total).padStart(2, '0');
  return `— ${a} / ${b} —`;
}

function pageImageFilename(title: string, pageIndex: number): string {
  return `${title.trim() || 'poster'}_${String(pageIndex + 1).padStart(2, '0')}`;
}

/** @deprecated 使用 sanitizeShufuriPosterHtml */
export const sanitizeFuriganaPosterHtml = sanitizeShufuriPosterHtml;

type ShufuriPosterSinglePageProps = {
  title: string;
  artist?: string;
  showTitle: boolean;
  bodyFragmentHtml: string;
  pageIndex: number;
  pageCount: number;
  layoutProfile: PosterLayoutProfile;
  displayScale: number;
  spacingScale?: number;
  language?: LyricsLanguage;
  lang?: LangCode;
  renderOptions?: PosterRenderOptions;
  captureRef?: Ref<HTMLDivElement>;
};

/** 单页假名海报（预览 1:1，导出与预览同一 DOM） */
function ShufuriPosterSinglePage({
  title,
  artist,
  showTitle,
  bodyFragmentHtml,
  pageIndex,
  pageCount,
  layoutProfile,
  displayScale,
  spacingScale = 1,
  language = 'jp',
  lang,
  renderOptions,
  captureRef,
}: ShufuriPosterSinglePageProps) {
  const showRuby = renderOptions?.showRuby ?? true;
  const safeFragment = useMemo(
    () => sanitizeShufuriPosterHtml(bodyFragmentHtml),
    [bodyFragmentHtml],
  );
  const pipelineLang = useMemo(
    () => resolvePosterPipelineLang(lang, safeFragment, language),
    [lang, safeFragment, language],
  );
  const { width: w, height: h } = getShufuriPosterCanvasDimensions(layoutProfile);
  const pad = getShufuriCanvasInsets(layoutProfile);
  const frameRef = useRef<HTMLDivElement>(null);
  const [renderScale, setRenderScale] = useState(displayScale);
  const innerCss = useMemo(
    () =>
      buildShufuriPosterInnerCss(layoutProfile, {
        spacingScale,
        language,
        lang: pipelineLang,
        colorTheme: getAppSettings().colorTheme,
        showRuby: renderOptions?.showRuby,
        userFontScale: renderOptions?.userFontScale,
        userLineHeightScale: renderOptions?.userLineHeightScale,
      }),
    [layoutProfile, spacingScale, language, pipelineLang, renderOptions],
  );
  const rootStyle = useMemo(
    () => buildShufuriPosterRootStyle(layoutProfile),
    [layoutProfile],
  );

  const targetW = w * displayScale;

  const bodyRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }
    const update = () => {
      const actualW = frame.clientWidth;
      if (actualW > 0 && w > 0) {
        setRenderScale(actualW / w);
      } else {
        setRenderScale(displayScale);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [displayScale, w, layoutProfile]);

  useLayoutEffect(() => {
    const bodyEl = bodyRef.current;
    if (!bodyEl) {
      return;
    }

    let cancelled = false;

    const applyMaxHeight = () => {
      if (cancelled) {
        return;
      }
      const titleEl = bodyEl.parentElement?.querySelector('h1.fv-title-h');
      applyPosterBodyMaxHeight(bodyEl, layoutProfile, {
        showTitle,
        titleEl: titleEl instanceof HTMLElement ? titleEl : null,
      });
    };

    applyMaxHeight();
    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (!cancelled) {
          applyMaxHeight();
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [safeFragment, layoutProfile, spacingScale, showTitle, title, artist, pageIndex, pageCount]);

  /* ---- 长按保存单张图片 ---- */
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const rasterizingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const { message: saveToast, show: showToast } = useTimedMessage(2400);

  const LONG_PRESS_MS = 600;
  const LONG_PRESS_MOVE_TOL = 12;

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleRasterize = useCallback(async () => {
    if (rasterizingRef.current || saving) {
      return;
    }
    rasterizingRef.current = true;
    setSaving(true);
    try {
      // 等待布局稳定 + 字体加载
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const native = isNativeWebView();

      // 使用现有成熟管线：离屏挂载 → html2canvas 栅格化 → PNG/JPEG Blob
      const { blob, mimeType } = await rasterizePageHtmlToBlob(
        bodyFragmentHtml,
        title,
        artist,
        showTitle,
        pageIndex,
        pageCount,
        layoutProfile,
        spacingScale,
        {
          format: native ? 'jpeg' : 'png',
          jpegQuality: 0.92,
        },
        language,
        lang,
        renderOptions,
      );

      if (native) {
        // iOS 原生：直写系统图库
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const comma = result.indexOf(',');
            resolve(comma >= 0 ? result.slice(comma + 1) : result);
          };
          reader.onerror = () => reject(reader.error ?? new Error('无法读取图片'));
          reader.readAsDataURL(blob);
        });

        const result: SaveImageResult = await postSaveImageToLibrary({
          dataBase64: base64,
          mimeType: mimeType as 'image/jpeg' | 'image/png',
          filename: pageImageFilename(title, pageIndex),
        });

        if (result.success) {
          showToast('已保存到系统图库');
          return;
        }

        // 保存失败 → 根据不同错误码给提示
        switch (result.code) {
          case 'PERMISSION_DENIED':
            showToast('请在设置中允许 SHUFURI 访问照片库', 4000);
            break;
          case 'PERMISSION_RESTRICTED':
            showToast('照片库访问受限（家长控制或企业策略）', 4000);
            break;
          default:
            showToast(`保存失败：${result.message}`, 3000);
        }
        return;
      }

      // 浏览器环境：触发下载
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
      a.download = `${pageImageFilename(title, pageIndex)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('图片已保存');
    } catch (e) {
      console.error('[save-page]', e);
      showToast(e instanceof Error ? e.message : '生成图片失败，请稍后重试', 3500);
    } finally {
      rasterizingRef.current = false;
      setSaving(false);
    }
  }, [
    saving,
    showToast,
    bodyFragmentHtml,
    title,
    artist,
    showTitle,
    pageIndex,
    pageCount,
    layoutProfile,
    spacingScale,
    renderOptions,
  ]);

  const onTouchStartPage = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        clearLongPress();
        longPressTimerRef.current = setTimeout(() => {
          void handleRasterize();
        }, LONG_PRESS_MS);
      }
    },
    [clearLongPress, handleRasterize],
  );

  const onTouchMovePage = useCallback(
    (e: React.TouchEvent) => {
      if (!longPressTimerRef.current || !touchStartPosRef.current) return;
      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - touchStartPosRef.current.x;
        const dy = e.touches[0].clientY - touchStartPosRef.current.y;
        if (Math.abs(dx) > LONG_PRESS_MOVE_TOL || Math.abs(dy) > LONG_PRESS_MOVE_TOL) {
          clearLongPress();
        }
      }
    },
    [clearLongPress],
  );

  const onTouchEndPage = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const onContextMenuPage = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      void handleRasterize();
    },
    [handleRasterize],
  );
  /* ---- 长按保存 end ---- */

  const scaledFrameStyle: CSSProperties = {
    width: targetW,
    maxWidth: '100%',
    aspectRatio: `${w} / ${h}`,
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
  };

  const scaleWrapperStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: w,
    height: h,
    transform: renderScale === 1 ? undefined : `scale(${renderScale})`,
    transformOrigin: 'top left',
  };

  return (
    <div
      ref={frameRef}
      className={`fv-poster-preview-frame${saving ? ' fv-poster-preview-frame--saving' : ''}`}
      style={scaledFrameStyle}
      onTouchStart={onTouchStartPage}
      onTouchMove={onTouchMovePage}
      onTouchEnd={onTouchEndPage}
      onTouchCancel={onTouchEndPage}
      onContextMenu={onContextMenuPage}
    >
      {saving && (
        <div className="fv-poster-saving-overlay">
          <div className="fv-poster-saving-spinner" />
          <span>正在生成图片…</span>
        </div>
      )}
      {saveToast && <AppToast message={saveToast} placement="anchored" />}
      <div style={scaleWrapperStyle}>
        <div
          ref={captureRef}
          className="fv-html-poster-root"
          data-ruby-visible={showRuby ? 'true' : 'false'}
          style={rootStyle as CSSProperties}
        >
          <style>{innerCss}</style>
          {showTitle ? (
            <h1 className="fv-title-h">
              <span className={getPosterTitleNameClass(title)}>{resolveDisplayTitle(title)}</span>
              <span className={getPosterTitleArtistClass(artist)}>{resolveDisplayArtist(artist)}</span>
            </h1>
          ) : null}
          <div
            ref={bodyRef}
            className="fv-body-h"
            dangerouslySetInnerHTML={{ __html: safeFragment }}
          />
          <div
            className="fv-poster-page-no"
            style={{
              right: pad.right,
              bottom:
                layoutProfile === 'mobilePoster'
                  ? Math.round(pad.bottom * 0.42)
                  : layoutProfile === 'squarePoster'
                    ? Math.round(pad.bottom * 0.38)
                    : Math.round(pad.bottom * 0.28),
              fontSize: PAGE_NUMBER_FONT_PX,
              color: PAGE_NUMBER_TEXT_COLOR,
              fontFamily: PAGE_NUMBER_FONT_FAMILY,
              fontWeight: 400,
              letterSpacing: '0.04em',
              zIndex: 2,
            }}
            aria-hidden
          >
            {formatPosterPageNo(pageIndex + 1, pageCount)}
          </div>
        </div>
      </div>
    </div>
  );
}

export type ShufuriPosterPreviewProps = {
  title: string;
  artist?: string;
  pageSlices: PosterPageSlice[];
  layoutProfile?: PosterLayoutProfile;
  displayScale?: number;
  pageGapPx?: number;
  language?: LyricsLanguage;
  lang?: LangCode;
  renderOptions?: PosterRenderOptions;
  captureRef?: (pageIndex: number) => (el: HTMLDivElement | null) => void;
};

/** 日语歌词海报：多页预览（视觉缩放，导出仍用 1:1 DOM） */
export default function ShufuriPosterPreview({
  title,
  artist,
  pageSlices,
  layoutProfile = 'clipPosterPrint',
  displayScale = 1,
  pageGapPx = PAGE_GAP_PX,
  language,
  lang,
  renderOptions,
  captureRef,
}: ShufuriPosterPreviewProps) {
  const pages = pageSlices.length > 0 ? pageSlices : [{ html: '', spacingScale: 1 }];
  const n = pages.length;

  return (
    <div className="fv-poster-preview-list" style={{ gap: pageGapPx * displayScale }}>
      {pages.map((slice, i) => (
        <ShufuriPosterSinglePage
          key={`fv-page-${i}`}
          title={title}
          artist={artist}
          showTitle={i === 0}
          bodyFragmentHtml={slice.html}
          spacingScale={slice.spacingScale}
          pageIndex={i}
          pageCount={n}
          layoutProfile={layoutProfile}
          displayScale={displayScale}
          language={language}
          lang={lang}
          renderOptions={renderOptions}
          captureRef={captureRef?.(i)}
        />
      ))}
    </div>
  );
}
