import { useMemo, useRef, useLayoutEffect, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Ref, CSSProperties } from 'react';
import {
  applyPosterBodyMaxHeight,
  buildFuriganaPosterInnerCss,
  buildFuriganaPosterRootStyle,
  getFuriganaCanvasInsets,
  getFuriganaPosterCanvasDimensions,
} from '../utils/furiganaLayout/furiganaPosterShared';
import { rasterizePageHtmlToBlob } from '../utils/pdfExport';
import { isNativeWebView, postSaveImageToLibrary, postShareImage } from '../utils/nativeBridge';
import type { SaveImageResult } from '../utils/nativeBridge';
import {
  getPosterTitleArtistClass,
  getPosterTitleNameClass,
  resolveDisplayArtist,
  resolveDisplayTitle,
} from '../utils/furiganaLayout/posterTitle';
import { ZH_FONT_FAMILY } from '../utils/furiganaLayout/fonts';
import { PAGE_GAP_PX } from '../hooks/usePosterPreviewFitScale';
import type { PosterLayoutProfile, PosterPageSlice } from '../utils/furiganaLayout/types';

/** 页码字体常量 */
const PAGE_NUMBER_FONT_PX = 13;
const PAGE_NUMBER_TEXT_COLOR = '#94A3B8';
const PAGE_NUMBER_FONT_FAMILY = ZH_FONT_FAMILY;

/** 最小净化：防脚本注入 */
export function sanitizeFuriganaPosterHtml(html: string): string {
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

async function blobToBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('无法读取图片'));
    reader.readAsDataURL(blob);
  });
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function pageImageFilename(title: string, pageIndex: number): string {
  return `${title.trim() || 'poster'}_${String(pageIndex + 1).padStart(2, '0')}`;
}

type FuriganaPosterSinglePageProps = {
  title: string;
  artist?: string;
  showTitle: boolean;
  bodyFragmentHtml: string;
  pageIndex: number;
  pageCount: number;
  layoutProfile: PosterLayoutProfile;
  displayScale: number;
  spacingScale?: number;
  captureRef?: Ref<HTMLDivElement>;
};

