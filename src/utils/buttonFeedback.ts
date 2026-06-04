import { isInteractionSoundEnabled } from '../services/appSettings';
import { hapticButton } from '../hooks/useHaptics';
import { playKataClickSound } from './kataClickSound';

/** 统一按键反馈：轻震 + カタ 声（受设置「交互音效」总开关控制） */
export function triggerButtonPressFeedback(): void {
  if (!isInteractionSoundEnabled()) {
    return;
  }
  hapticButton();
  playKataClickSound();
}
