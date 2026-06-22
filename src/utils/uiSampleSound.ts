const LOGITECH_CLICK_SOUND_URL = '/assets/sounds/logitech-click.wav';

type SoundCache = { audio?: HTMLAudioElement };

const logitechCache: SoundCache = {};

function playCachedSample(cache: SoundCache, url: string, volume: number): void {
  if (typeof window === 'undefined') return;
  try {
    if (!cache.audio) {
      cache.audio = new Audio(url);
      cache.audio.preload = 'auto';
    }
    const audio = cache.audio;
    audio.volume = volume;
    audio.currentTime = 0;
    const pending = audio.play();
    if (pending) void pending.catch(() => {});
  } catch {
    // 静音失败不影响主流程
  }
}

/** 语言拨轮 / Archive / Study Cards 点按（Logitech click.wav） */
export function playLogitechClickSound(): void {
  playCachedSample(logitechCache, LOGITECH_CLICK_SOUND_URL, 0.55);
}
