import * as THREE from 'three';
import { createViewModel } from '../render/AnimalModels.js';
import { texture } from '../render/Images.js';

// 공통 총 1종: 30발, 예비 탄약 무한, 재장전 1초. 발사 판정(히트스캔)은 주입된 raycast 가 한다.

const VIEW_POS = [0.25, -0.23, -0.52]; // 손·총 위치 (카메라 기준)
const AIM_DIST = 15; // 총신이 화면 가운데 이 거리(m)의 점을 겨눈다

export class Weapon {
  constructor({ balance, camera, animal, raycast, onShot, sfx }) {
    this.g = balance.gun;
    this.camera = camera;
    this.raycast = raycast;
    this.onShot = onShot;
    this.sfx = sfx;
    this.ammo = this.g.mag;
    this.reloadUntil = 0;
    this.cooldown = 0;
    this.trigger = false;
    this.kick = 0;
    this.bobT = 0;

    // 손·총은 따로 장면(뷰모델 층)에 두고 전장을 다 그린 뒤 맨 위에 그린다 (PlayerView.render).
    // 이 카메라는 원점에서 -Z 를 보므로, 여기 좌표 = 플레이어 카메라 기준 좌표.
    this.vmScene = new THREE.Scene();
    this.vmCam = new THREE.PerspectiveCamera(camera.fov, camera.aspect, 0.01, 10);
    this.view = createViewModel(animal);
    this.view.position.set(...VIEW_POS);
    this.view.scale.setScalar(0.85);
    this.vmScene.add(this.view);
    const flashTex = texture('vfx.muzzle') || (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,250,210,1)');
      grad.addColorStop(0.4, 'rgba(255,190,80,0.9)');
      grad.addColorStop(1, 'rgba(255,120,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthTest: false, transparent: true }));
    this.flash.scale.set(0.25, 0.25, 1);
    this.flash.position.set(0.02, 0.015, -0.48);
    this.flash.renderOrder = 11;
    this.flash.visible = false;
    this.view.add(this.flash);
  }

  // 총 모델의 실제 총구 끝에 불꽃을 둔다 (모델이 늦게 바뀌어도 매 프레임 따라감)
  placeFlash() {
    const src = this.view.userData.gun?.children[0];
    const tip = src?.userData?.tip;
    if (!tip) return;
    if (src !== this._aimed) this.aimGun(src, tip);
    this.vmScene.updateMatrixWorld(true);
    const v = src.localToWorld(new THREE.Vector3(tip.x, tip.y, tip.z));
    this.flash.position.copy(this.view.worldToLocal(v));
    this.flash.position.z -= 0.04; // 총구 바로 앞
  }

  // 총을 조준점 쪽으로 돌린다: 총의 긴 축(꼭짓점 주성분)이 총구에서 화면 가운데 먼 점(AIM_DIST)을 향하게.
  // (GLB 원본이 비스듬해서 총신과 총알 선이 어긋나 보였다 — 모델이 바뀌면 자동으로 다시 맞춤)
  aimGun(src, tip) {
    this._aimed = src;
    const gun = this.view.userData.gun;
    const savePos = this.view.position.clone(), saveRot = this.view.rotation.clone();
    this.view.position.set(...VIEW_POS);
    this.view.rotation.set(0, 0, 0);
    this.vmScene.updateMatrixWorld(true);
    const pts = [];
    const v = new THREE.Vector3();
    src.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 3000));
      for (let i = 0; i < pos.count; i += step) pts.push(this.view.worldToLocal(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone()));
    });
    if (pts.length > 10) {
      const m = new THREE.Vector3();
      pts.forEach((q) => m.add(q));
      m.multiplyScalar(1 / pts.length);
      const c = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (const q of pts) {
        const d = [q.x - m.x, q.y - m.y, q.z - m.z];
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c[i * 3 + j] += d[i] * d[j];
      }
      let axis = new THREE.Vector3(0, 0, -1);
      for (let k = 0; k < 40; k++) axis.set(c[0] * axis.x + c[1] * axis.y + c[2] * axis.z, c[3] * axis.x + c[4] * axis.y + c[5] * axis.z, c[6] * axis.x + c[7] * axis.y + c[8] * axis.z).normalize();
      const tipL = this.view.worldToLocal(src.localToWorld(new THREE.Vector3(tip.x, tip.y, tip.z)));
      if (axis.dot(tipL.clone().sub(m)) < 0) axis.negate(); // 총구 쪽을 향하게
      const aim = this.view.worldToLocal(new THREE.Vector3(0, 0, -AIM_DIST)).sub(tipL).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(axis, aim);
      // 총 중심을 축으로 돌려 손 위치가 크게 안 바뀌게
      gun.position.sub(m).applyQuaternion(q).add(m);
      gun.quaternion.premultiply(q);
      // 손도 총과 같이 돌린다 (총을 쥔 자리 유지)
      for (const paw of this.view.userData.paws || []) paw.position.sub(m).applyQuaternion(q).add(m);
    }
    this.view.position.copy(savePos);
    this.view.rotation.copy(saveRot);
    this.vmScene.updateMatrixWorld(true);
  }

  resize(aspect) {
    this.vmCam.aspect = aspect;
    this.vmCam.updateProjectionMatrix();
  }

  get reloading() {
    return this.reloadUntil > 0;
  }

  reload(now) {
    if (this.reloading || this.ammo === this.g.mag) return;
    this.reloadUntil = now + this.g.reloadSec;
    this.sfx.play('reload');
  }

  update(dt, now, { canFire, moving }) {
    if (this.reloading && now >= this.reloadUntil) {
      this.reloadUntil = 0;
      this.ammo = this.g.mag;
    }
    this.cooldown -= dt;
    if (this.trigger && canFire && !this.reloading && this.cooldown <= 0) {
      if (this.ammo <= 0) {
        this.reload(now);
      } else {
        this.cooldown = 1 / this.g.rps;
        this.ammo--;
        this.fire();
        if (this.ammo === 0) this.reload(now);
      }
    }
    // 화면 흔들림·반동·재장전 연출
    this.kick = Math.max(0, this.kick - dt * 10);
    if (moving) this.bobT += dt * 9;
    const bob = moving ? Math.sin(this.bobT) * 0.012 : 0;
    const dip = this.reloading ? Math.sin(((this.reloadUntil - now) / this.g.reloadSec) * Math.PI) * 0.25 : 0;
    this.view.position.set(VIEW_POS[0] + Math.cos(this.bobT * 0.5) * (moving ? 0.008 : 0), VIEW_POS[1] + bob - dip, VIEW_POS[2] + this.kick * 0.06);
    this.view.rotation.x = this.kick * 0.03 + dip * 0.8; // 반동은 주로 뒤로 (위로 많이 들리면 총알이 총구보다 아래로 나가 보임)
    this.placeFlash();
    this.flash.visible = this.kick > 0.75;
  }

  fire() {
    this.kick = 1;
    this.sfx.play('shot');
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    this.camera.getWorldDirection(dir);
    // 아주 약간 퍼짐
    dir.x += (Math.random() - 0.5) * 0.012;
    dir.y += (Math.random() - 0.5) * 0.012;
    dir.normalize();
    const hit = this.raycast(origin, dir, this.g.range);
    this.onShot({ origin, muzzle: this.muzzleWorld(), point: hit.point, monsterId: hit.monsterId, follow: () => this.muzzleWorld() });
  }

  // 지금 총구 끝의 전장 좌표 (뷰모델 층 좌표 = 카메라 기준 → 카메라 행렬로 변환)
  muzzleWorld() {
    this.placeFlash();
    const muzzle = new THREE.Vector3();
    this.flash.getWorldPosition(muzzle);
    this.camera.updateMatrixWorld();
    return muzzle.applyMatrix4(this.camera.matrixWorld);
  }

  dispose() {
    this.vmScene.remove(this.view);
  }
}
