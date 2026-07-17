import { isInteractionSoundEnabled } from '../services/appSettings';
import { hapticButton } from '../hooks/useHaptics';
import { playLogitechClickSoundEffect } from './logitechClickSound';

/** 统一按键反馈：震动 + 点按音（交互音效始终开启） */
export function triggerButtonPressFeedback(): void {
  if (!isInteractionSoundEnabled()) {
    return;
  }
  hapticButton();
}

/** Archive / Study Cards 等：轻震 + Logitech click.wav */
export function triggerLogitechPressFeedback(): void {
  if (!isInteractionSoundEnabled()) {
    return;
  }
  hapticButton();
  playLogitechClickSoundEffect();
}
