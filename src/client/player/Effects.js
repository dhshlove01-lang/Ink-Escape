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

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }

  tracer(a, b, color = 0xffd27a) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.items.push({ obj: line, life: 0.07, max: 0.07, kind: 'fade' });
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
        o.geometry?.dispose();
        continue;
      }
      if (it.kind === 'fade') o.material.opacity = 1 - k;
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
