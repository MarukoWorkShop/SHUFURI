import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  buildFuriganaEditDocumentCssOverrides,
  buildFuriganaEditDocumentRootStyle,
  buildFuriganaPosterInnerCss,
  getFuriganaPosterCanvasDimensions,
} from '../utils/furiganaLayout/furiganaPosterShared';
import {
  getPosterTitleArtistClass,
  getPosterTitleNameClass,
  resolveDisplayArtist,
  resolveDisplayTitle,
} from '../utils/furiganaLayout/posterTitle';
import type { PosterLayoutProfile } from '../utils/furiganaLayout/types';
import { sanitizeFuriganaPosterHtml } from './FuriganaPosterPreview';

type Props = {
  title: string;
  artist?: string;
  bodyHtml: string;
  layoutProfile: PosterLayoutProfile;
  displayScale: number;
};

export default function FuriganaEditCanvas({
  title,
  artist,
  bodyHtml,
  layoutProfile,
  displayScale,
}: Props) {
  const safeBody = useMemo(() => sanitizeFuriganaPosterHtml(bodyHtml), [bodyHtml]);
  const innerCss = useMemo(
    () =>
      `${buildFuriganaPosterInnerCss(layoutProfile)}${buildFuriganaEditDocumentCssOverrides()}`,
    [layoutProfile],
  );
  const rootStyle = useMemo(
    () => buildFuriganaEditDocumentRootStyle(layoutProfile),
    [layoutProfile],
  );

  const { width: w } = getFuriganaPosterCanvasDimensions(layoutProfile);
  const scaledW = w * displayScale;
  const rootRef = useRef<HTMLDivElement>(null);
  const [scaledH, setScaledH] = useState<number | undefined>();

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) {
      return;
    }
    const update = () => {
      // iOS WebKit：offsetHeight 可能受 overflow 影响偏小，用 scrollHeight 取完整文档高
      const natural = Math.max(el.scrollHeight, el.offsetHeight);
      setScaledH(natural * displayScale);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (document.fonts?.ready) {
      void document.fonts.ready.then(update);
    }
    return () => ro.disconnect();
  }, [displayScale, safeBody, title, artist, layoutProfile]);

  const scaledFrameStyle: CSSProperties = {
    width: scaledW,
    minHeight: scaledH,
    maxWidth: '100%',
    position: 'relative',
    overflow: 'visible',
    flexShrink: 0,
  };

  const scaleWrapperStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: w,
    transform: displayScale === 1 ? undefined : `scale(${displayScale})`,
    transformOrigin: 'top left',
  };

  return (
    <div className="fv-poster-preview-frame fv-edit-canvas-frame" style={scaledFrameStyle}>
      <div style={scaleWrapperStyle}>
        <div
          ref={rootRef}
          className="fv-html-poster-root fv-edit-document-root"
          style={rootStyle as CSSProperties}
        >
          <style>{innerCss}</style>
          <h1 className="fv-title-h" data-ink-title>
            <span className={getPosterTitleNameClass(title)}>{resolveDisplayTitle(title)}</span>
            <span className={getPosterTitleArtistClass(artist)}>{resolveDisplayArtist(artist)}</span>
          </h1>
          <div
            className="fv-body-h"
            dangerouslySetInnerHTML={{ __html: safeBody }}
          />
        </div>
      </div>
    </div>
  );
}
