import * as THREE from 'three';
import { texture } from '../render/Images.js';

// 일회성 연출: 총알 궤적, 지우개 수류탄, 폭발, 소환 연기.
// 사용자 이펙트 이미지(vfx.*)가 있으면 스프라이트로, 없으면 기본 도형으로.

// 검은 배경 이펙트 이미지는 가산 합성(검정 = 안 보임)으로 그린다.
export function vfxSprite(key, size, { additive = true } = {}) {
  const tex = texture(key);
  if (!tex) return null;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
  const a = tex.image.width / tex.image.height;
  s.scale.set(size * Math.min(1, a), size / Math.max(1, a), 1);
  s.userData.base = s.scale.clone();
  return s;
}

// 총알 궤적: 가운데 밝은 심 + 바깥 빛 (Line 은 굵기를 못 바꿔서 원기둥 두 겹)
const TRACER_GEO = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// 총알 자국 그림 (처음 쓸 때 한 번 그림): 까만 구멍 + 그을음 + 금
let holeTex = null;
function bulletHoleTexture() {
  if (holeTex) return holeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const soot = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  soot.addColorStop(0, 'rgba(12,10,14,0.85)');
  soot.addColorStop(0.45, 'rgba(20,16,22,0.45)');
  soot.addColorStop(1, 'rgba(20,16,22,0)');
  g.fillStyle = soot;
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(8,6,10,0.9)';
  g.lineWidth = 1.6;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + i * 0.7;
    g.beginPath();
    g.moveTo(32 + Math.cos(a) * 6, 32 + Math.sin(a) * 6);
    g.lineTo(32 + Math.cos(a + 0.25) * 15, 32 + Math.sin(a + 0.25) * 15);
    g.lineTo(32 + Math.cos(a - 0.1) * (20 + (i % 3) * 3), 32 + Math.sin(a - 0.1) * (20 + (i % 3) * 3));
    g.stroke();
  }
  g.fillStyle = 'rgba(240,228,204,0.8)'; // 깨진 돌가루 테두리 (밝게 → 어두운 벽에서도 보임)
  g.beginPath();
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2, r = 13 + (i % 2 ? 2.5 : -1);
    g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  g.fill();
  g.fillStyle = '#050407';
  g.beginPath();
  g.arc(32, 32, 10, 0, Math.PI * 2);
  g.fill();
  holeTex = new THREE.CanvasTexture(c);
  holeTex.colorSpace = THREE.SRGBColorSpace;
  return holeTex;
}
const HOLE_GEO = new THREE.PlaneGeometry(1, 1);

export class Effects {
  /** @param opts.holeSec 총알 자국이 남는 시간, opts.holeMax 동시에 남는 최대 개수 (balance.gun) */
  constructor(scene, { holeSec = 5, holeMax = 60 } = {}) {
    this.scene = scene;
    this.items = [];
    this.holeSec = holeSec;
    this.holeMax = holeMax;
    this.holes = 0;
  }

