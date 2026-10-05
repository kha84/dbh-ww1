// Tiny synthesized sound effects (WebAudio, no assets)
export class Sfx {
  constructor() {
    this.ctx = null;
    this.engine = null;
  }

  resume() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch { return; }
      const len = this.ctx.sampleRate * 1.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  vol(dist) { return Math.max(0, 1 / (1 + dist / 60)); }

  burst(gain, dur, freq, q = 0.7) {
    if (!this.ctx || gain < 0.01) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.15), t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.3);
    src.stop(t + dur + 0.05);
  }

  shot(dist) {
    const v = this.vol(dist);
    this.burst(1.2 * v, 0.9, 2400);
    this.burst(1.0 * v, 1.6, 300, 2);
  }
  boom(dist, size = 1) {
    const v = this.vol(dist) * size;
    this.burst(0.9 * v, 1.3, 900);
  }
  // small arms: size ~0.6 pistol .. 1.1 machine gun
  gun(dist, size = 1) {
    const v = this.vol(dist * 1.6) * size;
    if (v < 0.02) return;
    this.burst(0.55 * v, 0.12 + 0.1 * size, 3800 + 1500 * size);
    this.burst(0.35 * v, 0.25, 700, 1.5);
  }
  ping(dist, k = 1) {
    if (!this.ctx) return;
    const v = this.vol(dist) * k;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(2400, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.35);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.45);
  }
  click() { this.burst(0.2, 0.08, 4000); }
  hiss() { this.burst(0.35, 0.6, 5000); }
  pour() { this.burst(0.12, 0.4, 1200, 3); }
  reload() { this.burst(0.18, 0.06, 5000); setTimeout(() => this.burst(0.2, 0.08, 3000), 180); }

  // railway: the steam whistle ('high' | 'low') or the air horn of a diesel ('horn')
  whistle(dist, kind = 'high', dur = 1.4) {
    if (!this.ctx) return;
    const v = this.vol(dist * 0.35);
    if (v < 0.01) return;
    const t = this.ctx.currentTime;
    const tones = kind === 'horn' ? [311, 370] : kind === 'low' ? [233, 277, 349] : [440, 554, 659];
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12 * v, t + 0.08);
    g.gain.setValueAtTime(0.12 * v, t + dur - 0.2);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = kind === 'horn' ? 1400 : 2600;
    f.connect(g); g.connect(this.master);
    for (const fr of tones) {
      const o = this.ctx.createOscillator();
      o.type = kind === 'horn' ? 'sawtooth' : 'triangle';
      o.frequency.setValueAtTime(fr * 0.97, t);
      o.frequency.linearRampToValueAtTime(fr, t + 0.12);
      o.connect(f);
      o.start(t); o.stop(t + dur + 0.05);
    }
    if (kind !== 'horn') this.burst(0.08 * v, dur, 3000, 0.4);       // the hiss of the steam
  }
  // one exhaust beat of a steam engine (k: how hard it works)
  chuff(dist, k = 1) {
    const v = this.vol(dist * 0.6) * k;
    this.burst(0.35 * v, 0.22, 900, 1.2);
  }
  // wheels over a rail joint: ta-tak
  clack(dist) {
    const v = this.vol(dist);
    this.burst(0.18 * v, 0.06, 2500, 2);
    setTimeout(() => this.burst(0.16 * v, 0.06, 2200, 2), 110);
  }
  // the bell of a level crossing
  bell(dist) {
    if (!this.ctx) return;
    const v = this.vol(dist * 0.5);
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 1180;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.4);
  }

  setEngine(on, load) {
    if (!this.ctx) return;
    if (!this.engine) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 220;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start();
      this.engine = { o, g, f };
    }
    const t = this.ctx.currentTime;
    this.engine.o.frequency.setTargetAtTime(on ? 32 + load * 38 : 20, t, 0.2);
    this.engine.g.gain.setTargetAtTime(on ? 0.12 + load * 0.1 : 0, t, 0.25);
  }
}
