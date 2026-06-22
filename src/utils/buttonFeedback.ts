import { isInteractionSoundEnabled } from '../services/appSettings';
import { hapticButton } from '../hooks/useHaptics';
import { playLogitechClickSoundEffect } from './logitechClickSound';

/** 统一按键反馈：震动（受设置「交互音效」总开关控制） */
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
