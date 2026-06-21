import { isInteractionSoundEnabled } from '../services/appSettings';
import { hapticButton } from '../hooks/useHaptics';
import { playKataClickSound } from './kataClickSound';
import { playLogitechClickSoundEffect } from './logitechClickSound';

/** 统一按键反馈：轻震 + kata.wav（受设置「交互音效」总开关控制） */
export function triggerButtonPressFeedback(): void {
  if (!isInteractionSoundEnabled()) {
    return;
  }
  hapticButton();
  playKataClickSound();
}

/** Archive / Study Cards 等：轻震 + Logitech click.wav */
export function triggerLogitechPressFeedback(): void {
  if (!isInteractionSoundEnabled()) {
    return;
  }
  hapticButton();
  playLogitechClickSoundEffect();
}
