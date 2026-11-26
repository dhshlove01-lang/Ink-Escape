import * as THREE from 'three';
import { Emitter } from '../Emitter.js';
import { WALL_H } from '../../shared/map/GameMap.js';
import { PSTATE, STATUS_BIT } from '../../shared/protocol.js';
import { WorldRenderer, SILENT } from '../render/WorldRenderer.js';
import { gfx } from '../render/GraphicsSettings.js';

// 술래 왼쪽 화면의 3D 무대. 두 가지 모드:
//   'top'    = 던전 전체를 위에서 비스듬히 내려다보는 실시간 3D 탑뷰 (IMPORTANT: 소환 위치 고르기)
//   playerId = 그 플레이어 머리 위·뒤에서 따라가는 카메라 (기존 구석 카메라 기능)
// 바닥을 클릭·드래그하면 소환 위치를 고른다 ('pick' 이벤트, 2D 탑뷰와 같은 형식).
// 천장은 레이어 1 이라 여기(레이어 0)에서는 보이지 않는다.

const TOP_PITCH = 0.76; // 지평선 기준 약 43° — 벽 옆면이 크게 보여 3D 디오라마처럼 읽힌다
const TOP_DIST = 60;
const FOLLOW_HEIGHT = WALL_H + 6;
const FOLLOW_BACK = 5;
const RENDER_FPS = 40; // 술래는 천천히 봐도 되므로 3D 를 40fps 로만 그린다 (성능)

