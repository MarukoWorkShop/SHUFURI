let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * 短促物理「カタ」声（~120ms）：滤波噪声 + 低频体，模拟纸面/塑料按键，
 * 非电子 beep。
 */
export function playKataClickSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const t = ctx.currentTime;
  const duration = 0.12;

  const transientSize = Math.floor(ctx.sampleRate * 0.028);
  const transientBuffer = ctx.createBuffer(1, transientSize, ctx.sampleRate);
  const transientData = transientBuffer.getChannelData(0);
  for (let i = 0; i < transientSize; i++) {
    const env = Math.exp(-i / (transientSize * 0.1));
    transientData[i] = (Math.random() * 2 - 1) * env;
  }

  const transient = ctx.createBufferSource();
  transient.buffer = transientBuffer;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 680;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2200;
  lp.Q.value = 0.45;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.1, t + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  transient.connect(hp);
  hp.connect(lp);
  lp.connect(gain);
  gain.connect(ctx.destination);
  transient.start(t);
  transient.stop(t + duration);

  const bodySize = Math.floor(ctx.sampleRate * 0.042);
  const bodyBuffer = ctx.createBuffer(1, bodySize, ctx.sampleRate);
  const bodyData = bodyBuffer.getChannelData(0);
  for (let i = 0; i < bodySize; i++) {
    const env = Math.exp(-i / (bodySize * 0.2));
    bodyData[i] = (Math.random() * 2 - 1) * env;
  }

  const body = ctx.createBufferSource();
  body.buffer = bodyBuffer;

  const bodyFilter = ctx.createBiquadFilter();
  bodyFilter.type = 'bandpass';
  bodyFilter.frequency.value = 320;
  bodyFilter.Q.value = 0.75;

  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0.0001, t + 0.001);
  bodyGain.gain.exponentialRampToValueAtTime(0.038, t + 0.008);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

  body.connect(bodyFilter);
  bodyFilter.connect(bodyGain);
  bodyGain.connect(ctx.destination);
  body.start(t + 0.001);
  body.stop(t + duration);
}
