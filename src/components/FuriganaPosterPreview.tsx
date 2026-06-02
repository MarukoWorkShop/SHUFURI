import { useMemo, useRef, useLayoutEffect, useState } from 'react';
import type { Ref, CSSProperties } from 'react';
import {
  buildFuriganaPosterInnerCss,
  buildFuriganaPosterRootStyle,
  getFuriganaCanvasInsets,
  getFuriganaPosterCanvasDimensions,
  detectFuriganaPosterBodyOverflow,
} from '../utils/furiganaLayout/furiganaPosterShared';
import { PAGE_GAP_PX } from '../hooks/usePosterPreviewFitScale';
import type { PosterLayoutProfile } from '../utils/furiganaLayout/types';

/** 页码字体常量 */
const PAGE_NUMBER_FONT_PX = 13;
const PAGE_NUMBER_TEXT_COLOR = '#94A3B8';
const PAGE_NUMBER_FONT_FAMILY =
  '"PingFang SC", "PingFang TC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';

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

type FuriganaPosterSinglePageProps = {
  title: string;
  showTitle: boolean;
  bodyFragmentHtml: string;
  pageIndex: number;
  pageCount: number;
  layoutProfile: PosterLayoutProfile;
  displayScale: number;
  captureRef?: Ref<HTMLDivElement>;
};

/** 单页假名海报（预览 1:1，导出与预览同一 DOM） */
function FuriganaPosterSinglePage({
  title,
  showTitle,
  bodyFragmentHtml,
  pageIndex,
  pageCount,
  layoutProfile,
  displayScale,
  captureRef,
}: FuriganaPosterSinglePageProps) {
  const safeFragment = useMemo(
    () => sanitizeFuriganaPosterHtml(bodyFragmentHtml),
    [bodyFragmentHtml],
  );
  const { width: w, height: h } = getFuriganaPosterCanvasDimensions(layoutProfile);
  const pad = getFuriganaCanvasInsets(layoutProfile);
  const innerCss = useMemo(
    () => buildFuriganaPosterInnerCss(layoutProfile),
    [layoutProfile],
  );
  const rootStyle = useMemo(
    () => buildFuriganaPosterRootStyle(layoutProfile),
    [layoutProfile],
  );

  const scaledW = w * displayScale;
  const scaledH = h * displayScale;

  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyOverflow, setBodyOverflow] = useState(false);

  useLayoutEffect(() => {
    const bodyEl = bodyRef.current;
    if (!bodyEl) {
      setBodyOverflow(false);
      return;
    }
    const overflow = detectFuriganaPosterBodyOverflow(bodyEl);
    setBodyOverflow(overflow);
    if (overflow && import.meta.env.DEV) {
      console.warn(
        `[FuriganaPosterPreview] page ${pageIndex + 1}/${pageCount} body overflow:`,
        `scrollHeight=${bodyEl.scrollHeight}, clientHeight=${bodyEl.clientHeight}`,
      );
    }
  }, [safeFragment, layoutProfile, showTitle, title, pageIndex, pageCount]);

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
    <div className="fv-poster-preview-frame" style={scaledFrameStyle}>
      <div style={scaleWrapperStyle}>
        <div
          ref={captureRef}
          className="fv-html-poster-root"
          style={rootStyle as CSSProperties}
        >
          <style>{innerCss}</style>
          {showTitle ? (
            <h1 className="fv-title-h">{title.trim() || '歌词笔记'}</h1>
          ) : null}
          <div
            ref={bodyRef}
            className={`fv-body-h${bodyOverflow && import.meta.env.DEV ? ' fv-body-overflow-debug' : ''}`}
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
    </div>
  );
}

export type FuriganaHtmlPosterPreviewProps = {
  title: string;
  pageBodyHtmls: string[];
  layoutProfile?: PosterLayoutProfile;
  displayScale?: number;
  pageGapPx?: number;
  captureRef?: (pageIndex: number) => (el: HTMLDivElement | null) => void;
};

/** 日语歌词海报：多页预览（视觉缩放，导出仍用 1:1 DOM） */
export default function FuriganaHtmlPosterPreview({
  title,
  pageBodyHtmls,
  layoutProfile = 'clipPosterPrint',
  displayScale = 1,
  pageGapPx = PAGE_GAP_PX,
  captureRef,
}: FuriganaHtmlPosterPreviewProps) {
  const pages = pageBodyHtmls.length > 0 ? pageBodyHtmls : [''];
  const n = pages.length;

  return (
    <div className="fv-poster-preview-list" style={{ gap: pageGapPx * displayScale }}>
      {pages.map((fragment, i) => (
        <FuriganaPosterSinglePage
          key={`fv-page-${i}`}
          title={title}
          showTitle={i === 0}
          bodyFragmentHtml={fragment}
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
