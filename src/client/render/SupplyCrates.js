import * as THREE from 'three';
import { WALL_H } from '../../shared/map/GameMap.js';
import { canvasTex } from './DungeonKit.js';

// 보급 상자 3D: 나무 상자 + 빨간 잉크 표시 + 위로 솟는 빛기둥. 떨어지면서 쿵.
// 내가 이미 연 상자는 빛기둥을 끄고 어둡게 (남은 사람을 위해 상자는 그대로).

const SIZE = 1.1;

let shared = null;
function parts() {
  if (shared) return shared;
  const wood = canvasTex(128, (g, S) => {
    g.fillStyle = '#8a5a2e';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? '#7c4f27' : '#946336';
      g.fillRect(0, (i * S) / 4 + 2, S, S / 4 - 4);
      g.fillStyle = 'rgba(40,22,10,0.55)';
      g.fillRect(0, (i * S) / 4, S, 3);
    }
    g.strokeStyle = '#3b2412';
    g.lineWidth = 10;
    g.strokeRect(5, 5, S - 10, S - 10);
    g.beginPath(); // 대각 보강목
    g.moveTo(10, S - 10);
    g.lineTo(S - 10, 10);
    g.stroke();
    // 빨간 잉크 느낌표 표시
    g.fillStyle = '#d8283f';
    g.beginPath();
    g.arc(S / 2, S / 2, 26, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff3e0';
    g.fillRect(S / 2 - 5, S / 2 - 17, 10, 22);
    g.fillRect(S / 2 - 5, S / 2 + 9, 10, 8);
  });
  const beamTex = canvasTex(64, (g, S) => {
    const gr = g.createLinearGradient(0, S, 0, 0);
    gr.addColorStop(0, 'rgba(255,230,150,0.9)');
    gr.addColorStop(0.6, 'rgba(255,200,90,0.35)');
    gr.addColorStop(1, 'rgba(255,180,60,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
  });
  shared = {
    box: new THREE.BoxGeometry(SIZE, SIZE, SIZE),
    woodMat: new THREE.MeshLambertMaterial({ map: wood, emissive: 0x2a1406, emissiveIntensity: 0.6 }),
    beamGeo: new THREE.CylinderGeometry(0.75, 0.75, WALL_H - 0.3, 20, 1, true),
    beamTex,
  };
  return shared;
}

export class SupplyCrates {
  constructor({ scene, session, sfx }) {
    this.scene = scene;
    this.session = session;
    this.sfx = sfx;
    this.items = new Map(); // id → { group, crate, beam, ring, born }
  }

  sync(time) {
    const S = this.session;
    for (const [id, c] of S.crates) {
      if (!this.items.has(id)) this.items.set(id, this.make(c, time));
    }
    for (const [id, it] of this.items) {
      if (S.crates.has(id)) continue;
      this.scene.remove(it.group);
      it.beam.material.dispose();
      it.ring.material.dispose();
      this.items.delete(id);
    }
  }

  make(c, time) {
    const p = parts();
    const group = new THREE.Group();
    group.position.set(c.x, 0, c.z);
    const crate = new THREE.Mesh(p.box, p.woodMat);
    crate.position.y = SIZE / 2;
    const beam = new THREE.Mesh(p.beamGeo, new THREE.MeshBasicMaterial({ map: p.beamTex, color: 0xffd27a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = (WALL_H - 0.3) / 2;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    group.add(crate, beam, ring);
    this.scene.add(group);
    return { group, crate, beam, ring, born: time, landed: false };
  }

  update(time) {
    this.sync(time);
    const me = this.session.me;
    for (const [id, it] of this.items) {
      const c = this.session.crates.get(id);
      const k = Math.min(1, (time - it.born) / 0.7); // 떨어지기 0.7초
      const fall = 1 - k * k;
      it.crate.position.y = SIZE / 2 + fall * 6 + (k >= 1 ? Math.abs(Math.sin((time - it.born - 0.7) * 6)) * 0.15 * Math.max(0, 1 - (time - it.born - 0.7) * 2) : 0);
      it.crate.rotation.y = Math.sin(time * 0.6 + id) * 0.25;
      if (k >= 1 && !it.landed) {
        it.landed = true;
        this.sfx?.play?.('crate');
      }
      const mine = c?.opened.has(me);
      it.beam.visible = !mine;
      it.ring.visible = !mine;
      it.crate.material = parts().woodMat;
      it.crate.scale.setScalar(mine ? 0.85 : 1);
      it.beam.material.opacity = 0.4 + Math.sin(time * 3 + id) * 0.15;
      it.ring.scale.setScalar(1 + ((time * 0.8 + id) % 1) * 0.6);
      it.ring.material.opacity = 0.7 * (1 - ((time * 0.8 + id) % 1));
    }
  }

  dispose() {
    for (const it of this.items.values()) this.scene.remove(it.group);
    this.items.clear();
  }
}
