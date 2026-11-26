// 효과음: 파일 없이 WebAudio 로 합성 (임시). 첫 클릭 이후에만 소리가 난다.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.volume = 0.35;
  }

  unlock() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    } catch {}
  }

  _env(node, t, a, d, peak = 1) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    node.connect(g);
    g.connect(this.master);
    return g;
  }

  _noise(dur) {
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  _tone(type, f0, f1, t, dur, peak) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this._env(o, t, 0.005, dur, peak);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'shot': {
        const n = this._noise(0.08);
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 2200;
        n.connect(f);
        this._env(f, t, 0.002, 0.07, 0.6);
        n.start(t);
        this._tone('square', 180, 60, t, 0.06, 0.25);
        break;
      }
      case 'hit':
        this._tone('triangle', 900, 1400, t, 0.05, 0.25);
        break;
      case 'kill':
        this._tone('triangle', 500, 1200, t, 0.18, 0.35);
        break;
      case 'reload':
        this._tone('square', 300, 200, t, 0.05, 0.15);
        this._tone('square', 420, 380, t + 0.7, 0.05, 0.15);
        break;
      case 'empty':
        this._tone('square', 900, 850, t, 0.03, 0.1);
        break;
      case 'hurt':
        this._tone('sawtooth', 220, 110, t, 0.15, 0.3);
        break;
      case 'spawn':
        this._tone('sine', 200, 600, t, 0.25, 0.25);
        break;
      case 'pending':
        this._tone('sine', 160, 120, t, 0.4, 0.2);
        break;
      case 'siren':
        for (let i = 0; i < 3; i++) {
          this._tone('sawtooth', 420, 820, t + i * 0.6, 0.3, 0.25);
          this._tone('sawtooth', 820, 420, t + i * 0.6 + 0.3, 0.3, 0.25);
        }
        break;
      case 'boom': {
        const n = this._noise(0.5);
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 600;
        n.connect(f);
        this._env(f, t, 0.005, 0.45, 0.9);
        n.start(t);
        break;
      }
      case 'death':
        this._tone('sawtooth', 300, 50, t, 0.6, 0.35);
        break;
      case 'revive':
        this._tone('sine', 400, 900, t, 0.3, 0.3);
        this._tone('sine', 600, 1300, t + 0.15, 0.3, 0.25);
        break;
      case 'door':
        this._tone('square', 120, 240, t, 0.8, 0.3);
        break;
      case 'tick':
        this._tone('sine', 1000, 1000, t, 0.04, 0.1);
        break;
    }
  }
}
