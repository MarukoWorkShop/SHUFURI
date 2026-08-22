import { DEFAULT_POSTER_LAYOUT_VARIANT } from './types';

/**
 * 轻量桥接：让父层 usePosterWorkspace 的 getPosterRenderOpts（用于
 * enterExportFlow / handleLayoutChange / handleSave 重新分页）能拿到当前版式与背景，
 * 而无需把这两个状态一路 props 透传到 workspace provider。
 *
 * usePosterTypography 在 layoutVariant / backgroundId 变化时写入此处；
 * getPosterRenderOpts 读取此处的最新值，避免分栏等新版式在切换页面/重排版时
 * 因闭包默认值（standard）被回退为单栏 HTML。
 */
interface RenderOptsBridge {
  layoutVariant: import('./types').PosterLayoutVariant;
  backgroundId: string;
}

const bridge: RenderOptsBridge = {
  layoutVariant: DEFAULT_POSTER_LAYOUT_VARIANT,
  backgroundId: '',
};

export function setRenderOptsBridge(layoutVariant: import('./types').PosterLayoutVariant, backgroundId: string): void {
  bridge.layoutVariant = layoutVariant;
  bridge.backgroundId = backgroundId;
}

export function getRenderOptsBridge(): RenderOptsBridge {
  return bridge;
}
