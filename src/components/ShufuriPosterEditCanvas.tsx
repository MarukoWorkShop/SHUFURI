import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  buildShufuriEditDocumentCssOverrides,
  buildShufuriEditDocumentRootStyle,
  buildShufuriPosterInnerCss,
  getShufuriPosterCanvasDimensions,
} from '../utils/shufuriPoster/shufuriPosterShared';
import {
  getPosterTitleArtistClass,
  getPosterTitleNameClass,
  resolveDisplayArtist,
  resolveDisplayTitle,
} from '../utils/shufuriPoster/posterTitle';
import type { PosterLayoutProfile } from '../utils/shufuriPoster/types';
import type { ColorTheme, LangCode, LyricsLanguage } from '../services/appSettings';
import { sanitizeShufuriPosterHtml } from './ShufuriPosterPreview';
import { resolvePosterPipelineLang } from '../utils/shufuriPoster/inferPosterLang';

type Props = {
  title: string;
  artist?: string;
  bodyHtml: string;
  layoutProfile: PosterLayoutProfile;
  displayScale: number;
  titleMarkupHtml?: string;
  /** 大模型声明或解析得到的管线语言 */
  lang?: LangCode;
  /** 波轮歌词语言（auto 时仅作兜底） */
  language?: LyricsLanguage;
  colorTheme?: ColorTheme;
  showRuby?: boolean;
};

export default function ShufuriPosterEditCanvas({
  title,
  artist,
  bodyHtml,
  layoutProfile,
  displayScale,
  titleMarkupHtml,
  lang,
  language = 'jp',
  colorTheme,
  showRuby = true,
}: Props) {
  const safeBody = useMemo(() => sanitizeShufuriPosterHtml(bodyHtml), [bodyHtml]);
  const safeTitleMarkup = useMemo(
    () => (titleMarkupHtml ? sanitizeShufuriPosterHtml(titleMarkupHtml) : undefined),
    [titleMarkupHtml],
  );
  const pipelineLang = useMemo(
    () => resolvePosterPipelineLang(lang, safeBody, language),
    [lang, safeBody, language],
  );
  const innerCss = useMemo(
    () =>
      `${buildShufuriPosterInnerCss(layoutProfile, {
        language,
        lang: pipelineLang,
        colorTheme,
        showRuby,
      })}${buildShufuriEditDocumentCssOverrides()}`,
    [layoutProfile, language, pipelineLang, colorTheme, showRuby],
  );
  const rootStyle = useMemo(
    () => buildShufuriEditDocumentRootStyle(layoutProfile),
    [layoutProfile],
  );

  const { width: w } = getShufuriPosterCanvasDimensions(layoutProfile);
  const targetW = w * displayScale;
  const frameRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [renderScale, setRenderScale] = useState(displayScale);
  const [scaledH, setScaledH] = useState<number | undefined>();

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }
    const updateFrame = () => {
      const actualW = frame.clientWidth;
      if (actualW > 0 && w > 0) {
        setRenderScale(actualW / w);
      } else {
        setRenderScale(displayScale);
      }
    };
    updateFrame();
    const ro = new ResizeObserver(updateFrame);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [displayScale, w, layoutProfile]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) {
      return;
    }
    const update = () => {
      const natural = Math.max(el.scrollHeight, el.offsetHeight);
      setScaledH(natural * renderScale);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (document.fonts?.ready) {
      void document.fonts.ready.then(update);
    }
    return () => ro.disconnect();
  }, [renderScale, safeBody, title, artist, layoutProfile, safeTitleMarkup]);

  const scaledFrameStyle: CSSProperties = {
    width: targetW,
    maxWidth: '100%',
    minHeight: scaledH,
    position: 'relative',
    overflow: 'visible',
    flexShrink: 0,
  };

  const scaleWrapperStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: w,
    transform: renderScale === 1 ? undefined : `scale(${renderScale})`,
    transformOrigin: 'top left',
  };

  return (
    <div ref={frameRef} className="fv-poster-preview-frame fv-edit-canvas-frame" style={scaledFrameStyle}>
      <div style={scaleWrapperStyle}>
        <div
          ref={rootRef}
          className="fv-html-poster-root fv-edit-document-root"
          data-ruby-visible={showRuby ? 'true' : 'false'}
          style={rootStyle as CSSProperties}
        >
          <style>{innerCss}</style>
          {safeTitleMarkup ? (
            <h1
              className="fv-title-h"
              data-ink-title
              dangerouslySetInnerHTML={{ __html: safeTitleMarkup }}
            />
          ) : (
            <h1 className="fv-title-h" data-ink-title>
              <span className={getPosterTitleNameClass(title)}>{resolveDisplayTitle(title)}</span>
              <span className={getPosterTitleArtistClass(artist)}>{resolveDisplayArtist(artist)}</span>
            </h1>
          )}
          <div
            className="fv-body-h"
            dangerouslySetInnerHTML={{ __html: safeBody }}
          />
        </div>
      </div>
    </div>
  );
}
