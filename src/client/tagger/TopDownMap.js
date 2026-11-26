import { Emitter } from '../Emitter.js';
import { CELL, TILE } from '../../shared/map/GameMap.js';
import { PSTATE, EV } from '../../shared/protocol.js';
import { buildCutout } from '../render/PaperCutout.js';
import { drawAnimalFace } from '../render/AnimalModels.js';
import { planProps, hash2, rand } from '../render/DungeonKit.js';

// 술래 왼쪽 화면: 맵 탑뷰 실시간 관전 + 소환 위치 고르기.
// 몬스터는 작은 미니 그림(정면)으로 보인다.
// 배경은 돌블록 벽(윗면)·바닥 석판·횃불 빛무리·소품 실루엣까지 그려서 진짜 던전 지도처럼 보이게 한다.

const PX = 16; // 칸 하나 = 16px (배경 캔버스 해상도)

export class TopDownMap extends Emitter {
  constructor({ session, palette, balance }) {
    super();
    this.session = session;
    this.map = session.map;
    this.palette = palette;
    this.b = balance;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'topdown';
    this.ctx = this.canvas.getContext('2d');
    this.target = null;
    this.hover = null;
    this.minis = new Map();
    this.props = planProps(this.map);
    this.bg = this.renderBackground();

    this.canvas.addEventListener('pointerdown', (e) => {
      const w = this.toWorld(e);
      if (!w) return;
      this.target = w;
      this.emit('pick', w);
    });
    this.canvas.addEventListener('pointermove', (e) => (this.hover = this.toWorld(e)));
    this.canvas.addEventListener('pointerleave', () => (this.hover = null));
    this._off = [session.on(EV.MDIE, (e) => this.minis.delete(e.id))];
  }

  dispose() {
    this._off.forEach((f) => f());
  }

