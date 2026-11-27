import * as THREE from 'three';
import { createViewModel } from '../render/AnimalModels.js';
import { texture } from '../render/Images.js';
import { fireRate, reloadSec } from '../../shared/augmentMath.js';
import { KickSpring } from './GunFeel.js';

// 공통 총 1종: 30발, 예비 탄약 무한, 재장전 1초. 발사 판정(히트스캔)은 주입된 raycast 가 한다.

const VIEW_POS = [0.25, -0.23, -0.52]; // 손·총 위치 (카메라 기준)
const AIM_DIST = 15; // 총신이 화면 가운데 이 거리(m)의 점을 겨눈다


// 총구 번쩍임 크기 배율 (2026-11-27 사용자 지시: 반으로)
const FLASH_SCALE = 0.5;
export class Weapon {
  // spread(): 지금 탄 퍼짐(라디안, 크로스헤어 블룸) · onFire(): 한 발 쏜 직후 (반동·FOV·블룸·탄피 — GunFeel)
  constructor({ balance, camera, animal, raycast, onShot, sfx, getAug = () => ({}), spread = () => 0.006, onFire = () => {} }) {
    this.b = balance;
    this.g = balance.gun;
    this.getAug = getAug; // 내 보급 증강 (빠른 앞발: 연사·재장전)
    this.camera = camera;
    this.raycast = raycast;
    this.onShot = onShot;
    this.sfx = sfx;
    this.ammo = this.g.mag;
    this.reloadUntil = 0;
    this.cooldown = 0;
    this.trigger = false;
    this.kick = 0; // 0~1, 레드도트 밝기용
    this.kickSpring = new KickSpring(); // 총기 킥백 (config/gunfeel.js kick)
    this.spread = spread;
    this.onFire = onFire;
    this.bobT = 0;

    // 손·총은 따로 장면(뷰모델 층)에 두고 전장을 다 그린 뒤 맨 위에 그린다 (PlayerView.render).
    // 이 카메라는 원점에서 -Z 를 보므로, 여기 좌표 = 플레이어 카메라 기준 좌표.
    this.vmScene = new THREE.Scene();
    this.vmCam = new THREE.PerspectiveCamera(camera.fov, camera.aspect, 0.01, 10);
    // 뷰모델 전용 조명 (전장 조명과 무관 — 손·총만 밝힌다)
    this.vmScene.add(new THREE.AmbientLight(0xffe9d6, 2.1));
    const key = new THREE.DirectionalLight(0xfff1de, 3.1);
    key.position.set(-0.5, 1.1, 1.4);
    this.vmScene.add(key);
    const rim = new THREE.DirectionalLight(0x9fd0ff, 1.1);
    rim.position.set(0.9, 0.2, -1);
    this.vmScene.add(rim);
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
    // 총구 불꽃: 별 모양(사용자 이미지) + 노란 빛무리 두 겹 — IMG_1240 처럼 선명하게
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthTest: false, transparent: true }));
    this.flash.scale.set(0.34, 0.34, 1);
    this.flash.position.set(0.02, 0.015, -0.48);
    this.flash.renderOrder = 11;
    this.flash.visible = false;
    this.view.add(this.flash);
    const halo = document.createElement('canvas');
    halo.width = halo.height = 128;
    const hg = halo.getContext('2d');
    const hgrad = hg.createRadialGradient(64, 64, 0, 64, 64, 64);
    hgrad.addColorStop(0, 'rgba(255,246,200,0.95)');
    hgrad.addColorStop(0.28, 'rgba(255,190,70,0.55)');
    hgrad.addColorStop(1, 'rgba(255,120,0,0)');
    hg.fillStyle = hgrad;
    hg.fillRect(0, 0, 128, 128);
    this.flashHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(halo), blending: THREE.AdditiveBlending, depthTest: false, transparent: true }));
    this.flashHalo.scale.set(0.62, 0.62, 1);
    this.flashHalo.renderOrder = 10;
    this.flashHalo.visible = false;
    this.view.add(this.flashHalo);
    this.flashT = 0;

    // 레드도트 사이트의 빨간 점 (살짝 숨쉬듯 밝아진다)
    const sight = this.view.userData.sight;
    const dotCanvas = document.createElement('canvas');
    dotCanvas.width = dotCanvas.height = 64;
    const dg = dotCanvas.getContext('2d');
    const dgrad = dg.createRadialGradient(32, 32, 0, 32, 32, 32);
    dgrad.addColorStop(0, 'rgba(255,255,255,1)');
    dgrad.addColorStop(0.16, 'rgba(255,90,90,1)');
    dgrad.addColorStop(0.34, 'rgba(235,25,45,0.75)');
    dgrad.addColorStop(1, 'rgba(200,10,30,0)');
    dg.fillStyle = dgrad;
    dg.fillRect(0, 0, 64, 64);
    this.sightDot = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(dotCanvas), blending: THREE.AdditiveBlending, depthTest: false, transparent: true }));
    this.sightDot.scale.set(0.012, 0.012, 1);
    this.sightDot.renderOrder = 12;
    if (sight) this.sightDot.position.set(sight.x, sight.y, sight.z);
    this.view.add(this.sightDot);
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
    this.flashHalo.position.copy(this.flash.position);
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
      // 손·레드도트 사이트도 총과 같이 돌린다 (총을 쥔 자리 유지)
      const brothers = [...(this.view.userData.paws || [])];
      if (this.view.userData.sightObj) brothers.push(this.view.userData.sightObj);
      if (this.sightDot) brothers.push(this.sightDot);
      for (const o of brothers) o.position.sub(m).applyQuaternion(q).add(m);
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
    this.reloadUntil = now + reloadSec(this.b, this.getAug());
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
        this.cooldown = 1 / fireRate(this.b, this.getAug());
        this.ammo--;
        this.fire();
        if (this.ammo === 0) this.reload(now);
      }
    }
    // 화면 흔들림·반동·재장전 연출
    this.kick = Math.max(0, this.kick - dt * 10);
    this.kickSpring.update(dt);
    const kp = this.kickSpring.pos, kr = this.kickSpring.rot;
    if (moving) this.bobT += dt * 9;
    const bob = moving ? Math.sin(this.bobT) * 0.012 : 0;
    const dip = this.reloading ? Math.sin(((this.reloadUntil - now) / reloadSec(this.b, this.getAug())) * Math.PI) * 0.25 : 0;
    this.view.position.set(VIEW_POS[0] + Math.cos(this.bobT * 0.5) * (moving ? 0.008 : 0), VIEW_POS[1] + bob - dip + kp.y, VIEW_POS[2] + kp.z);
    this.view.rotation.set(kr.x + dip * 0.8, 0, kr.z); // 킥백: 뒤로·위로 밀리고 총구 들림·비틀림 → 스프링으로 복귀
    this.placeFlash();
    // 총구 불꽃은 한 번의 사격에 55ms 남짓, 그 사이 부풀었다 줄어든다
    this.flashT = Math.max(0, this.flashT - dt);
    const fk = this.flashT > 0 ? 1 - this.flashT / 0.055 : 1;
    this.flash.visible = this.flashT > 0;
    this.flashHalo.visible = this.flashT > 0;
    if (this.flash.visible) {
      const s = (0.26 + 0.3 * fk) * FLASH_SCALE;
      this.flash.scale.set(s, s, 1);
      const hs = (0.5 + 0.5 * fk) * FLASH_SCALE;
      this.flashHalo.scale.set(hs, hs, 1);
      this.flash.material.opacity = 1 - fk * 0.7;
      this.flashHalo.material.opacity = (1 - fk) * 0.9;
    }
    if (this.sightDot) this.sightDot.material.opacity = 0.72 + Math.sin(now * 2.2) * 0.12 + this.kick * 0.3;
  }

  fire() {
    this.kick = 1;
    this.kickSpring.fire();
    this.flashT = 0.055;
    this.flash.material.rotation = Math.random() * Math.PI * 2;
    this.sfx.play('shot');
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    this.camera.getWorldDirection(dir);
    // 탄 퍼짐: 크로스헤어가 벌어진 만큼(원뿔 안 무작위). 이번 발의 반동·블룸은 쏜 뒤에 더해진다
    const a = this.spread() * Math.sqrt(Math.random()), t = Math.random() * Math.PI * 2;
    const right = new THREE.Vector3().crossVectors(dir, this.camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    dir.addScaledVector(right, Math.cos(t) * Math.tan(a)).addScaledVector(up, Math.sin(t) * Math.tan(a)).normalize();
    const hit = this.raycast(origin, dir, this.g.range);
    this.onShot({ origin, muzzle: this.muzzleWorld(), point: hit.point, monsterId: hit.monsterId, monsterIds: hit.monsterIds });
    this.onFire();
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
