import * as THREE from 'three';
import { Emitter } from '../Emitter.js';
import { WALL_H } from '../../shared/map/GameMap.js';
import { PSTATE, STATUS_BIT } from '../../shared/protocol.js';
import { WorldRenderer, SILENT } from '../render/WorldRenderer.js';

// 술래 왼쪽 화면의 3D 구석 카메라: 따라갈 플레이어가 있는 방의 "가장 먼 구석 위"에서 실제 전장을 내려다본다.
// 바닥을 클릭하면 소환 위치를 고른다 ('pick' 이벤트, 탑뷰와 같은 형식).
// 처음 켤 때 만든다 (술래가 탑뷰만 쓰면 3D 를 그리지 않음).

const CAM_HEIGHT = WALL_H + 4;
const CORNER_INSET = 1.2;

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
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.root.append(this.renderer.domElement);
    this.view3d = new WorldRenderer({ session: this.session, palette: this.palette, attributes: this.attributes, sfx: SILENT, skipPlayerId: null });
    this.scene = this.view3d.scene;
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 220);
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

  // 따라갈 플레이어가 있는 방에서, 그 플레이어와 가장 먼 구석 위
  cornerFor(p) {
    const room = this.session.map.roomAt(p.x, p.z);
    const xs = [room.x0 + CORNER_INSET, room.x1 - CORNER_INSET];
    const zs = [room.z0 + CORNER_INSET, room.z1 - CORNER_INSET];
    let best = null, bd = -1;
    for (const x of xs) for (const z of zs) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d > bd) {
        bd = d;
        best = new THREE.Vector3(x, CAM_HEIGHT, z);
      }
    }
    return best;
  }

  resize() {
    const w = this.root.clientWidth, h = this.root.clientHeight;
    if (!w || !h) return;
    if (w !== this._w || h !== this._h) {
      this._w = w;
      this._h = h;
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
      const want = this.cornerFor(p);
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
    }
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
