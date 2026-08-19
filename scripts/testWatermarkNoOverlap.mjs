/**
 * 验证 A+C 方案：分页测量的正文 max-height 已扣除水印高度，
 * 且 getFuriganaPageNumberReservePx 与公式扣除一致。
 * 运行: npx tsx scripts/testWatermarkNoOverlap.mjs
 */
import { Window } from 'happy-dom';
import {
  computePosterBodyMaxHeightPx,
  getFuriganaPageNumberReservePx,
  getFuriganaCanvasInsets,
  getFuriganaPosterCanvasDimensions,
  getFuriganaBodyBottomPaddingPx,
} from '../src/utils/shufuriPoster/shufuriPosterShared.ts';
import { WATERMARK_TEXT_CLEARANCE_PX, watermarkDesignScale } from '../src/utils/shufuriPoster/posterWatermark.ts';

const window = new Window({ url: 'http://localhost/' });
const { document, Node, Element, HTMLElement, Text } = window;
globalThis.window = window;
globalThis.document = document;
globalThis.Node = Node;
globalThis.Element = Element;
globalThis.HTMLElement = HTMLElement;
globalThis.Text = Text;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const profiles = ['clipPosterPrint', 'mobilePoster', 'squarePoster', 'socialPoster'];

for (const profile of profiles) {
  const { height: h } = getFuriganaPosterCanvasDimensions(profile);
  const insets = getFuriganaCanvasInsets(profile);
  const shellInnerH = h - insets.top - insets.bottom;
  const reserve = getFuriganaPageNumberReservePx(profile);
  const clearance = Math.round(WATERMARK_TEXT_CLEARANCE_PX * watermarkDesignScale(profile));

  // 无标题时正文的 max-height
  const maxH = computePosterBodyMaxHeightPx(profile, { showTitle: false, titleEl: null });

  // 正文底（距 shell 顶部）= insets.top + maxH（已扣除 clearance）
  // 水印文字顶（距 shell 顶部）= h - insets.bottom - WATERMARK_BAR_HEIGHT_PX * scale
  //   但我们用 clearance 作为"安全距离"，所以要求：正文底 <= shell 底部 - clearance
  const bodyBottom = insets.top + maxH;
  const safeTop = h - insets.bottom - clearance;

  console.log(`[${profile}] canvasH=${h} shellInnerH=${shellInnerH} maxH=${maxH} reserve=${reserve} clearance=${clearance} bodyBottom=${bodyBottom} safeTop=${safeTop}`);

  assert(maxH > 0, `${profile}: maxH > 0`);
  assert(
    bodyBottom <= safeTop,
    `${profile}: 正文底(${bodyBottom})应 <= 安全区顶(${safeTop})，否则末行可能压水印`,
  );
  // reserve 应至少覆盖 clearance + 正文底内边距
  assert(
    reserve >= clearance,
    `${profile}: 页码预留(${reserve})应 >= 安全距离(${clearance})`,
  );
}

console.log('testWatermarkNoOverlap: OK —— 所有 profile 正文区域均不进入水印区');
await window.happyDOM.close();
