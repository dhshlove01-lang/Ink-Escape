import * as THREE from 'three';

// 일회성 연출: 총알 궤적, 지우개 수류탄, 폭발, 소환 연기.

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
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color, transparent: true }));
    m.position.copy(p);
    this.scene.add(m);
    this.items.push({ obj: m, life: 0.12, max: 0.12, kind: 'grow' });
  }

  grenade(sx, sz, x, z, fuse) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.18, 0.2),
      [0xf06a8a, 0xf06a8a, 0xffffff, 0xffffff, 0x3a7bd5, 0x3a7bd5].reduce((arr, c) => (arr.push(new THREE.MeshLambertMaterial({ color: c })), arr), []),
    );
    this.scene.add(m);
    this.items.push({ obj: m, life: fuse, max: fuse, kind: 'arc', sx, sz, x, z });
  }

  boom(x, z, r) {
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
      } else if (it.kind === 'arc') {
        o.position.set(it.sx + (it.x - it.sx) * k, 1.4 + Math.sin(k * Math.PI) * 3 - k * 1.2, it.sz + (it.z - it.sz) * k);
        o.rotation.x += dt * 12;
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
