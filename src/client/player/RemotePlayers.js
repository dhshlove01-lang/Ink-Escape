import * as THREE from 'three';
import { PSTATE, STATUS_BIT } from '../../shared/protocol.js';
import { createAnimalModel, ANIMAL_LOOK } from '../render/AnimalModels.js';

// 다른 플레이어(동물)와 시체 표시.

function nameSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.font = '30px "Jua","Malgun Gothic",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(0,0,0,0.8)';
  g.strokeText(text, 128, 32);
  g.fillStyle = color;
  g.fillText(text, 128, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(1.6, 0.4, 1);
  return s;
}

export class RemotePlayers {
  // skipId: 그리지 않을 플레이어 (1인칭의 내 몸). 술래 카메라는 null → 모두 그림
  constructor({ scene, session, skipId = null }) {
    this.scene = scene;
    this.session = session;
    this.items = new Map();
    for (const p of session.roster.players) {
      if (p.id === skipId) continue;
      const model = createAnimalModel(p.animal);
      const tag = nameSprite(p.name, ANIMAL_LOOK[p.animal]?.label || '#fff');
      tag.position.y = 1.85;
      model.add(tag);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.1, 32),
        new THREE.MeshBasicMaterial({ color: 0xff4050, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.visible = false;
      scene.add(model, ring);
      this.items.set(p.id, { model, ring, tag, lastX: 0, lastZ: 0, t: Math.random() * 5 });
    }
  }

  update(dt, time) {
    for (const [id, it] of this.items) {
      const p = this.session.playerPos(id);
      if (!p) continue;
      const m = it.model;
      m.visible = p.st === PSTATE.ALIVE || p.st === PSTATE.DEAD;
      it.ring.visible = p.st === PSTATE.DEAD && p.revIn >= 0;
      if (!m.visible) continue;
      m.position.set(p.x, p.y, p.z);
      if (p.st === PSTATE.DEAD) {
        m.rotation.set(0, p.yaw, Math.PI / 2);
        m.position.y = 0.55;
        it.ring.position.set(p.x, 0.05, p.z);
        const ready = p.revIn === 0;
        it.ring.material.color.set(ready ? 0x5dff9a : 0xff4050);
        it.ring.material.opacity = ready ? 0.6 + Math.sin(time * 6) * 0.3 : 0.5;
        it.tag.visible = false;
        continue;
      }
      it.tag.visible = !(p.bits & STATUS_BIT.AFK);
      const moved = Math.hypot(p.x - it.lastX, p.z - it.lastZ) / Math.max(dt, 1e-3);
      it.lastX = p.x;
      it.lastZ = p.z;
      it.t += dt * (moved > 0.5 ? 10 : 2);
      // 2026-11-27: 애니메이션이 있는 GLB 캐릭터는 달리기/걷기 클립 + 총 든 자세를 rig 가 맡는다.
      // (그전에는 몸 전체를 흔드는 방식이라 그냥 달리는 것처럼 보였다)
      const rig = m.userData.rig;
      if (rig) {
        rig.update(dt, moved);
        m.rotation.set(0, p.yaw, 0);
        m.position.y = p.y;
      } else {
        m.rotation.set(0, p.yaw, moved > 0.5 ? Math.sin(it.t) * 0.12 : 0);
        m.position.y = p.y + (moved > 0.5 ? Math.abs(Math.sin(it.t)) * 0.08 : 0);
      }
      m.visible = !(p.bits & STATUS_BIT.INVULN) || Math.floor(time * 10) % 2 === 0;
    }
  }

  // 부활 가능한 시체 (가장 가까운 것 찾기용)
  corpses() {
    const out = [];
    for (const id of this.items.keys()) {
      const p = this.session.latest?._p.get(id);
      if (p && p.st === PSTATE.DEAD && p.revIn >= 0) out.push({ id, x: p.x, z: p.z, revIn: p.revIn, prog: p.prog });
    }
    return out;
  }

  get(id) {
    return this.items.get(id);
  }
}
