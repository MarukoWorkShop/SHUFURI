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
  stampTitleMarkupSerifHtml,
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
  /**
   * 额外内容倍率（全屏分栏字号）。叠乘到 canvas transform；
   * ≠1 时改为 top-center 原点，避免 zoom/左原点造成视觉右偏。
   */
  contentScale?: number;
  titleMarkupHtml?: string;
  /** 大模型声明或解析得到的管线语言 */
  lang?: LangCode;
  /** 波轮歌词语言（auto 时仅作兜底） */
  language?: LyricsLanguage;
  colorTheme?: ColorTheme;
  showRuby?: boolean;
  /**
   * 首次布局量高（scaledH）+ 字体就绪后回调一次，供父级做「就绪后再一次性展示」，
   * 避免进入编辑页时先闪「小稿 / 字体挤作一团」的半成品画布。
   */
  onLayoutReady?: () => void;
};

/** 高度亚像素抖动忽略阈值，避免 frame 高度微变触发 scroll 死循环 */
const SCALED_H_EPSILON_PX = 2;

export default function ShufuriPosterEditCanvas({
  title,
  artist,
  bodyHtml,
  layoutProfile,
  displayScale,
  contentScale = 1,
  titleMarkupHtml,
  lang,
  language = 'jp',
  colorTheme,
  showRuby = true,
  onLayoutReady,
}: Props) {
  const safeBody = useMemo(() => sanitizeShufuriPosterHtml(bodyHtml), [bodyHtml]);
  /**
   * P4：对 body innerHTML 做内容相等性短路。
   * React 的 dangerouslySetInnerHTML 在 __html 引用变化时即重建 DOM，
   * 即使字符串内容相同也会抹掉运行时贴上去的聚光灯 class。
   * 这里用 state 托管实际渲染的 HTML，仅当字符串内容真正变化时才更新，
   * 避免父级因其他 state 重渲染导致 body DOM 被无谓重建。
   */
  const [renderedBody, setRenderedBody] = useState(safeBody);
  useLayoutEffect(() => {
    setRenderedBody((prev) => (prev === safeBody ? prev : safeBody));
  }, [safeBody]);
  const pipelineLang = useMemo(
    () => resolvePosterPipelineLang(lang, safeBody, language),
    [lang, safeBody, language],
  );
  const safeTitleMarkup = useMemo(() => {
    if (!titleMarkupHtml) return undefined;
    return stampTitleMarkupSerifHtml(
      sanitizeShufuriPosterHtml(titleMarkupHtml),
      pipelineLang ?? 'jp',
    );
  }, [titleMarkupHtml, pipelineLang]);
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
  const contentScaleSafe = Number.isFinite(contentScale) && contentScale > 0 ? contentScale : 1;
  const presentScaled = Math.abs(contentScaleSafe - 1) > 0.001;
  const frameRef = useRef<HTMLDivElement>(null);
  const scaleWrapperRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  /** 内容/缩放刚变更时允许一次高度回落；其后只升不降，切断 scrollHeight 反馈环 */
  const allowHeightShrinkRef = useRef(true);
  /** 首次量高 + 字体就绪后放行（只放行一次），父级据此移除 boot 遮罩 */
  const onLayoutReadyRef = useRef(onLayoutReady);
  useLayoutEffect(() => {
    onLayoutReadyRef.current = onLayoutReady;
  }, [onLayoutReady]);
  const didNotifyLayoutReadyRef = useRef(false);
  const [renderScale, setRenderScale] = useState(displayScale);
  const [scaledH, setScaledH] = useState<number | undefined>();
  const effectiveScale = renderScale * contentScaleSafe;

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
    /* 全屏放大时 frame 仍按适应宽度，多出的倍率由 center 缩放对称裁切，避免右偏 */
    frame.style.setProperty('--fv-edit-frame-w', `${targetW}px`);
    if (scaledH != null) {
      frame.style.setProperty('--fv-edit-frame-h', `${scaledH}px`);
      frame.style.setProperty('--fv-edit-frame-min-h', `${scaledH}px`);
    } else {
      frame.style.removeProperty('--fv-edit-frame-h');
      frame.style.setProperty('--fv-edit-frame-min-h', `${h * effectiveScale}px`);
    }
  }, [targetW, scaledH, h, effectiveScale]);

  useLayoutEffect(() => {
    const wrapper = scaleWrapperRef.current;
    if (!wrapper) return;
    wrapper.style.setProperty('--fv-edit-canvas-w', `${w}px`);
    wrapper.style.setProperty('--fv-edit-render-scale', String(effectiveScale));
    if (presentScaled) {
      wrapper.style.transformOrigin = 'top center';
      wrapper.style.left = '50%';
      wrapper.style.marginLeft = `${-w / 2}px`;
    } else {
      wrapper.style.transformOrigin = 'top left';
      wrapper.style.left = '0';
      wrapper.style.marginLeft = '0';
    }
  }, [w, effectiveScale, presentScaled]);

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

    /**
     * 首次量高完成 + 字体就绪后放行。之所以挂 rAF：setScaledH 是异步 state，
     * 双 rAF 能确保 scaledH 提交、frame 高度与 transform 几何稳定后再回调父级，
     * 父级此时才把 boot 遮罩淡出——首帧所见即终态，不再先闪「小稿/挤作一团」。
     */
    const notifyLayoutReady = () => {
      if (didNotifyLayoutReadyRef.current) return;
      didNotifyLayoutReadyRef.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          onLayoutReadyRef.current?.();
        });
      });
    };

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const natural = Math.max(el.scrollHeight, el.offsetHeight);
        const next = Math.ceil(natural * effectiveScale + 8);
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
        if (!didNotifyLayoutReadyRef.current) {
          const fonts = document.fonts;
          if (!fonts || fonts.status === 'loaded') {
            notifyLayoutReady();
          } else if (fonts.ready) {
            // 字体仍在加载：等 fonts.ready（此时本 effect 里另一个 ready.then(update)
            // 会用终态字体再量一次高），随后双 rAF 放行，所见即终态。
            void fonts.ready.then(notifyLayoutReady).catch(notifyLayoutReady);
          } else {
            notifyLayoutReady();
          }
        }
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
  }, [effectiveScale, contentKey]);

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
              <span className={getPosterTitleNameClass(title, pipelineLang ?? 'jp')}>{resolveDisplayTitle(title)}</span>
              <span className={getPosterTitleArtistClass(artist, pipelineLang ?? 'jp')}>{resolveDisplayArtist(artist)}</span>
            </h1>
          )}
          <div
            className="fv-body-h"
            dangerouslySetInnerHTML={{ __html: renderedBody }}
          />
        </div>
      </div>
    </div>
  );
}
