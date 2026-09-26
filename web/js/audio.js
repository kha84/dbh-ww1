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
  ping(dist) {
    if (!this.ctx) return;
    const v = this.vol(dist);
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
