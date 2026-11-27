import { GUN_FEEL } from '../../config/gunfeel.js';

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

  // 걸러진 잡음 한 겹 (총성·기계음)
  _band(len, type, freq, t, a, d, peak) {
    const n = this._noise(len);
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    n.connect(f);
    this._env(f, t, a, d, peak);
    n.start(t);
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
        // 3겹: 저음 펀치 + 날카로운 총성 + 노리쇠·탄피 기계음. 매 발 피치·볼륨 무작위 (config/gunfeel.js sound)
        const { pitch: pr, volume: vr } = GUN_FEEL.sound;
        const p = pr[0] + Math.random() * (pr[1] - pr[0]);
        const v = vr[0] + Math.random() * (vr[1] - vr[0]);
        this._tone('sine', 120 * p, 42 * p, t, 0.11, 0.55 * v); // 저음 펀치 (몸으로 느끼는 쿵)
        this._tone('square', 190 * p, 70 * p, t, 0.05, 0.16 * v);
        this._band(0.07, 'highpass', 1700 * p, t, 0.0015, 0.06, 0.5 * v); // 날카로운 총성 (탕)
        this._band(0.03, 'bandpass', 3600 * p, t + 0.032, 0.001, 0.025, 0.22 * v); // 노리쇠 철컥
        this._tone('square', 1500 * p, 950 * p, t + 0.034, 0.018, 0.05 * v);
        break;
      }
      case 'shell': // 탄피가 바닥에 떨어지는 팅
        this._tone('sine', 5200 + Math.random() * 900, 4300, t, 0.05, 0.05);
        this._tone('sine', 7300 + Math.random() * 600, 6600, t + 0.06, 0.035, 0.025);
        break;
      case 'hitKill': // 처치 한 발: 높은 '띵'
        this._tone('triangle', 1600, 2400, t, 0.07, 0.3);
        this._tone('sine', 3200, 3600, t + 0.02, 0.09, 0.14);
        break;
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
      case 'pickup': // 보급 카드가 열림
        this._tone('triangle', 520, 780, t, 0.12, 0.25);
        this._tone('triangle', 780, 1170, t + 0.1, 0.16, 0.22);
        break;
      case 'crate': // 보급 상자 착지
        this._tone('square', 160, 70, t, 0.25, 0.3);
        this._tone('sine', 880, 1320, t + 0.18, 0.2, 0.15);
        break;
    }
  }
}
