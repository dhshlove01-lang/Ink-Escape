import { GUN_FEEL } from '../../config/gunfeel.js';

// 총 타격감 조각들 (three 없이 순수 계산 — 테스트 가능). 각자 따로 쓸 수 있게 작게 나눴다 (SRP). 숫자는 config/gunfeel.js · balance.js gun.recoil/spread.
// 원칙: 빠르게 튀고(Fast In: 발사 순간 값을 바로 넣음) 천천히 돌아온다(Slow Out: 스프링·지수 감쇠).

const DEG = Math.PI / 180;
const rand = (a, b) => a + Math.random() * (b - a);

// 1. 총기 킥백: 1인칭 총(손)의 위치·회전 오프셋. 감쇠 스프링으로 쫀득하게 원위치.
export class KickSpring {
  constructor(cfg = GUN_FEEL.kick) {
    this.c = cfg;
    const v3 = () => ({ x: 0, y: 0, z: 0 });
    this.pos = v3(); // 카메라 기준 (+z = 뒤)
    this.rot = v3(); // x = 총구 들림, z = 비틀림
    this.vPos = v3();
    this.vRot = v3();
  }

  fire() {
    const c = this.c;
    // 즉시 밀림 (속도가 아니라 위치를 바로) — 연사로 너무 쌓이지 않게 한 발의 maxStack 배까지
    this.pos.z = Math.min(this.pos.z + c.back, c.back * c.maxStack);
    this.pos.y = Math.min(this.pos.y + c.up, c.up * c.maxStack);
    this.rot.x = Math.min(this.rot.x + c.pitchDeg * DEG, c.pitchDeg * DEG * c.maxStack);
    this.rot.z += rand(-c.rollDeg, c.rollDeg) * DEG;
  }

  update(dt) {
    const { stiffness: k, damping: d } = this.c;
    const h = Math.min(dt, 1 / 30);
    for (const [x, v] of [[this.pos, this.vPos], [this.rot, this.vRot]]) {
      // v += (-k·x - d·v)·dt ; x += v·dt  (반암시적 오일러 — 안정적)
      v.x += (-k * x.x - d * v.x) * h;
      v.y += (-k * x.y - d * v.y) * h;
      v.z += (-k * x.z - d * v.z) * h;
      x.x += v.x * h;
      x.y += v.y * h;
      x.z += v.z * h;
    }
  }
}

// 2. 카메라 반동 (실제 조준이 움직임 — 약하게): 발사마다 위로 쌓이고, 멈추면 원래 조준으로 돌아옴
export class CameraRecoil {
  constructor(recoil) {
    this.r = recoil; // balance.gun.recoil
    this.pitch = 0; // 라디안 (FpsController 가 시점에 더한다)
    this.yaw = 0;
    this.since = 99;
  }

  fire() {
    const r = this.r;
    this.pitch = Math.min(this.pitch + r.pitchDeg * DEG, r.maxDeg * DEG);
    this.yaw += rand(-r.yawDeg, r.yawDeg) * DEG;
    this.since = 0;
  }

  update(dt) {
    this.since += dt;
    if (this.since < this.r.recoverDelay) return;
    const k = 1 - Math.exp(-this.r.recoverSpeed * dt); // 지수 감쇠 = 천천히 내려앉음
    this.pitch -= this.pitch * k;
    this.yaw -= this.yaw * k;
  }
}

// 2. FOV 펀치: +deg 바로 넓혔다가 backSec 안에 부드럽게 원래대로
export class FovPunch {
  constructor(camera, cfg = GUN_FEEL.fovPunch) {
    this.cam = camera;
    this.c = cfg;
    this.base = camera.fov;
    this.v = 0;
  }

  fire() {
    this.v = this.c.deg;
  }

  update(dt) {
    if (!this.v && this.cam.fov === this.base) return;
    this.v *= Math.exp((-dt * 4.6) / this.c.backSec); // backSec 뒤 약 1%
    if (this.v < 0.01) this.v = 0;
    this.cam.fov = this.base + this.v;
    this.cam.updateProjectionMatrix();
  }
}

// 4. 크로스헤어 블룸 (px): 쏠 때마다 벌어지고, 이동·달리기·점프면 더, 멈추면 Lerp 로 수축
export class CrosshairBloom {
  constructor(cfg = GUN_FEEL.crosshair) {
    this.c = cfg;
    this.px = cfg.base;
    this.since = 99;
  }

  fire() {
    this.px = Math.min(this.c.max, this.px + this.c.perShot);
    this.since = 0;
  }

  update(dt, { moving = false, running = false, airborne = false } = {}) {
    const c = this.c;
    this.since += dt;
    const target = Math.min(c.max, c.base + (airborne ? c.air : running ? c.run : moving ? c.walk : 0));
    if (this.px < target) this.px += (target - this.px) * Math.min(1, c.lerp * dt); // 움직이기 시작하면 벌어짐
    else if (this.since > c.holdSec) this.px += (target - this.px) * Math.min(1, c.lerp * dt);
  }

  // 화면에서 px 만큼 벌어진 크로스헤어에 해당하는 각도(라디안) × spread 비율 = 실제 탄 퍼짐
  spreadRad(camera, viewportH, ratio) {
    const half = Math.tan((camera.fov * DEG) / 2);
    return Math.atan((this.px / (viewportH / 2)) * half) * ratio;
  }
}
