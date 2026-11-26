import { Emitter } from '../Emitter.js';
import { CELL, TILE } from '../../shared/map/GameMap.js';
import { PSTATE, EV } from '../../shared/protocol.js';
import { buildCutout } from '../render/PaperCutout.js';
import { drawAnimalFace } from '../render/AnimalModels.js';

// 술래 왼쪽 화면: 맵 탑뷰 실시간 관전 + 소환 위치 고르기.
// 몬스터는 작은 미니 그림(정면)으로 보인다.

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

  renderBackground() {
    const m = this.map;
    const px = 12; // 칸 하나 = 12px
    const c = document.createElement('canvas');
    c.width = m.w * px;
    c.height = m.h * px;
    const g = c.getContext('2d');
    g.fillStyle = '#121016';
    g.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        const t = m.tile(x, y);
        if (t === TILE.FLOOR) g.fillStyle = (x + y) % 2 ? '#3a3641' : '#36323d';
        else if (t === TILE.PILLAR) g.fillStyle = '#6b6378';
        else if (t === TILE.DOOR) g.fillStyle = '#5a1822';
        else continue;
        g.fillRect(x * px, y * px, px, px);
      }
    }
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        if (m.tile(x, y) === TILE.WALL) continue;
        g.strokeRect(x * px + 0.5, y * px + 0.5, px - 1, px - 1);
      }
    }
    this.px = px;
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

  render(time) {
    this.layout();
    const g = this.ctx;
    const { scale, ox, oy, dpr } = this.view;
    const W = this.canvas.width, H = this.canvas.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0b0a0e';
    g.fillRect(0, 0, W, H);
    g.setTransform(scale, 0, 0, scale, ox, oy);
    g.imageSmoothingEnabled = false;
    g.drawImage(this.bg, 0, 0, this.map.worldW, this.map.worldH);
    g.imageSmoothingEnabled = true;
    const S = this.session;
    const u = 1 / scale; // 화면 1px 을 월드 단위로

    // 탈출 문
    if (S.doorRevealed >= 0) {
      const d = this.map.doors[S.doorRevealed];
      g.fillStyle = S.doorOpen ? 'rgba(120,255,170,0.8)' : `rgba(255,60,80,${0.5 + Math.sin(time * 6) * 0.3})`;
      g.beginPath();
      g.arc(d.center.x, d.center.z, 3, 0, Math.PI * 2);
      g.fill();
    }

    // 플레이어 주변 소환 금지 구역
    const players = S.players();
    g.fillStyle = 'rgba(220,40,60,0.13)';
    g.strokeStyle = 'rgba(220,40,60,0.45)';
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
      g.drawImage(mi.cut.canvas, p.x - w / 2, p.z - h * 0.85, w, h);
      g.fillStyle = '#1a1414';
      g.fillRect(p.x - w / 2, p.z + h * 0.18, w, 0.5);
      g.fillStyle = '#e0303f';
      g.fillRect(p.x - w / 2, p.z + h * 0.18, (w * p.hp) / p.maxHp, 0.5);
    }

    // 플레이어 (동물 얼굴)
    for (const p of players) {
      if (p.st === PSTATE.ESCAPED || p.st === PSTATE.OUT) continue;
      const pp = S.playerPos(p.id) || p;
      const dead = p.st === PSTATE.DEAD;
      g.fillStyle = dead ? 'rgba(80,80,80,0.9)' : 'rgba(255,255,255,0.95)';
      g.beginPath();
      g.arc(pp.x, pp.z, 1.6, 0, Math.PI * 2);
      g.fill();
      drawAnimalFace(g, S.animalOf(p.id), pp.x, pp.z + 0.2, 1.1, { dead });
      if (!dead) {
        // 바라보는 방향
        g.strokeStyle = 'rgba(255,255,255,0.8)';
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
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
}
