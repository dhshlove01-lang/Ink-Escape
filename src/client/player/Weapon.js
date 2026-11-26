import * as THREE from 'three';
import { createViewModel } from '../render/AnimalModels.js';
import { texture } from '../render/Images.js';

// 공통 총 1종: 30발, 예비 탄약 무한, 재장전 1초. 발사 판정(히트스캔)은 주입된 raycast 가 한다.

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
    this.view.position.set(0.25, -0.23, -0.52);
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
    this.vmScene.updateMatrixWorld(true);
    const v = src.localToWorld(new THREE.Vector3(tip.x, tip.y, tip.z));
    this.flash.position.copy(this.view.worldToLocal(v));
    this.flash.position.z -= 0.04; // 총구 바로 앞
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
    this.view.position.set(0.25 + Math.cos(this.bobT * 0.5) * (moving ? 0.008 : 0), -0.23 + bob - dip, -0.52 + this.kick * 0.04);
    this.view.rotation.x = this.kick * 0.08 + dip * 0.8;
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
    // 총구(뷰모델 층 좌표 = 카메라 기준) → 전장 좌표
    this.placeFlash();
    const muzzle = new THREE.Vector3();
    this.flash.getWorldPosition(muzzle);
    this.camera.updateMatrixWorld();
    muzzle.applyMatrix4(this.camera.matrixWorld);
    this.onShot({ origin, muzzle, point: hit.point, monsterId: hit.monsterId });
  }

  dispose() {
    this.vmScene.remove(this.view);
  }
}
