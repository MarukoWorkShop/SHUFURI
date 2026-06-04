let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

import { isInteractionSoundEnabled } from '../../services/appSettings';

/** 订正完成：极轻铅笔沙沙声 (~180ms) */
export function playPencilScratchSound(): void {
  if (!isInteractionSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const t = ctx.currentTime;
  const duration = 0.18;

  const bufferSize = Math.floor(ctx.sampleRate * 0.14);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const env = Math.exp(-i / (bufferSize * 0.35));
    data[i] = (Math.random() * 2 - 1) * env * 0.55;
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3200;
  filter.Q.value = 0.4;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.07, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(t);
  src.stop(t + duration);
}
