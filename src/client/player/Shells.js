import * as THREE from 'three';
import { GUN_FEEL } from '../../config/gunfeel.js';

// 탄피 배출 (1인칭 내 화면에만): 총 오른쪽 배출구에서 튀어나와 빙글 돌며 떨어지고, 바닥에서 통통 튀다 사라진다.
// 전장 장면(scene)에 두어 바닥에 닿는다. 숫자는 config/gunfeel.js shells.

const rand = ([a, b]) => a + Math.random() * (b - a);

export class Shells {
  constructor({ scene, sfx, cfg = GUN_FEEL.shells }) {
    this.scene = scene;
    this.sfx = sfx;
    this.c = cfg;
    const s = cfg.size;
    // 5.56mm 탄피: 황동 원기둥 (위가 +y)
    this.geo = new THREE.CylinderGeometry(0.0048 * s, 0.0048 * s, 0.045 * s, 8);
    this.mat = new THREE.MeshLambertMaterial({ color: 0xc8902a, emissive: 0x4a2e08 }); // 황동 (어두운 장면에서도 금색이 보이게)
    this.items = [];
  }

  // camera: 플레이어 카메라 (배출구·방향을 카메라 기준으로)
  eject(camera) {
    const c = this.c;
    if (this.items.length >= c.max) this.remove(this.items.shift());
    const m = new THREE.Mesh(this.geo, this.mat);
    camera.updateMatrixWorld();
    m.position.set(...c.port).applyMatrix4(camera.matrixWorld);
    const vel = new THREE.Vector3(rand(c.speed.right), rand(c.speed.up), rand(c.speed.back)).applyQuaternion(camera.quaternion);
    m.rotation.set(Math.random() * 3, Math.random() * 3, Math.PI / 2);
    const spin = new THREE.Vector3(rand([-1, 1]), rand([-1, 1]), rand([-1, 1])).normalize().multiplyScalar(c.spin);
    this.scene.add(m);
    this.items.push({ m, vel, spin, life: c.life, clinked: false });
  }

  update(dt) {
    const c = this.c;
    const h = Math.min(dt, 1 / 30);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      if (it.life <= 0) {
        this.remove(it);
        this.items.splice(i, 1);
        continue;
      }
      it.vel.y -= 9.8 * h;
      it.m.position.addScaledVector(it.vel, h);
      it.m.rotation.x += it.spin.x * h;
      it.m.rotation.y += it.spin.y * h;
      it.m.rotation.z += it.spin.z * h;
      const floor = 0.012 * c.size;
      if (it.m.position.y < floor) {
        it.m.position.y = floor;
        if (it.vel.y < 0) {
          if (!it.clinked && it.vel.y < -1.2) {
            it.clinked = true;
            this.sfx?.play?.('shell');
          }
          it.vel.y = -it.vel.y * c.bounce; // 통통
          it.vel.x *= 0.6;
          it.vel.z *= 0.6;
          it.spin.multiplyScalar(0.5);
          if (Math.abs(it.vel.y) < 0.25) {
            it.vel.set(0, 0, 0);
            it.spin.set(0, 0, 0);
            it.m.rotation.x = Math.PI / 2; // 바닥에 눕는다
          }
        }
      }
      // 마지막 0.4초는 작아지며 사라짐
      it.m.scale.setScalar(Math.min(1, it.life / 0.4));
    }
  }

  remove(it) {
    this.scene.remove(it.m);
  }

  dispose() {
    for (const it of this.items) this.remove(it);
    this.items = [];
    this.geo.dispose();
    this.mat.dispose();
  }
}