  // ---------- 배경: 바닥 석판 · 벽 돌블록 · 기둥 · 문 입구 ----------
  renderBackground() {
    const m = this.map;
    const c = document.createElement('canvas');
    c.width = m.w * PX;
    c.height = m.h * PX;
    const g = c.getContext('2d');
    g.fillStyle = '#07060b';
    g.fillRect(0, 0, c.width, c.height);

    // 1) 바닥: 2m 칸을 2×2 석판으로
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        if (m.tile(x, y) !== TILE.FLOOR) continue;
        const s = PX / 2;
        for (let j = 0; j < 2; j++) {
          for (let i = 0; i < 2; i++) {
            const v = 40 + hash2(x * 7 + i, y * 13 + j) * 12;
            g.fillStyle = `rgb(${v + 4},${v},${v + 10})`;
            g.fillRect(x * PX + i * s, y * PX + j * s, s, s);
            g.fillStyle = 'rgba(255,255,255,0.035)';
            g.fillRect(x * PX + i * s, y * PX + j * s, s, 1);
            g.fillStyle = 'rgba(0,0,0,0.4)';
            g.fillRect(x * PX + i * s, y * PX + (j + 1) * s - 1, s, 1);
            g.fillRect(x * PX + (i + 1) * s - 1, y * PX + j * s, 1, s);
          }
        }
        // 이따금 금 간 자국 · 빨간 낙서 자국
        const h = hash2(x, y);
        if (h > 0.86) {
          g.strokeStyle = 'rgba(0,0,0,0.5)';
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(x * PX + 3, y * PX + PX - 4);
          g.lineTo(x * PX + PX * 0.45, y * PX + PX * 0.45);
          g.lineTo(x * PX + PX - 3, y * PX + 3);
          g.stroke();
        } else if (h < 0.08) {
          g.strokeStyle = 'rgba(190,40,55,0.5)';
          g.lineWidth = 1.4;
          g.beginPath();
          g.arc(x * PX + PX / 2, y * PX + PX / 2, 3.4, 0.5, 4.4);
          g.stroke();
        }
      }
    }

    // 2) 벽 밑 그늘 (바닥 쪽 가장자리에 살짝)
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        if (m.tile(x, y) !== TILE.FLOOR) continue;
        const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          const t = m.tile(x + dx, y + dy);
          return t === TILE.WALL || t === TILE.PILLAR;
        });
        if (!near) continue;
        const grd = g.createRadialGradient(x * PX + PX / 2, y * PX + PX / 2, 1, x * PX + PX / 2, y * PX + PX / 2, PX * 1.1);
        grd.addColorStop(0, 'rgba(0,0,0,0)');
        grd.addColorStop(1, 'rgba(0,0,0,0.4)');
        g.fillStyle = grd;
        g.fillRect(x * PX - PX * 0.4, y * PX - PX * 0.4, PX * 1.8, PX * 1.8);
      }
    }

    // 3) 벽: 돌블록 쌓기 (밝은 윗면 + 검은 홈)
    const brick = (bx, by, bw, bh, seed) => {
      const v = 74 + hash2(seed, seed * 3 + 1) * 26;
      g.fillStyle = `rgb(${v},${v - 6},${v + 18})`;
      g.fillRect(bx, by, bw, bh);
      g.fillStyle = 'rgba(214,202,240,0.22)';
      g.fillRect(bx, by, bw, 1);
      g.fillRect(bx, by, 1, bh);
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(bx, by + bh - 1, bw, 1);
      g.fillRect(bx + bw - 1, by, 1, bh);
      // 돌 결
      g.fillStyle = 'rgba(0,0,0,0.16)';
      g.fillRect(bx + 2, by + bh * 0.5, bw - 4, 1);
    };
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        const t = m.tile(x, y);
        if (t !== TILE.WALL && t !== TILE.PILLAR) continue;
        if (t === TILE.PILLAR) continue;
        const off = y % 2 ? PX / 4 : 0;
        g.save();
        g.beginPath();
        g.rect(x * PX, y * PX, PX, PX);
        g.clip();
        for (let j = 0; j < 2; j++) {
          for (let i = -1; i < 3; i++) {
            brick(x * PX + i * (PX / 2) + off, y * PX + j * (PX / 2), PX / 2, PX / 2, x * 31 + y * 17 + i * 3 + j * 7);
          }
        }
        g.restore();
      }
    }
    // 벽이 바닥과 맞닿는 면을 밝게 (벽 두께가 살아 보이게)
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        if (m.tile(x, y) !== TILE.WALL) continue;
        const edges = [
          [0, 1, 0, 0, PX, 2],    // 위? (dy=+1 이면 아래쪽 벽면)
          [0, -1, 0, PX - 2, PX, 2],
          [1, 0, 0, 0, 2, PX],
          [-1, 0, PX - 2, 0, 2, PX],
        ];
        for (const [dx, dy, ox, oy, w2, h2] of edges) {
          const nt = m.tile(x + dx, y + dy);
          if (nt !== TILE.FLOOR) continue;
          g.fillStyle = 'rgba(196,182,230,0.16)';
          g.fillRect(x * PX + ox, y * PX + oy, w2, h2);
        }
      }
    }

    // 4) 기둥: 위에서 본 네모 기둥 머리
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        if (m.tile(x, y) !== TILE.PILLAR) continue;
        const cx = x * PX + PX / 2, cy = y * PX + PX / 2;
        const r = PX * 0.42;
        g.fillStyle = 'rgba(0,0,0,0.55)';
        g.fillRect(cx - r + 2, cy - r + 2, r * 2, r * 2);
        const grd = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        grd.addColorStop(0, '#9c90b8');
        grd.addColorStop(0.55, '#6a6084');
        grd.addColorStop(1, '#443c58');
        g.fillStyle = grd;
        g.fillRect(cx - r, cy - r, r * 2, r * 2);
        g.strokeStyle = 'rgba(10,8,16,0.95)';
        g.lineWidth = 1.6;
        g.strokeRect(cx - r, cy - r, r * 2, r * 2);
        // 머리 판 (한 단 넓은 사각형)
        g.strokeStyle = 'rgba(206,194,236,0.35)';
        g.lineWidth = 1;
        g.strokeRect(cx - r * 0.62, cy - r * 0.62, r * 1.24, r * 1.24);
      }
    }

    // 5) 문 입구 (통로 + 문틀)
    this.doorRects = this.map.doors.map((d) => {
      const xs = d.cells.map((c) => c[0]);
      const ys = d.cells.map((c) => c[1]);
      const x0 = Math.min(...xs) * PX, x1 = (Math.max(...xs) + 1) * PX;
      const y0 = Math.min(...ys) * PX, y1 = (Math.max(...ys) + 1) * PX;
      const horizontal = d.dir.z !== 0;
      // 통로 바닥
      g.fillStyle = '#0d0a13';
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
      // 통로 안쪽 어둠 그라데이션
      const grd = horizontal
        ? g.createLinearGradient(0, y0, 0, y1)
        : g.createLinearGradient(x0, 0, x1, 0);
      grd.addColorStop(0, 'rgba(0,0,0,0.85)');
      grd.addColorStop(1, 'rgba(0,0,0,0.15)');
      g.fillStyle = grd;
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
      // 문틀 (열린 쪽에 밝은 석재 테)
      const t = 5;
      g.fillStyle = 'rgba(150,138,178,0.85)';
      if (horizontal) {
        const fy = d.dir.z < 0 ? y1 - t : y0;
        g.fillRect(x0 - t, fy, x1 - x0 + t * 2, t);
        g.fillStyle = 'rgba(96,88,120,0.9)';
        g.fillRect(x0 - t, fy + (d.dir.z < 0 ? -t : t), x1 - x0 + t * 2, t);
      } else {
        const fx = d.dir.x < 0 ? x1 - t : x0;
        g.fillRect(fx, y0 - t, t, y1 - y0 + t * 2);
        g.fillStyle = 'rgba(96,88,120,0.9)';
        g.fillRect(fx + (d.dir.x < 0 ? -t : t), y0 - t, t, y1 - y0 + t * 2);
      }
      return { x0, y0, x1, y1, horizontal, d };
    });

    return c;
  }

  // 화면 맞춤 (가로세로 비율 유지)
  layout() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(r.width * dpr) || this.canvas.height !== Math.round(r.height * dpr)) {
      this.canvas.width = Math.max(1, Math.round(r.width * dpr));
      this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    }
    const W = this.canvas.width, H = this.canvas.height;
    const scale = Math.min(W / this.map.worldW, H / this.map.worldH) * 0.96;
    this.view = { scale, ox: (W - this.map.worldW * scale) / 2, oy: (H - this.map.worldH * scale) / 2, dpr };
  }

  toWorld(e) {
    if (!this.view) return null;
    const r = this.canvas.getBoundingClientRect();
    const { scale, ox, oy, dpr } = this.view;
    const x = ((e.clientX - r.left) * dpr - ox) / scale;
    const z = ((e.clientY - r.top) * dpr - oy) / scale;
    if (x < 0 || z < 0 || x > this.map.worldW || z > this.map.worldH) return null;
    return { x, z };
  }

  validSpot(p) {
    if (!p || !this.map.isFloor(p.x, p.z)) return false;
    for (const pl of this.session.players()) {
      if (pl.st === PSTATE.ALIVE && !(pl.bits & 16) && Math.hypot(pl.x - p.x, pl.z - p.z) < this.b.spawn.minPlayerDist) return false;
    }
    return true;
  }

  mini(id) {
    let m = this.minis.get(id);
    if (!m) {
      const meta = this.session.monsterMeta.get(id);
      if (!meta) return null;
      const cut = buildCutout(meta.strokes, this.palette, { outline: 10 });
      m = { cut, st: meta.st };
      this.minis.set(id, m);
    }
    return m;
  }

  // 횃불 빛무리 (따뜻한 주황) — 깜빡임
  drawTorchGlow(g, time, phase) {
    for (let i = 0; i < this.map.torches.length; i++) {
      const t = this.map.torches[i];
      const f = 0.82 + Math.sin(time * 8 + i * 1.7) * 0.12 + Math.sin(time * 19 + i) * 0.06;
      const R = 6.4 * f;
      const grd = g.createRadialGradient(t.x, t.z, 0.2, t.x, t.z, R);
      grd.addColorStop(0, `rgba(255,206,140,${0.55 * f * phase})`);
      grd.addColorStop(0.3, `rgba(255,140,50,${0.3 * f * phase})`);
      grd.addColorStop(1, 'rgba(255,90,20,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(t.x, t.z, R, 0, Math.PI * 2);
      g.fill();
      // 심지
      g.fillStyle = `rgba(255,238,190,${0.95 * phase})`;
      g.beginPath();
      g.arc(t.x, t.z, 0.22, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = `rgba(255,150,50,${0.8 * phase})`;
      g.beginPath();
      g.arc(t.x, t.z, 0.45, 0, Math.PI * 2);
      g.fill();
    }
  }

  // 소품 실루엣 (3D 와 같은 배치)
  drawProps(g, u) {
    for (const p of this.props) {
      if (p.kind === 'barrel') {
        g.fillStyle = '#2b1b11';
        g.beginPath();
        g.arc(p.x, p.z, 0.36 * p.s, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(146,108,68,0.95)';
        g.lineWidth = 1.3 * u;
        g.stroke();
        g.strokeStyle = 'rgba(120,96,70,0.55)';
        g.lineWidth = 1 * u;
        g.beginPath();
        g.arc(p.x, p.z, 0.22 * p.s, 0, Math.PI * 2);
        g.stroke();
      } else if (p.kind === 'crate') {
        const s = 0.44 * p.s;
        g.save();
        g.translate(p.x, p.z);
        g.rotate(p.ry * 0.15);
        g.fillStyle = '#2c1e14';
        g.fillRect(-s, -s, s * 2, s * 2);
        g.strokeStyle = 'rgba(126,96,62,0.9)';
        g.lineWidth = 1.2 * u;
        g.strokeRect(-s, -s, s * 2, s * 2);
        g.beginPath();
        g.moveTo(-s, -s);
        g.lineTo(s, s);
        g.moveTo(s, -s);
        g.lineTo(-s, s);
        g.stroke();
        g.restore();
      } else if (p.kind === 'rubble') {
        g.fillStyle = 'rgba(120,112,140,0.85)';
        for (let i = 0; i < 3; i++) {
          const a = p.ry + i * 2.1;
          g.beginPath();
          g.arc(p.x + Math.cos(a) * 0.28, p.z + Math.sin(a) * 0.28, 0.13 * p.s, 0, Math.PI * 2);
          g.fill();
        }
      } else if (p.kind === 'banner') {
        // 벽에 붙은 보라 깃발 (벽면 쪽으로 얇게)
        g.save();
        g.translate(p.x, p.z);
        g.rotate(p.ry);
        g.fillStyle = 'rgba(92,52,134,0.95)';
        g.fillRect(-0.55, -0.12, 1.1, 0.24);
        g.fillStyle = 'rgba(190,170,225,0.8)';
        g.fillRect(-0.5, -0.06, 1.0, 0.05);
        g.restore();
      } else if (p.kind === 'wallchain') {
        g.strokeStyle = 'rgba(150,140,170,0.5)';
        g.lineWidth = 1 * u;
        g.beginPath();
        g.arc(p.x, p.z + 0.3, 0.28, 0, Math.PI * 2);
        g.stroke();
      }
    }
  }

  // 탈출문: 닫힘(철창) → 공개(붉은 빛·X사슬·자물쇠) → 열림(밝은 탈출구)
  drawGate(g, rect, revealed, open, time) {
    const { x0, y0, x1, y1, horizontal } = rect;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const wSpan = horizontal ? x1 - x0 : y1 - y0;
    const wx = horizontal ? wSpan : x1 - x0;
    const wy = horizontal ? y1 - y0 : wSpan;

    // 열린 문: 문 너머의 밝은 빛
    if (open) {
      const R = Math.max(wx, wy) * 1.5;
      const grd = g.createRadialGradient(cx, cy, 1, cx, cy, R);
      grd.addColorStop(0, 'rgba(255,246,210,0.95)');
      grd.addColorStop(0.4, 'rgba(255,206,120,0.55)');
      grd.addColorStop(1, 'rgba(255,170,60,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.fill();
      // 바닥으로 새어 나오는 빛
      g.fillStyle = 'rgba(255,220,150,0.12)';
      g.beginPath();
      g.ellipse(cx, cy + wy * 0.9, wx * 0.9, wy * 0.8, 0, 0, Math.PI * 2);
      g.fill();
      return;
    }

    // 철창 (문틀 안쪽)
    g.save();
    g.beginPath();
    g.rect(x0, y0, x1 - x0, y1 - y0);
    g.clip();
    g.strokeStyle = revealed ? 'rgba(120,112,145,0.95)' : 'rgba(92,86,110,0.9)';
    g.lineWidth = 1.4;
    if (horizontal) {
      for (let x = x0 + 4; x < x1; x += 5) {
        g.beginPath();
        g.moveTo(x, y0);
        g.lineTo(x, y1);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(x0, y0 + (y1 - y0) * 0.35);
      g.lineTo(x1, y0 + (y1 - y0) * 0.35);
      g.moveTo(x0, y0 + (y1 - y0) * 0.7);
      g.lineTo(x1, y0 + (y1 - y0) * 0.7);
      g.stroke();
    } else {
      for (let y = y0 + 4; y < y1; y += 5) {
        g.beginPath();
        g.moveTo(x0, y);
        g.lineTo(x1, y);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(x0 + (x1 - x0) * 0.35, y0);
      g.lineTo(x0 + (x1 - x0) * 0.35, y1);
      g.moveTo(x0 + (x1 - x0) * 0.7, y0);
      g.lineTo(x0 + (x1 - x0) * 0.7, y1);
      g.stroke();
    }
    g.restore();

    if (!revealed) return;

    // 공개된 문: 붉은 광채 + X자 사슬 + 자물쇠
    const pulse = 0.6 + Math.sin(time * 5) * 0.25;
    const R = Math.max(wx, wy) * 1.15;
    const grd = g.createRadialGradient(cx, cy, 1, cx, cy, R);
    grd.addColorStop(0, `rgba(255,50,70,${0.5 * pulse})`);
    grd.addColorStop(0.55, `rgba(220,20,50,${0.22 * pulse})`);
    grd.addColorStop(1, 'rgba(200,10,40,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();

    // X자 사슬 4가닥
    const L = { x: x0 + 3, y: y0 + 3 }, Rr = { x: x1 - 3, y: y1 - 3 };
    g.lineCap = 'round';
    for (const [a, b, col] of [
      [L, Rr, 'rgba(28,22,34,0.95)'],
      [{ x: Rr.x, y: L.y }, { x: L.x, y: Rr.y }, 'rgba(28,22,34,0.95)'],
      [L, Rr, 'rgba(255,70,80,0.5)'],
      [{ x: Rr.x, y: L.y }, { x: L.x, y: Rr.y }, 'rgba(255,70,80,0.5)'],
    ]) {
      g.strokeStyle = col;
      g.lineWidth = 2.6;
      g.setLineDash([3.2, 2.2]);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
      g.setLineDash([]);
    }

    // 자물쇠
    const bw = Math.min(wx * 0.34, 15), bh = bw * 0.82;
    g.save();
    g.translate(cx, cy);
    g.shadowColor = 'rgba(255,40,60,0.95)';
    g.shadowBlur = 10 + pulse * 8;
    g.strokeStyle = `rgba(255,${60 + pulse * 40},${80 + pulse * 40},1)`;
    g.lineWidth = 2.6;
    // 걸쇠
    g.beginPath();
    g.arc(0, -bh * 0.5, bw * 0.26, Math.PI, 0);
    g.stroke();
    // 몸통
    g.fillStyle = 'rgba(58,8,16,0.95)';
    g.strokeStyle = `rgba(255,${50 + pulse * 60},${70 + pulse * 70},1)`;
    g.beginPath();
    g.roundRect ? g.roundRect(-bw / 2, -bh * 0.28, bw, bh * 0.8, 2.5) : g.rect(-bw / 2, -bh * 0.28, bw, bh * 0.8);
    g.fill();
    g.stroke();
    // 열쇠 구멍
    g.fillStyle = '#12040a';
    g.beginPath();
    g.arc(0, 0, bw * 0.1, 0, Math.PI * 2);
    g.fill();
    g.fillRect(-bw * 0.04, 0, bw * 0.08, bh * 0.26);
    g.restore();
  }

  render(time) {
    this.layout();
    const g = this.ctx;
    const { scale, ox, oy, dpr } = this.view;
    const W = this.canvas.width, H = this.canvas.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#07060b';
    g.fillRect(0, 0, W, H);
    g.setTransform(scale, 0, 0, scale, ox, oy);
    g.imageSmoothingEnabled = true;
    g.drawImage(this.bg, 0, 0, this.map.worldW, this.map.worldH);
    const S = this.session;
    const u = 1 / scale; // 화면 1px 을 월드 단위로

    // 횃불 빛 (지도 위에 따뜻한 얼룩)
    this.drawTorchGlow(g, time, 1);

    // 탈출 문 3곳 (구조는 늘 보이고, 공개·열림만 상태로)
    if (this.doorRects) {
      for (let i = 0; i < this.doorRects.length; i++) {
        const revealed = S.doorRevealed === i;
        const open = revealed && S.doorOpen;
        this.drawGate(g, this.doorRects[i], revealed, open, time);
      }
    }

    // 소품
    this.drawProps(g, u);

    // 플레이어 주변 소환 금지 구역
    const players = S.players();
    g.fillStyle = 'rgba(220,40,60,0.1)';
    g.strokeStyle = 'rgba(220,40,60,0.4)';
    g.lineWidth = u * 1.5 * dpr;
    for (const p of players) {
      if (p.st !== PSTATE.ALIVE || p.bits & 16) continue;
      const pp = S.playerPos(p.id) || p;
      g.beginPath();
      g.arc(pp.x, pp.z, this.b.spawn.minPlayerDist, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }

    // 빨간 장판 (대기 중 소환)
    for (const z of S.pending.values()) {
      const left = Math.max(0, (z.until - performance.now()) / 1000);
      g.fillStyle = z.kind === 'normal' ? 'rgba(230,30,45,0.45)' : 'rgba(255,20,60,0.6)';
      g.beginPath();
      g.arc(z.x, z.z, z.r + (z.kind === 'normal' ? 0.4 : 1.5), 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.font = `bold ${14 * u * dpr}px sans-serif`;
      g.textAlign = 'center';
      g.fillText(left.toFixed(1), z.x, z.z + 5 * u * dpr);
    }

    // 몬스터 미니 그림
    for (const id of S.monsterMeta.keys()) {
      const p = S.monsterPos(id);
      const mi = this.mini(id);
      if (!p || !mi) continue;
      const w = Math.max(3.6, mi.st.width * 1.8);
      const k = w / mi.cut.canvas.width;
      const h = mi.cut.canvas.height * k;
      // 바닥 그림자
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.beginPath();
      g.ellipse(p.x, p.z + h * 0.2, w * 0.42, w * 0.13, 0, 0, Math.PI * 2);
      g.fill();
      g.drawImage(mi.cut.canvas, p.x - w / 2, p.z - h * 0.85, w, h);
      g.fillStyle = '#1a1414';
      g.fillRect(p.x - w / 2, p.z + h * 0.18, w, 0.5);
      g.fillStyle = '#e0303f';
      g.fillRect(p.x - w / 2, p.z + h * 0.18, (w * p.hp) / p.maxHp, 0.5);
    }

    // 플레이어 (동물 얼굴 + 발밑 색 링)
    for (const p of players) {
      if (p.st === PSTATE.ESCAPED || p.st === PSTATE.OUT) continue;
      const pp = S.playerPos(p.id) || p;
      const dead = p.st === PSTATE.DEAD;
      g.fillStyle = dead ? 'rgba(60,60,60,0.55)' : 'rgba(0,0,0,0.45)';
      g.beginPath();
      g.ellipse(pp.x, pp.z + 0.5, 1.7, 0.7, 0, 0, Math.PI * 2);
      g.fill();
      if (!dead) {
        const ring = g.createRadialGradient(pp.x, pp.z, 0.6, pp.x, pp.z, 2.2);
        ring.addColorStop(0, 'rgba(120,220,255,0.35)');
        ring.addColorStop(1, 'rgba(120,220,255,0)');
        g.fillStyle = ring;
        g.beginPath();
        g.arc(pp.x, pp.z, 2.2, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = dead ? 'rgba(90,90,90,0.9)' : 'rgba(255,255,255,0.95)';
      g.beginPath();
      g.arc(pp.x, pp.z, 1.6, 0, Math.PI * 2);
      g.fill();
      drawAnimalFace(g, S.animalOf(p.id), pp.x, pp.z + 0.2, 1.1, { dead });
      // 닉네임 (얼굴 아래, 화면 크기와 상관없이 같은 글씨 크기)
      const fs = 13 * u * dpr;
      g.font = `${fs}px Jua, "Malgun Gothic", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'top';
      g.lineJoin = 'round';
      g.lineWidth = 3.5 * u * dpr;
      g.strokeStyle = 'rgba(8,6,12,0.9)';
      const label = S.nameOf(p.id);
      g.strokeText(label, pp.x, pp.z + 1.85);
      g.fillStyle = dead ? '#9a92a6' : '#f3ecdd';
      g.fillText(label, pp.x, pp.z + 1.85);
      g.textBaseline = 'alphabetic';
      if (!dead) {
        g.strokeStyle = 'rgba(255,255,255,0.75)';
        g.lineWidth = 0.35;
        g.beginPath();
        g.moveTo(pp.x - Math.sin(pp.yaw) * 1.8, pp.z - Math.cos(pp.yaw) * 1.8);
        g.lineTo(pp.x - Math.sin(pp.yaw) * 3, pp.z - Math.cos(pp.yaw) * 3);
        g.stroke();
      }
    }

    // 고른 위치 / 마우스 위치
    for (const [p, solid] of [[this.hover, false], [this.target, true]]) {
      if (!p) continue;
      const ok = this.validSpot(p);
      g.strokeStyle = ok ? 'rgba(120,255,160,0.95)' : 'rgba(255,80,80,0.95)';
      g.lineWidth = (solid ? 3 : 1.5) * u * dpr;
      g.beginPath();
      g.arc(p.x, p.z, 1.4, 0, Math.PI * 2);
      g.moveTo(p.x - 2.4, p.z);
      g.lineTo(p.x + 2.4, p.z);
      g.moveTo(p.x, p.z - 2.4);
      g.lineTo(p.x, p.z + 2.4);
      g.stroke();
    }

    // 가장자리 어둡게 (던전 분위기)
    g.setTransform(1, 0, 0, 1, 0, 0);
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.72)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
  }
}
