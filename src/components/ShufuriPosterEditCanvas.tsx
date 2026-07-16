import { useLayoutEffect, useMemo, useRef, useState } from 'react';
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

/** 高度亚像素抖动忽略阈值，避免 frame 高度微变触发 scroll 死循环 */
const SCALED_H_EPSILON_PX = 2;

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

  const { width: w, height: h } = getShufuriPosterCanvasDimensions(layoutProfile);
  const targetW = w * displayScale;
  const frameRef = useRef<HTMLDivElement>(null);
  const scaleWrapperRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  /** 内容/缩放刚变更时允许一次高度回落；其后只升不降，切断 scrollHeight 反馈环 */
  const allowHeightShrinkRef = useRef(true);
  const [renderScale, setRenderScale] = useState(displayScale);
  const [scaledH, setScaledH] = useState<number | undefined>();

  const contentKey = `${safeBody}\0${title}\0${artist ?? ''}\0${safeTitleMarkup ?? ''}\0${showRuby}\0${layoutProfile}`;

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }
    // 量父级可用宽，避免自身 height 变化 → 滚动条出现/消失 → clientWidth 振荡卡死
    const measureEl =
      frame.closest('.edit-canvas-scroll') ?? frame.parentElement ?? frame;
    const updateFrame = () => {
      const availableW = measureEl.clientWidth;
      if (availableW > 0 && w > 0) {
        const next = Math.min(availableW, targetW) / w;
        setRenderScale((prev) => (Math.abs(prev - next) < 0.0005 ? prev : next));
      } else {
        setRenderScale((prev) => (Math.abs(prev - displayScale) < 0.0005 ? prev : displayScale));
      }
    };
    updateFrame();
    const ro = new ResizeObserver(updateFrame);
    ro.observe(measureEl);
    return () => {
      ro.disconnect();
    };
  }, [displayScale, w, layoutProfile, targetW]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    frame.style.setProperty('--fv-edit-frame-w', `${targetW}px`);
    if (scaledH != null) {
      frame.style.setProperty('--fv-edit-frame-h', `${scaledH}px`);
      frame.style.setProperty('--fv-edit-frame-min-h', `${scaledH}px`);
    } else {
      frame.style.removeProperty('--fv-edit-frame-h');
      frame.style.setProperty('--fv-edit-frame-min-h', `${h * renderScale}px`);
    }
  }, [targetW, scaledH, h, renderScale]);

  useLayoutEffect(() => {
    const wrapper = scaleWrapperRef.current;
    if (!wrapper) return;
    wrapper.style.setProperty('--fv-edit-canvas-w', `${w}px`);
    wrapper.style.setProperty('--fv-edit-render-scale', String(renderScale));
  }, [w, renderScale]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    Object.assign(el.style, rootStyle);
  }, [rootStyle]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) {
      return;
    }
    allowHeightShrinkRef.current = true;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const natural = Math.max(el.scrollHeight, el.offsetHeight);
        const next = Math.ceil(natural * renderScale + 8);
        setScaledH((prev) => {
          if (prev == null) {
            allowHeightShrinkRef.current = false;
            return next;
          }
          if (Math.abs(prev - next) < SCALED_H_EPSILON_PX) return prev;
          if (!allowHeightShrinkRef.current && next < prev) return prev;
          allowHeightShrinkRef.current = false;
          return next;
        });
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (document.fonts?.ready) {
      void document.fonts.ready.then(update);
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [renderScale, contentKey]);

  return (
    <div ref={frameRef} className="fv-poster-preview-frame fv-edit-canvas-frame">
      <div ref={scaleWrapperRef} className="fv-edit-canvas-scale">
        <div
          ref={rootRef}
          className="fv-html-poster-root fv-edit-document-root"
          data-ruby-visible={showRuby ? 'true' : 'false'}
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