/** 单页假名海报（预览 1:1，导出与预览同一 DOM） */
function FuriganaPosterSinglePage({
  title,
  artist,
  showTitle,
  bodyFragmentHtml,
  pageIndex,
  pageCount,
  layoutProfile,
  displayScale,
  spacingScale = 1,
  captureRef,
}: FuriganaPosterSinglePageProps) {
  const safeFragment = useMemo(
    () => sanitizeFuriganaPosterHtml(bodyFragmentHtml),
    [bodyFragmentHtml],
  );
  const { width: w, height: h } = getFuriganaPosterCanvasDimensions(layoutProfile);
  const pad = getFuriganaCanvasInsets(layoutProfile);
  const innerCss = useMemo(
    () => buildFuriganaPosterInnerCss(layoutProfile, { spacingScale }),
    [layoutProfile, spacingScale],
  );
  const rootStyle = useMemo(
    () => buildFuriganaPosterRootStyle(layoutProfile),
    [layoutProfile],
  );

  const scaledW = w * displayScale;
  const scaledH = h * displayScale;

  const bodyRef = useRef<HTMLDivElement>(null);

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
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const saveToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [modalBlobUrl, setModalBlobUrl] = useState<string | null>(null);
  const [modalDownloadExt, setModalDownloadExt] = useState('jpg');

  const LONG_PRESS_MS = 600;
  const LONG_PRESS_MOVE_TOL = 12;

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const closeModal = useCallback(() => {
    setModalBlobUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (modalBlobUrl) {
        URL.revokeObjectURL(modalBlobUrl);
      }
    };
  }, [modalBlobUrl]);

  const showToast = useCallback((message: string, durationMs = 2400) => {
    if (saveToastTimerRef.current) {
      clearTimeout(saveToastTimerRef.current);
    }
    setSaveToast(message);
    saveToastTimerRef.current = setTimeout(() => {
      setSaveToast(null);
    }, durationMs);
  }, []);

  useEffect(() => {
    return () => {
      if (saveToastTimerRef.current) {
        clearTimeout(saveToastTimerRef.current);
      }
    };
  }, []);

  const handleRasterize = useCallback(async () => {
    if (rasterizingRef.current || saving || modalBlobUrl) {
      return;
    }
    rasterizingRef.current = true;
    setSaving(true);
    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      const native = isNativeWebView();
      const { blob, mimeType } = await rasterizePageHtmlToBlob(
        bodyFragmentHtml,
        title,
        artist,
        showTitle,
        pageIndex,
        pageCount,
        layoutProfile,
        spacingScale,
        native
          ? { format: 'jpeg', jpegQuality: 0.82, maxScale: 1, prepareVisible: false }
          : undefined,
      );
      const filename = pageImageFilename(title, pageIndex);

      if (native) {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });

        const result: SaveImageResult = await postSaveImageToLibrary({
          dataBase64: await blobToBase64(blob),
          mimeType,
          filename,
        });

        if (result.success) {
          showToast('已保存到系统图库');
          return;
        }

        // 权限被拒绝 / 保存失败：回退到系统分享菜单
        switch (result.code) {
          case 'PERMISSION_DENIED': {
            const goSettings = window.confirm(
              '需要照片库访问权限才能保存图片到相册。\n\n点击「确定」前往「设置」中开启权限。',
            );
            if (goSettings) {
              // iOS 无直接跳转设置页的能力，提示用户手动操作
              alert('请前往「设置」→「隐私与安全性」→「照片」→ 找到 SHUFURI 并开启权限。');
            }
            // 权限被拒绝后，回退到分享菜单
            await postShareImage({
              dataBase64: await blobToBase64(blob),
              mimeType,
              filename,
            });
            break;
          }
          case 'PERMISSION_RESTRICTED':
            showToast('照片库访问受限（家长控制或企业策略）', 4000);
            break;
          case 'DECODE_FAILED':
          case 'SAVE_FAILED':
          case 'UNKNOWN':
          default:
            showToast(`保存失败：${result.message}`, 3000);
            // 回退到分享菜单
            await postShareImage({
              dataBase64: await blobToBase64(blob),
              mimeType,
              filename,
            });
            break;
        }
        return;
      }

      // 浏览器环境：弹出模态窗显示图片
      const ext = mimeType === 'image/png' ? 'png' : 'jpg';
      setModalDownloadExt(ext);
      setModalBlobUrl(URL.createObjectURL(blob));
    } catch (e) {
      console.error('[save-page]', e);
      showToast(e instanceof Error ? e.message : '生成图片失败，请稍后重试', 3500);
    } finally {
      rasterizingRef.current = false;
      setSaving(false);
    }
  }, [
    saving,
    modalBlobUrl,
    showToast,
    bodyFragmentHtml,
    title,
    artist,
    showTitle,
    pageIndex,
    pageCount,
    layoutProfile,
    spacingScale,
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
    width: scaledW,
    height: scaledH,
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
    transform: displayScale === 1 ? undefined : `scale(${displayScale})`,
    transformOrigin: 'top left',
  };

  return (
    <div
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
      {saveToast && (
        <div className="fv-poster-save-toast">
          {saveToast}
        </div>
      )}
      <div style={scaleWrapperStyle}>
        <div
          ref={captureRef}
          className="fv-html-poster-root"
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
      {/* 浏览器：图片模态弹窗 — 长按 img 保存；App 内长按直接写入相册 */}
      {modalBlobUrl &&
        createPortal(
          <div className="fv-poster-image-modal" onClick={closeModal}>
            <div
              className="fv-poster-image-modal-box"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="fv-poster-image-modal-close"
                onClick={closeModal}
                aria-label="关闭"
              >
                ✕
              </button>
              <img
                className="fv-poster-image-modal-img"
                src={modalBlobUrl}
                alt={`第 ${pageIndex + 1} 页海报`}
              />
              <div className="fv-poster-image-modal-hint">
                长按图片即可保存到相册
              </div>
              <button
                className="fv-poster-image-modal-download"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = modalBlobUrl;
                  a.download = `${pageImageFilename(title, pageIndex)}.${modalDownloadExt}`;
                  a.click();
                }}
              >
                下载图片
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export type FuriganaHtmlPosterPreviewProps = {
  title: string;
  artist?: string;
  pageSlices: PosterPageSlice[];
  layoutProfile?: PosterLayoutProfile;
  displayScale?: number;
  pageGapPx?: number;
  captureRef?: (pageIndex: number) => (el: HTMLDivElement | null) => void;
};

/** 日语歌词海报：多页预览（视觉缩放，导出仍用 1:1 DOM） */
export default function FuriganaHtmlPosterPreview({
  title,
  artist,
  pageSlices,
  layoutProfile = 'clipPosterPrint',
  displayScale = 1,
  pageGapPx = PAGE_GAP_PX,
  captureRef,
}: FuriganaHtmlPosterPreviewProps) {
  const pages = pageSlices.length > 0 ? pageSlices : [{ html: '', spacingScale: 1 }];
  const n = pages.length;

  return (
    <div className="fv-poster-preview-list" style={{ gap: pageGapPx * displayScale }}>
      {pages.map((slice, i) => (
        <FuriganaPosterSinglePage
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
          captureRef={captureRef?.(i)}
        />
      ))}
    </div>
  );
}
