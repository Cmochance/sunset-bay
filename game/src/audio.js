// All sound is synthesized with WebAudio: oscillators and filtered noise, no
// audio files, no network. The context starts on the first user gesture, as
// browsers require, and everything is quiet until then.

/** Create the sound board. Call unlock() from a user gesture (key/click). */
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
    click() { tone(660, 0.07, 'square', 0.12); },
    pickup() { tone(880, 0.09, 'sine', 0.2); setTimeout(() => tone(1320, 0.12, 'sine', 0.2), 70); },
    coin() { tone(1046, 0.08, 'triangle', 0.2); setTimeout(() => tone(1568, 0.14, 'triangle', 0.18), 60); },
    punch() { noise(0.12, 0.3, 900); },
    shoot() { noise(0.14, 0.4, 2400); tone(180, 0.1, 'square', 0.2, 60); },
    crash() { noise(0.3, 0.5, 500); tone(90, 0.25, 'sawtooth', 0.25, 40); },
    mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.22), i * 90)); },
    fail() { tone(220, 0.3, 'sawtooth', 0.2, 110); },
    /** Two-tone police siren, called every frame while wanted; it self-times. */
    siren(dt) {
      if (!ctx || muted) return;
      sirenTimer -= dt;
      if (sirenTimer > 0) return;
      sirenTimer = 0.55;
      tone(700, 0.5, 'sine', 0.07);
      setTimeout(() => tone(950, 0.5, 'sine', 0.07), 260);
    },
    /** Continuous engine hum whose pitch follows speed 0..1. */
    engine(speed01) {
      if (!ctx || muted) { if (engineOsc) { try { engineOsc.stop(); } catch { /* already stopped */ } engineOsc = null; } return; }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 60;
        engineGain.gain.value = 0.0;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 500;
        engineOsc.connect(f);
        f.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.06, ctx.currentTime, 0.1);
    },
    engineOff() {
      if (engineOsc) { try { engineOsc.stop(); } catch { /* already stopped */ } engineOsc = null; engineGain = null; }
    },
  };
}
