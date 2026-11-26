import * as THREE from 'three';
import { Emitter } from '../Emitter.js';
import { WALL_H } from '../../shared/map/GameMap.js';
import { PSTATE, STATUS_BIT } from '../../shared/protocol.js';
import { WorldRenderer, SILENT } from '../render/WorldRenderer.js';
import { gfx } from '../render/GraphicsSettings.js';

// 술래 왼쪽 화면의 3D 따라가기 카메라: 고른 플레이어의 머리 위·뒤에서 실제 전장을 내려다보며 따라간다.
// 바닥을 클릭하면 소환 위치를 고른다 ('pick' 이벤트, 탑뷰와 같은 형식).
// 처음 켤 때 만든다 (술래가 탑뷰만 쓰면 3D 를 그리지 않음).

const CAM_HEIGHT = WALL_H + 6; // 벽 위에서 내려다본다 (천장은 플레이어 화면에만 있어서 안 가림)
const FOLLOW_BACK = 5; // 플레이어 뒤로 이만큼

export class CornerCam extends Emitter {
  constructor({ session, palette, attributes, balance }) {
    super();
    this.session = session;
    this.palette = palette;
    this.attributes = attributes;
    this.b = balance;
    this.followId = null;
    this.ready = false;
    this.root = document.createElement('div');
    this.root.className = 'cornercam';
  }

  init() {
    if (this.ready) return;
    this.ready = true;
    this.renderer = new THREE.WebGLRenderer({ antialias: gfx.preset.antialias });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.root.append(this.renderer.domElement);
    this.view3d = new WorldRenderer({ session: this.session, palette: this.palette, attributes: this.attributes, balance: this.b, sfx: SILENT, skipPlayerId: null });
    this.scene = this.view3d.scene;
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 220);
    this.camPos = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.snap = true;

    // 소환 위치 표시 + 플레이어 주변 소환 금지 원
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.4, 32), new THREE.MeshBasicMaterial({ color: 0x78ffa0, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    this.scene.add(this.marker);
    const r = this.b.spawn.minPlayerDist;
    this.noGeo = new THREE.RingGeometry(r - 0.25, r, 64);
    this.noMat = new THREE.MeshBasicMaterial({ color: 0xff3040, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
    this.noRings = new Map();

    // 따라가는 플레이어 머리 위 화살표
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 4), new THREE.MeshBasicMaterial({ color: 0xffd34d }));
    this.arrow.rotation.x = Math.PI;
    this.scene.add(this.arrow);

    this.ray = new THREE.Raycaster();
    this.floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      const w = this.pickFloor(e);
      if (w) this.emit('pick', w);
    });
  }

  setFollow(id) {
    if (id !== this.followId) this.snap = true;
    this.followId = id;
  }

  pickFloor(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
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
    const bx = Math.sin(p.yaw) * FOLLOW_BACK, bz = Math.cos(p.yaw) * FOLLOW_BACK; // 앞이 (-sin, -cos) 이므로 뒤는 (+sin, +cos)
    return new THREE.Vector3(p.x + bx, CAM_HEIGHT, p.z + bz);
  }

  resize() {
    const w = this.root.clientWidth, h = this.root.clientHeight;
    if (!w || !h) return;
    if (w !== this._cw || h !== this._ch || gfx.level !== this._lv) {
      this._cw = w;
      this._ch = h;
      this._lv = gfx.level;
      this.renderer.setPixelRatio(gfx.pixelRatio(w));
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
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
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.lookAt);
      this.arrow.visible = true;
      this.arrow.position.set(p.x, 2.6 + Math.sin(time * 4) * 0.2, p.z);
      this.arrow.rotation.y = time * 2;
    } else if (this.arrow) this.arrow.visible = false;
    this.marker.visible = !!target;
    if (target) {
      this.marker.position.set(target.x, 0.08, target.z);
      this.marker.material.color.set(targetValid ? 0x78ffa0 : 0xff5050);
    }
    this.updateRings();
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