export class TaggerCam extends Emitter {
  constructor({ session, palette, attributes, balance }) {
    super();
    this.session = session;
    this.palette = palette;
    this.attributes = attributes;
    this.b = balance;
    this.mode = 'top';
    this.followId = null;
    this.target = null;
    this.hover = null;
    this.dragging = false;
    this.zoom = 0.82; // 1 = 맵 전체, 작을수록 확대 (마우스 휠)
    this.fitDist = 120;
    this.ready = false;
    this._acc = 0;
    this.root = document.createElement('div');
    this.root.className = 'stage3d';

    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    this.root.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.dragging = true;
      this.hover = this.pickFloor(e);
      try { this.root.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    });
    this.root.addEventListener('pointermove', (e) => {
      const w = this.pickFloor(e);
      this.hover = w;
      if (this.dragging && w) this.emit('hover', w);
    });
    this.root.addEventListener('pointerup', (e) => {
      if (e.button !== 0 || !this.dragging) return;
      this.dragging = false;
      const w = this.pickFloor(e) || this.hover;
      if (w) {
        this.target = w;
        this.emit('pick', w);
      }
    });
    this.root.addEventListener('pointerleave', () => (this.hover = null));
    this.root.addEventListener('wheel', (e) => {
      if (this.mode !== 'top') return;
      e.preventDefault();
      this.zoom = Math.max(0.42, Math.min(1, this.zoom + (e.deltaY > 0 ? 0.07 : -0.07)));
      this.applyTopDistance();
    }, { passive: false });
  }

  init() {
    if (this.ready) return;
    this.ready = true;
    this.renderer = new THREE.WebGLRenderer({ antialias: gfx.preset.antialias });
    this.renderer.setPixelRatio(gfx.pixelRatio(this.root.clientWidth || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.root.append(this.renderer.domElement);

    this.view3d = new WorldRenderer({ session: this.session, palette: this.palette, attributes: this.attributes, balance: this.b, sfx: SILENT, skipPlayerId: null });
    this.scene = this.view3d.scene;
    this.fog = this.scene.fog;

    // 위에서 비추는 빛 — 탑뷰에서 방 구조가 또렷하게 읽히도록 (이 화면에만)
    this.topLight = new THREE.DirectionalLight(0xe6ecff, 2.6);
    this.topLight.position.set(0.72, 0.62, 0.5); // 비스듬한 빛 → 벽 옆면이 밝고 반대쪽은 어둡게 (깊이)
    this.scene.add(this.topLight);
    this.topLight.target.position.set(0, 0, 0);
    this.scene.add(this.topLight.target);
    this.topFill = new THREE.DirectionalLight(0x7f6ec0, 0.8);
    this.topFill.position.set(-0.5, 0.4, -0.6);
    this.scene.add(this.topFill);
    this.topAmbient = new THREE.AmbientLight(0x8b80b0, 0.55);
    this.scene.add(this.topAmbient);

    const m = this.session.map;
    this.center = new THREE.Vector3(m.worldW / 2, 0, m.worldH / 2);
    this.topCam = new THREE.PerspectiveCamera(38, 1, 0.5, 400);
    this.topCam.position.set(
      this.center.x,
      TOP_DIST * Math.sin(TOP_PITCH),
      this.center.z + TOP_DIST * Math.cos(TOP_PITCH),
    );
    this.topCam.lookAt(this.center);
    this.topDir = new THREE.Vector3(0, Math.sin(TOP_PITCH), Math.cos(TOP_PITCH));

    this.followCam = new THREE.PerspectiveCamera(55, 1, 0.1, 220);
    this.camPos = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.snap = true;

    // 소환 위치 표시 (고른 자리 = 밝은 원, 마우스 위치 = 옅은 원)
    this.marker = this.makeRing(0.9, 1.4, 0x78ffa0, 0.95);
    this.markerFill = new THREE.Mesh(new THREE.CircleGeometry(1.15, 32), new THREE.MeshBasicMaterial({ color: 0x78ffa0, transparent: true, opacity: 0.16, depthWrite: false }));
    this.markerFill.rotation.x = -Math.PI / 2;
    this.scene.add(this.marker, this.markerFill);
    this.hoverRing = this.makeRing(0.9, 1.4, 0xffffff, 0.45);
    this.hoverRing.scale.setScalar(0.8);
    this.scene.add(this.hoverRing);

    // 플레이어 주변 소환 금지 원
    const r = this.b.spawn.minPlayerDist;
    this.noGeo = new THREE.RingGeometry(r - 0.22, r, 64);
    this.noMat = new THREE.MeshBasicMaterial({ color: 0xff3040, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    this.noRings = new Map();

    // 따라가는 플레이어 머리 위 화살표
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 4), new THREE.MeshBasicMaterial({ color: 0xffd34d }));
    this.arrow.rotation.x = Math.PI;
    this.scene.add(this.arrow);

    this.ray = new THREE.Raycaster();
    this.floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.buildContactShadows();
    this.applyMode();
    this.resize();
  }

  // 벽 밑 그림지 (탑뷰에서 벽이 바닥에서 솟은 것으로 보이게) — 바닥에 깔리는 그라데이션 판
  buildContactShadows() {
    const m = this.session.map;
    const CELL = 2;
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 64);
    grd.addColorStop(0, 'rgba(0,0,0,0.72)');
    grd.addColorStop(0.45, 'rgba(0,0,0,0.34)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 4, 64);
    const tex = new THREE.CanvasTexture(c);

    const jobs = [];
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        if (m.tile(x, y) !== 0) continue; // FLOOR
        const cx = (x + 0.5) * CELL, cz = (y + 0.5) * CELL;
        const solid = (dx, dy) => m.tile(x + dx, y + dy) !== 0;
        if (solid(0, -1)) jobs.push([cx, cz - CELL / 2 + 1.1, 0]);
        if (solid(0, 1)) jobs.push([cx, cz + CELL / 2 - 1.1, Math.PI]);
        if (solid(-1, 0)) jobs.push([cx - CELL / 2 + 1.1, cz, Math.PI / 2]);
        if (solid(1, 0)) jobs.push([cx + CELL / 2 - 1.1, cz, -Math.PI / 2]);
      }
    }
    if (!jobs.length) return;
    const geo = new THREE.PlaneGeometry(CELL * 1.04, 2.2);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false });
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -2;
    const inst = new THREE.InstancedMesh(geo, mat, jobs.length);
    const dummy = new THREE.Object3D();
    jobs.forEach(([x, z, ry], i) => {
      dummy.position.set(x, 0.03, z);
      dummy.rotation.set(0, ry, 0);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    this.scene.add(inst);
    this.shadows = inst;
  }

  makeRing(inner, outer, color, opacity) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    return ring;
  }

  get camera() {
    return this.mode === 'top' ? this.topCam : this.followCam;
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.followId = mode === 'top' ? null : mode;
    if (mode !== 'top') this.snap = true;
    if (this.ready) this.applyMode();
  }

  applyMode() {
    const top = this.mode === 'top';
    this.scene.fog = top ? null : this.fog; // 탑뷰는 카메라가 멀어서 안개에 다 잠긴다
    this.topLight.intensity = top ? 3.4 : 0.2;
    this.topFill.intensity = top ? 0.5 : 0.05;
    this.topAmbient.intensity = top ? 0.55 : 0.15;
    this.arrow.visible = !top;
    this.hoverRing.visible = false;
  }

  resize() {
    const w = this.root.clientWidth, h = this.root.clientHeight;
    if (!w || !h) return;
    if (w === this._cw && h === this._ch && gfx.level === this._lv) return;
    this._cw = w;
    this._ch = h;
    this._lv = gfx.level;
    this.renderer.setPixelRatio(gfx.pixelRatio(w));
    this.renderer.setSize(w, h);
    const aspect = w / h;
    this.followCam.aspect = aspect;
    this.followCam.updateProjectionMatrix();

    // 탑뷰: 원근 카메라를 비스듬히 두고, 맵 네 귀가 화면에 다 들어오는 거리를 찾는다
    this.topCam.aspect = aspect;
    this.topCam.updateProjectionMatrix();
    const m = this.session.map;
    const corners = [[0, 0], [m.worldW, 0], [0, m.worldH], [m.worldW, m.worldH]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    let lo = 8, hi = 420;
    for (let i = 0; i < 22; i++) {
      const d = (lo + hi) / 2;
      this.topCam.position.copy(this.center).addScaledVector(this.topDir, d);
      this.topCam.lookAt(this.center);
      this.topCam.updateMatrixWorld();
      let ok = true;
      for (const c of corners) {
        const p = c.clone().project(this.topCam);
        if (Math.abs(p.x) > 0.96 || Math.abs(p.y) > 0.99) { ok = false; break; }
      }
      if (ok) hi = d;
      else lo = d;
    }
    this.fitDist = hi;
    this.applyTopDistance();
  }

  // 탑뷰 거리 (휠 확대·축소)
  applyTopDistance() {
    if (!this.ready) return;
    this.topCam.position.copy(this.center).addScaledVector(this.topDir, this.fitDist * this.zoom * 0.99);
    this.topCam.lookAt(this.center);
    this.topCam.updateMatrixWorld();
  }

  pickFloor(e) {
    if (!this.ready) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return null;
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.floor, hit)) return null;
    const m = this.session.map;
    if (hit.x < 0 || hit.z < 0 || hit.x > m.worldW || hit.z > m.worldH) return null;
    return { x: hit.x, z: hit.z };
  }

  // 따라가는 플레이어의 머리 위·약간 뒤에서 내려다본다 (플레이어가 보는 방향 기준)
  followSpot(p) {
    const bx = Math.sin(p.yaw) * FOLLOW_BACK, bz = Math.cos(p.yaw) * FOLLOW_BACK;
    return new THREE.Vector3(p.x + bx, FOLLOW_HEIGHT, p.z + bz);
  }

  updateRings() {
    const live = new Set();
    for (const p of this.session.players()) {
      if (p.st !== PSTATE.ALIVE || p.bits & STATUS_BIT.AFK) continue;
      live.add(p.id);
      let ring = this.noRings.get(p.id);
      if (!ring) {
        ring = new THREE.Mesh(this.noGeo, this.noMat);
        ring.rotation.x = -Math.PI / 2;
        this.scene.add(ring);
        this.noRings.set(p.id, ring);
      }
      const pp = this.session.playerPos(p.id) || p;
      ring.position.set(pp.x, 0.06, pp.z);
    }
    for (const [id, ring] of this.noRings) {
      if (!live.has(id)) {
        this.scene.remove(ring);
        this.noRings.delete(id);
      }
    }
  }

  render(dt, time, target, targetValid) {
    this.init();
    this.resize();
    const top = this.mode === 'top';
    if (!top) {
      const p = this.followId && this.session.playerPos(this.followId);
      if (p) {
        const want = this.followSpot(p);
        const look = new THREE.Vector3(p.x, 0.8, p.z);
        if (this.snap) {
          this.camPos.copy(want);
          this.lookAt.copy(look);
          this.snap = false;
        } else {
          this.camPos.lerp(want, 1 - Math.exp(-dt * 2.5));
          this.lookAt.lerp(look, 1 - Math.exp(-dt * 6));
        }
        this.followCam.position.copy(this.camPos);
        this.followCam.lookAt(this.lookAt);
        this.arrow.position.set(p.x, 2.6 + Math.sin(time * 4) * 0.2, p.z);
        this.arrow.rotation.y = time * 2;
      }
    }

    this.marker.visible = this.markerFill.visible = !!target;
    if (target) {
      const color = targetValid ? 0x78ffa0 : 0xff5050;
      this.marker.position.set(target.x, 0.07, target.z);
      this.marker.material.color.set(color);
      this.markerFill.position.set(target.x, 0.04, target.z);
      this.markerFill.material.color.set(color);
      this.marker.scale.setScalar(1 + Math.sin(time * 4) * 0.06);
    }
    if (this.hover && !this.dragging) {
      this.hoverRing.visible = true;
      this.hoverRing.position.set(this.hover.x, 0.05, this.hover.z);
      this.hoverRing.material.color.set(this.hoverValid ? 0xffffff : 0xff8080);
    } else {
      this.hoverRing.visible = false;
    }
    this.updateRings();

    // 40fps 로만 그린다 (플레이어 화면과 동시에 돌아도 부담 없게)
    this._acc += dt;
    if (this._acc < 1 / RENDER_FPS) return;
    this._acc = 0;
    this.view3d.update(dt, time, this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (!this.ready) return;
    this.view3d.dispose();
    this.renderer.dispose();
    this.root.remove();
  }
}
