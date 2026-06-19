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

/**
 * 机械拨轮「咔嗒」一声（~55ms）：高频瞬态 + 短金属感，清脆利落，区别于按键カタ声。
 */
export function playWheelDialTickSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const t = ctx.currentTime;
  const duration = 0.055;

  const clickSize = Math.floor(ctx.sampleRate * 0.018);
  const clickBuffer = ctx.createBuffer(1, clickSize, ctx.sampleRate);
  const clickData = clickBuffer.getChannelData(0);
  for (let i = 0; i < clickSize; i++) {
    const env = Math.exp(-i / (clickSize * 0.07));
    clickData[i] = (Math.random() * 2 - 1) * env;
  }

  const click = ctx.createBufferSource();
  click.buffer = clickBuffer;

  const clickFilter = ctx.createBiquadFilter();
  clickFilter.type = 'bandpass';
  clickFilter.frequency.value = 2800;
  clickFilter.Q.value = 1.1;

  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.0001, t);
  clickGain.gain.exponentialRampToValueAtTime(0.14, t + 0.0015);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  click.connect(clickFilter);
  clickFilter.connect(clickGain);
  clickGain.connect(ctx.destination);
  click.start(t);
  click.stop(t + duration);

  const ping = ctx.createOscillator();
  ping.type = 'square';
  ping.frequency.setValueAtTime(2100, t);
  ping.frequency.exponentialRampToValueAtTime(1200, t + 0.02);

  const pingFilter = ctx.createBiquadFilter();
  pingFilter.type = 'highpass';
  pingFilter.frequency.value = 900;

  const pingGain = ctx.createGain();
  pingGain.gain.setValueAtTime(0.0001, t);
  pingGain.gain.exponentialRampToValueAtTime(0.028, t + 0.002);
  pingGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);

  ping.connect(pingFilter);
  pingFilter.connect(pingGain);
  pingGain.connect(ctx.destination);
  ping.start(t);
  ping.stop(t + 0.04);
}
