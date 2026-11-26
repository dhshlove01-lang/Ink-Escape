import { Emitter } from '../Emitter.js';
import { drawStrokes } from '../render/PaperCutout.js';
import { CANVAS_SIZE } from '../../shared/judge/StrokeRasterizer.js';
import { img } from '../render/Images.js';

// 도화지 (마우스로 그리기). 획 데이터만 들고 있고, 판정은 모른다 (SRP).

export const BRUSHES = [
  { key: 'thin', w: 10 },
  { key: 'mid', w: 18 },
  { key: 'thick', w: 34 },
];

export class DrawingPad extends Emitter {
  constructor({ palette }) {
    super();
    this.palette = palette;
    this.strokes = [];
    this.color = 1;
    this.width = BRUSHES[1].w;
    this.eraser = false;
    this.cur = null;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = CANVAS_SIZE;
    this.canvas.className = 'pad';
    this.layer = document.createElement('canvas');
    this.layer.width = this.layer.height = CANVAS_SIZE;
    this.ctx = this.canvas.getContext('2d');

    const pos = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return [
        Math.max(0, Math.min(CANVAS_SIZE, Math.round(((e.clientX - r.left) / r.width) * CANVAS_SIZE))),
        Math.max(0, Math.min(CANVAS_SIZE, Math.round(((e.clientY - r.top) / r.height) * CANVAS_SIZE))),
      ];
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.canvas.setPointerCapture(e.pointerId);
      const [x, y] = pos(e);
      this.cur = { c: this.eraser ? 0 : this.color, w: this.eraser ? Math.max(24, this.width) : this.width, p: [x, y] };
      this.strokes.push(this.cur);
      this.render();
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.cur) return;
      const [x, y] = pos(e);
      const p = this.cur.p;
      if (Math.hypot(x - p[p.length - 2], y - p[p.length - 1]) < 3) return;
      p.push(x, y);
      this.render();
    });
    const end = () => {
      if (!this.cur) return;
      this.cur = null;
      this.emit('change', this.strokes);
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    this.render();
  }

  setColor(i) {
    this.color = i;
    this.eraser = false;
    this.emit('tool');
  }

  setWidth(w) {
    this.width = w;
    this.emit('tool');
  }

  setEraser(on) {
    this.eraser = on;
    this.emit('tool');
  }

  undo() {
    this.strokes.pop();
    this.render();
    this.emit('change', this.strokes);
  }

  clear() {
    this.strokes = [];
    this.render();
    this.emit('change', this.strokes);
  }

  load(strokes) {
    this.strokes = strokes.map((s) => ({ c: s.c, w: s.w, p: [...s.p] }));
    this.render();
    this.emit('change', this.strokes);
  }

  getStrokes() {
    return this.strokes.filter((s) => s.p.length >= 2).map((s) => ({ c: s.c, w: s.w, p: s.p.map((v) => Math.round(v)) }));
  }

  render() {
    const g = this.ctx;
    const S = CANVAS_SIZE;
    const paper = img('ui.paper');
    if (paper) g.drawImage(paper, 0, 0, S, S);
    else {
      g.fillStyle = '#f6f1e6';
      g.fillRect(0, 0, S, S);
      // 공책 줄
      g.strokeStyle = 'rgba(80,110,170,0.13)';
      g.lineWidth = 1;
      for (let y = 32; y < S; y += 32) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(S, y);
        g.stroke();
      }
    }
    const lg = this.layer.getContext('2d');
    lg.clearRect(0, 0, S, S);
    drawStrokes(lg, this.strokes, this.palette);
    g.drawImage(this.layer, 0, 0);
  }
}