  /**
   * 총알 궤적. follow 가 있으면 사라질 때까지 매 프레임 시작점을 다시 받는다
   * (내 총: 화면을 빨리 돌려도 선이 항상 지금 총구에서 나가게).
   */
  tracer(a, b, color = 0xffd27a, follow = null) {
    const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
    // 내 총(follow): 카메라에서 멀수록 굵게 → 화면에서는 처음부터 끝까지 같은 굵기 (총구 앞이 뭉툭하게 커지지 않음)
    // 남의 총: 일정한 굵기 (멀리서 보므로)
    let geo = TRACER_GEO;
    if (follow) {
      const near = 0.55, far = near + a.distanceTo(b);
      geo = new THREE.CylinderGeometry(far, near, 1, 6, 1, true); // 위(+Y)=끝점, 아래=총구
    }
    const core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xfff4d0, opacity: 1, ...add }));
    const glow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, opacity: 0.45, ...add }));
    const [rc, rg] = follow ? [0.0055, 0.016] : [0.03, 0.08];
    core.scale.set(rc, 1, rc);
    glow.scale.set(rg, 1, rg);
    const g = new THREE.Group();
    g.add(glow, core);
    g.renderOrder = 5;
    const it = { obj: g, life: 0.09, max: 0.09, kind: 'tracer', a: a.clone(), b: b.clone(), follow, mats: [core.material, glow.material], geo: geo === TRACER_GEO ? null : geo };
    this.placeTracer(it);
    this.scene.add(g);
    this.items.push(it);
  }

  placeTracer(it) {
    if (it.follow) it.a.copy(it.follow());
    const d = new THREE.Vector3().subVectors(it.b, it.a);
    const len = d.length();
    if (len < 1e-4) return;
    it.obj.position.copy(it.a).addScaledVector(d, 0.5);
    it.obj.quaternion.setFromUnitVectors(Y_AXIS, d.multiplyScalar(1 / len));
    it.obj.scale.set(1, len, 1);
  }

  // 벽·기둥·바닥·천장에 총알 자국 (holeSec 동안, 마지막 1초에 흐려짐)
  bulletHole(point, normal, kind) {
    if (this.holes >= this.holeMax) {
      const old = this.items.find((x) => x.kind === 'hole');
      if (old) old.life = Math.min(old.life, 0.001);
    }
    const mat = new THREE.MeshBasicMaterial({ map: bulletHoleTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const m = new THREE.Mesh(HOLE_GEO, mat);
    m.scale.setScalar(0.3 + Math.random() * 0.08);
    m.quaternion.setFromUnitVectors(Z_AXIS, normal);
    m.rotateZ(Math.random() * Math.PI * 2);
    // 기둥은 칸보다 얇게 그려져 있어서(칸의 84%) 그만큼 안쪽에
    const inset = kind === 'pillar' ? -0.16 : 0;
    m.position.copy(point).addScaledVector(normal, 0.012 + inset);
    this.scene.add(m);
    this.holes++;
    this.items.push({ obj: m, life: this.holeSec, max: this.holeSec, kind: 'hole', mats: [mat] });
  }

  // 총구에서 번쩍이는 불꽃 (별 모양 스프라이트 + 빛무리) — 사용자 IMG_1240 분위기
  muzzle(p, size = 0.6) {
    const sp = vfxSprite('vfx.muzzle', size);
    if (sp) {
      sp.position.copy(p);
      sp.material.rotation = Math.random() * Math.PI * 2;
      sp.renderOrder = 6;
      this.scene.add(sp);
      this.items.push({ obj: sp, life: 0.06, max: 0.06, kind: 'burst', from: 0.75, to: 1.35 });
    }
    const glow = vfxSprite('vfx.spark', size * 0.8);
    if (glow) {
      glow.position.copy(p);
      glow.renderOrder = 5;
      this.scene.add(glow);
      this.items.push({ obj: glow, life: 0.08, max: 0.08, kind: 'burst', from: 0.9, to: 1.8 });
    }
  }

  spark(p, color = 0xffffff) {
    const sp = vfxSprite('vfx.spark', 0.5);
    if (sp) {
      sp.position.copy(p);
      sp.material.rotation = Math.random() * Math.PI * 2;
      this.scene.add(sp);
      this.items.push({ obj: sp, life: 0.12, max: 0.12, kind: 'burst', from: 0.6, to: 1.4 });
      return;
    }
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color, transparent: true }));
    m.position.copy(p);
    this.scene.add(m);
    this.items.push({ obj: m, life: 0.12, max: 0.12, kind: 'grow' });
  }

  grenade(sx, sz, x, z, fuse) {
    const sp = vfxSprite('vfx.grenade', 0.55, { additive: false });
    if (sp) {
      this.scene.add(sp);
      this.items.push({ obj: sp, life: fuse, max: fuse, kind: 'arc', sx, sz, x, z, spin: true });
      return;
    }
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.18, 0.2),
      [0xf06a8a, 0xf06a8a, 0xffffff, 0xffffff, 0x3a7bd5, 0x3a7bd5].reduce((arr, c) => (arr.push(new THREE.MeshLambertMaterial({ color: c })), arr), []),
    );
    this.scene.add(m);
    this.items.push({ obj: m, life: fuse, max: fuse, kind: 'arc', sx, sz, x, z });
  }

  boom(x, z, r) {
    const burst = vfxSprite('vfx.eraser_boom', r * 1.6);
    if (burst) {
      burst.position.set(x, 1.2, z);
      this.scene.add(burst);
      this.items.push({ obj: burst, life: 0.55, max: 0.55, kind: 'burst', from: 0.5, to: 1.5 });
    }
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.2, r * 0.3, 48),
      new THREE.MeshBasicMaterial({ color: 0xfff6e8, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.3, z);
    this.scene.add(ring);
    this.items.push({ obj: ring, life: 0.5, max: 0.5, kind: 'ring', r });
    for (let i = 0; i < 26; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.15), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xf06a8a : 0xffffff, transparent: true }));
      c.position.set(x, 0.5, z);
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 6;
      this.scene.add(c);
      this.items.push({ obj: c, life: 0.8, max: 0.8, kind: 'debris', vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 3 + Math.random() * 4 });
    }
  }

  puff(x, z, big) {
    for (let i = 0; i < (big ? 30 : 14); i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.12 + Math.random() * 0.15, 6, 6), new THREE.MeshBasicMaterial({ color: 0xefe7d6, transparent: true }));
      c.position.set(x + (Math.random() - 0.5), 0.3, z + (Math.random() - 0.5));
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * (big ? 5 : 2.5);
      this.scene.add(c);
      this.items.push({ obj: c, life: 0.7, max: 0.7, kind: 'debris', vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 2 + Math.random() * 3, g: 2 });
    }
  }

  update(dt) {
    const keep = [];
    for (const it of this.items) {
      it.life -= dt;
      const k = 1 - it.life / it.max;
      const o = it.obj;
      if (it.life <= 0) {
        this.scene.remove(o);
        if (it.mats) {
          it.mats.forEach((m) => m.dispose()); // 공유 도형(궤적·자국)은 지우지 않음
          it.geo?.dispose();
        } else o.geometry?.dispose();
        if (it.kind === 'hole') this.holes--;
        continue;
      }
      if (it.kind === 'fade') o.material.opacity = 1 - k;
      else if (it.kind === 'tracer') {
        this.placeTracer(it);
        it.mats[0].opacity = 1 - k * k;
        it.mats[1].opacity = 0.45 * (1 - k);
      } else if (it.kind === 'hole') o.material.opacity = Math.min(1, it.life);
      else if (it.kind === 'grow') {
        o.scale.setScalar(1 + k * 3);
        o.material.opacity = 1 - k;
      } else if (it.kind === 'burst') {
        const sc = it.from + (it.to - it.from) * k;
        o.scale.set(o.userData.base.x * sc, o.userData.base.y * sc, 1);
        o.material.opacity = 1 - k * k;
      } else if (it.kind === 'arc') {
        o.position.set(it.sx + (it.x - it.sx) * k, 1.4 + Math.sin(k * Math.PI) * 3 - k * 1.2, it.sz + (it.z - it.sz) * k);
        if (it.spin) o.material.rotation += dt * 10;
        else o.rotation.x += dt * 12;
      } else if (it.kind === 'ring') {
        o.scale.setScalar(1 + k * 3.2);
        o.material.opacity = 1 - k;
      } else if (it.kind === 'debris') {
        it.vy -= (it.g ?? 12) * dt;
        o.position.x += it.vx * dt;
        o.position.y = Math.max(0.05, o.position.y + it.vy * dt);
        o.position.z += it.vz * dt;
        o.material.opacity = 1 - k;
      }
      keep.push(it);
    }
    this.items = keep;
  }
}
