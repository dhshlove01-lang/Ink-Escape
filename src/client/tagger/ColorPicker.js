import { Emitter } from '../Emitter.js';
import { rgbToHsv } from '../../shared/attributes.js';

// 컬러 피커: 채도·밝기 네모(가로=채도, 세로=밝기) + 색상 막대(세로).
// 'change' 이벤트로 rgb 정수(0xRRGGBB)를 낸다. 속성 판정은 이 위젯이 모른다 (SRP).

const SQ = 168; // 네모 크기(px)
const BAR_W = 18;

function hsvToRgb(h, s, v) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return (Math.round(f(5) * 255) << 16) | (Math.round(f(3) * 255) << 8) | Math.round(f(1) * 255);
}

export class ColorPicker extends Emitter {
  constructor(initial = 0x1d1b22) {
    super();
    const hsv = rgbToHsv(initial);
    this.h = hsv.h;
    this.s = hsv.s;
    this.v = hsv.v;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.root = document.createElement('div');
    this.root.className = 'color-picker';
    this.sq = document.createElement('canvas');
    this.sq.className = 'cp-square';
    this.sq.width = this.sq.height = SQ * dpr;
    this.bar = document.createElement('canvas');
    this.bar.className = 'cp-hue';
    this.bar.width = BAR_W * dpr;
    this.bar.height = SQ * dpr;
    this.root.append(this.sq, this.bar);
    this.dpr = dpr;
    this.drawBar();
    this.draw();

    const drag = (canvas, fn) => {
      const move = (e) => {
        const r = canvas.getBoundingClientRect();
        fn(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)));
      };
      canvas.addEventListener('pointerdown', (e) => {
        canvas.setPointerCapture(e.pointerId);
        move(e);
        const up = () => {
          canvas.removeEventListener('pointermove', move);
          canvas.removeEventListener('pointerup', up);
        };
        canvas.addEventListener('pointermove', move);
        canvas.addEventListener('pointerup', up);
      });
    };
    drag(this.sq, (x, y) => {
      this.s = x;
      this.v = 1 - y;
      this.changed();
    });
    drag(this.bar, (_x, y) => {
      this.h = Math.min(359.9, y * 360);
      this.changed();
    });
  }

  get rgb() {
    return hsvToRgb(this.h, this.s, this.v);
  }

  set(rgb) {
    const hsv = rgbToHsv(rgb);
    if (hsv.s > 0.01) this.h = hsv.h; // 회색이면 색상은 그대로 둔다
    this.s = hsv.s;
    this.v = hsv.v;
    this.changed();
  }

  changed() {
    this.draw();
    this.emit('change', this.rgb);
  }

  drawBar() {
    const g = this.bar.getContext('2d');
    const H = this.bar.height;
    const grad = g.createLinearGradient(0, 0, 0, H);
    for (let i = 0; i <= 6; i++) grad.addColorStop(i / 6, `hsl(${i * 60},100%,50%)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, this.bar.width, H);
    this.barBase = g.getImageData(0, 0, this.bar.width, H);
  }

  draw() {
    const g = this.sq.getContext('2d');
    const S = this.sq.width;
    g.fillStyle = `hsl(${this.h},100%,50%)`;
    g.fillRect(0, 0, S, S);
    const white = g.createLinearGradient(0, 0, S, 0);
    white.addColorStop(0, '#fff');
    white.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = white;
    g.fillRect(0, 0, S, S);
    const black = g.createLinearGradient(0, 0, 0, S);
    black.addColorStop(0, 'rgba(0,0,0,0)');
    black.addColorStop(1, '#000');
    g.fillStyle = black;
    g.fillRect(0, 0, S, S);
    // 고른 자리 표시
    const x = this.s * S, y = (1 - this.v) * S, r = 6 * this.dpr;
    g.lineWidth = 2 * this.dpr;
    g.strokeStyle = this.v > 0.5 ? '#000' : '#fff';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.stroke();
    // 색상 막대 표시
    const b = this.bar.getContext('2d');
    b.putImageData(this.barBase, 0, 0);
    const hy = (this.h / 360) * this.bar.height;
    b.strokeStyle = '#fff';
    b.lineWidth = 2 * this.dpr;
    b.strokeRect(1, hy - 3 * this.dpr, this.bar.width - 2, 6 * this.dpr);
  }
}
