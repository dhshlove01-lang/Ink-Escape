// 1인칭 이동: 마우스 시점, WASD, Shift 달리기, Space 점프, 벽 충돌.

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
    this.vy = 0;
    this.onGround = true;
    this.keys = new Set();
    this.enabled = true;
    this.sensitivity = 0.0022;
    this.moving = false;
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
    const speed = (k.has('ShiftLeft') || k.has('ShiftRight') ? this.b.run : this.b.walk) * (1 - slow);
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
    if (this.enabled && k.has('Space') && this.onGround) {
      this.vy = this.b.jumpV;
      this.onGround = false;
    }
    this.vy -= this.b.gravity * dt;
    this.y += this.vy * dt;
    if (this.y <= 0) {
      this.y = 0;
      this.vy = 0;
      this.onGround = true;
    }
    this.applyCamera();
  }

  applyCamera() {
    this.camera.position.set(this.x, this.y + this.b.eye, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
