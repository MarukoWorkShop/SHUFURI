import { playKataClickSound } from './kataClickSound';

/** @deprecated 使用 playKataClickSound；保留别名供抽屉等场景 */
export function playDrawerOpenSound(): void {
  playKataClickSound();
}

export function playDrawerCloseSound(): void {
  playKataClickSound();
}

export { playKataClickSound } from './kataClickSound';
