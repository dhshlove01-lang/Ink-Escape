// 1인칭 이동: 마우스 시점, WASD, Shift 달리기(기력 소모), Space 점프, 벽 충돌.

export class FpsController {
  constructor({ camera, dom, map, balance }) {
    this.camera = camera;
    this.dom = dom;
    this.map = map;
    this.b = balance.player;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.recoil = null; // { pitch, yaw } 총 반동 (GunFeel.CameraRecoil) — 시점에 더한다
    this.vy = 0;
    this.onGround = true;
    this.keys = new Set();
    this.enabled = true;
    this.sensitivity = 0.0022;
    this.moving = false;
    this.stamina = 1; // 달리기 기력 (0~1)
    this.exhausted = false; // 바닥난 뒤 restart 만큼 찰 때까지 못 달림
    this.running = false;
    this._restAt = 0;
    this.moveMult = 1; // 보급 증강 (날쌘 발)
    this.maxJumps = 1; // 2 = 2단 점프
    this.jumpsLeft = 0;
    this._space = false;
    camera.rotation.order = 'YXZ';

    this._onKey = (e) => {
      if (e.type === 'keydown') this.keys.add(e.code);
      else this.keys.delete(e.code);
    };
    this._onMouse = (e) => {
      if (!this.locked || !this.enabled) return;
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    };
    this._onBlur = () => this.keys.clear();
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup', this._onKey);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('mousemove', this._onMouse);
  }

  get locked() {
    return document.pointerLockElement === this.dom;
  }

  lock() {
    try {
      const r = this.dom.requestPointerLock?.();
      if (r && r.catch) r.catch(() => {});
    } catch {}
  }

  dispose() {
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('keyup', this._onKey);
    window.removeEventListener('blur', this._onBlur);
    document.removeEventListener('mousemove', this._onMouse);
    if (this.locked) document.exitPointerLock?.();
  }

  setPosition(x, z) {
    this.x = x;
    this.z = z;
    this.y = 0;
    this.vy = 0;
  }

  update(dt, { slow = 0 } = {}) {
    const k = this.keys;
    let fx = 0, fz = 0;
    if (this.enabled) {
      if (k.has('KeyW')) fz -= 1;
      if (k.has('KeyS')) fz += 1;
      if (k.has('KeyA')) fx -= 1;
      if (k.has('KeyD')) fx += 1;
    }
    const len = Math.hypot(fx, fz);
    this.moving = len > 0;
    this.updateStamina(dt, this.moving && (k.has('ShiftLeft') || k.has('ShiftRight')));
    const speed = (this.running ? this.b.run : this.b.walk) * this.moveMult * (1 - slow);
    if (len > 0) {
      fx /= len;
      fz /= len;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const wx = fx * cos + fz * sin;
      const wz = -fx * sin + fz * cos;
      const p = this.map.collideCircle(this.x + wx * speed * dt, this.z + wz * speed * dt, this.b.radius);
      this.x = p.x;
      this.z = p.z;
    } else {
      const p = this.map.collideCircle(this.x, this.z, this.b.radius);
      this.x = p.x;
      this.z = p.z;
    }
    // 점프: 누른 순간에만. 땅에서 한 번 + (2단 점프면) 공중에서 한 번 더
    const space = this.enabled && k.has('Space');
    if (space && !this._space && (this.onGround || this.jumpsLeft > 0)) {
      if (!this.onGround) this.jumpsLeft--;
      else this.jumpsLeft = this.maxJumps - 1;
      this.vy = this.b.jumpV;
      this.onGround = false;
    }
    this._space = space;
    this.vy -= this.b.gravity * dt;
    this.y += this.vy * dt;
    if (this.y <= 0) {
      this.y = 0;
      this.vy = 0;
      this.onGround = true;
    }
    this.applyCamera();
  }

  // 달리면 기력이 줄고, 멈추면 잠시 뒤 회복. 바닥나면 조금 찰 때까지 걷기만.
  updateStamina(dt, wantRun) {
    const st = this.b.stamina;
    this._t = (this._t || 0) + dt;
    if (this.exhausted && this.stamina >= st.restart) this.exhausted = false;
    this.running = wantRun && !this.exhausted && this.stamina > 0;
    if (this.running) {
      this.stamina = Math.max(0, this.stamina - dt / st.sec);
      this._restAt = this._t + st.regenDelay;
      if (this.stamina <= 0) this.exhausted = true;
    } else if (this._t >= this._restAt) {
      this.stamina = Math.min(1, this.stamina + dt / st.refillSec);
    }
  }

  applyCamera() {
    this.camera.position.set(this.x, this.y + this.b.eye, this.z);
    const rp = this.recoil?.pitch || 0, ry = this.recoil?.yaw || 0;
    this.camera.rotation.set(Math.min(1.5, this.pitch + rp), this.yaw + ry, 0);
  }
}
