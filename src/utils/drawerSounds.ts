import { playLogitechClickSoundEffect } from './logitechClickSound';

/** @deprecated 使用 playLogitechClickSoundEffect；保留别名供抽屉等场景 */
export function playDrawerOpenSound(): void {
  playLogitechClickSoundEffect();
}

export function playDrawerCloseSound(): void {
  playLogitechClickSoundEffect();
}

export { playLogitechClickSoundEffect } from './logitechClickSound';
