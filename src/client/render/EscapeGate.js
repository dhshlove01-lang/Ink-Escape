import * as THREE from 'three';
import { CELL, WALL_H } from '../../shared/map/GameMap.js';
import { crayonGlowTexture, glowTexture } from './DungeonKit.js';

// 탈출문: 석재 아치 + 철창문(양문) + X자 사슬 4가닥 + 빛나는 자물쇠.
// 열림 연출: 자물쇠 번쩍 → 걸쇠 풀리고 떨어짐 → 사슬 늘어지며 떨어짐 → 철창문이 안쪽으로 열리며 탈출구 빛.
// 서버 판정(EscapeSystem/map.openDoor)은 건드리지 않는다 — 이 클래스는 보이는 것만 담당.

const UP = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const GRAVITY = 16;
const SWING_START = 0.85;
const SWING_TIME = 2.0;
const TOTAL = SWING_START + SWING_TIME + 0.1;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// 문 너머에서 쏟아지는 빛: 가운데는 밝고 가장자리는 부드러운 창문 모양
function doorwayTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const v = g.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(255,236,186,0.12)');
  v.addColorStop(0.28, 'rgba(255,232,180,0.8)');
  v.addColorStop(0.62, 'rgba(255,247,220,1)');
  v.addColorStop(1, 'rgba(255,224,158,0.35)');
  g.fillStyle = v;
  g.fillRect(0, 0, 256, 256);
  g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0, 0, 256, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)');
  h.addColorStop(0.2, 'rgba(0,0,0,1)');
  h.addColorStop(0.8, 'rgba(0,0,0,1)');
  h.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = h;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 사슬 한 가닥: 두 점 사이에 링크를 늘어놓고, 늘어짐(sag)·낙하(drop)를 매 프레임 다시 계산한다.
class ChainStrand {
  constructor(geo, mat, a, b, count) {
    this.a = a.clone();
    this.b = b.clone();
    this.n = count;
    this.mat = mat;
    this.sag = 0.08;
    this.drop = 0;
    this.spin = 0;
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3(1, 1, 1);
    this.update();
  }

  update() {
    const pts = [];
    for (let i = 0; i < this.n; i++) {
      const u = i / (this.n - 1);
      const p = new THREE.Vector3().lerpVectors(this.a, this.b, u);
      p.y -= this.sag * Math.sin(Math.PI * u);
      if (this.drop > 0) {
        p.y -= this.drop * (0.45 + 0.55 * u) - this.drop * this.drop * 0.03;
        p.z += Math.sin(u * 9 + this.spin) * this.drop * 0.05;
      }
      pts.push(p);
    }
    const t = new THREE.Vector3();
    const perp = new THREE.Vector3();
    const q2 = new THREE.Quaternion();
    for (let i = 0; i < this.n; i++) {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(this.n - 1, i + 1)];
      t.copy(next).sub(prev);
      if (t.lengthSq() < 1e-8) t.set(0, -1, 0);
      t.normalize();
      if (i % 2 === 0) perp.copy(t).cross(UP);
      else perp.copy(t).cross(new THREE.Vector3().copy(t).cross(UP));
      if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0);
      perp.normalize();
      this._q.setFromUnitVectors(Z_AXIS, perp);
      q2.setFromAxisAngle(t, this.spin * 0.5);
      this._q.multiply(q2);
      this._m.compose(pts[i], this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  fade(o) {
    this.mat.opacity = o;
    this.mat.transparent = o < 1;
  }
}

export class EscapeGate {
  constructor({ door, kit, glowTex }) {
    this.kit = kit;
    this.door = door;
    this.group = new THREE.Group();
    this.state = 'closed';
    this.t = 0;
    this.time = 0;

    const xs = door.cells.map((c) => c[0]);
    const ys = door.cells.map((c) => c[1]);
    const minX = Math.min(...xs) * CELL, maxX = (Math.max(...xs) + 1) * CELL;
    const minZ = Math.min(...ys) * CELL, maxZ = (Math.max(...ys) + 1) * CELL;
    const horizontal = door.dir.z !== 0;
    const w = horizontal ? maxX - minX : maxZ - minZ;
    const depth = horizontal ? maxZ - minZ : maxX - minX;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const face = horizontal ? (door.dir.z < 0 ? maxZ : minZ) : door.dir.x < 0 ? maxX : minX;

    this.w = w;
    this.hw = w / 2;
    this.depth = depth;
    this.group.position.set(horizontal ? cx : face, 0, horizontal ? face : cz);
    this.group.rotation.y = horizontal
      ? door.dir.z < 0 ? 0 : Math.PI
      : door.dir.x < 0 ? Math.PI / 2 : -Math.PI / 2;

    this.buildArch();
    this.buildLeaves();
    this.buildLock();
    this.buildChains();
    this.buildEscapeLight(glowTex);
  }

  // 석재 아치 프레임 + 좌우 기둥 + 배너
  buildArch() {
    const { mats } = this.kit;
    const hw = this.hw;
    const r = hw + 0.42;
    const spring = 3.55;
    const m = new THREE.MeshLambertMaterial({ map: mats.stone.map, color: 0xcfc3e2 });

    // 좌우 기둥 (문틀)
    for (const s of [-1, 1]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(1.05, spring + 0.4, 0.72), m);
      jamb.position.set(s * (hw + 0.5), (spring + 0.4) / 2, 0.1);
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.55, 0.95), mats.stoneTop);
      base.position.set(s * (hw + 0.5), 0.27, 0.12);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.34, 0.9), mats.stoneTop);
      cap.position.set(s * (hw + 0.5), spring + 0.3, 0.12);
      this.group.add(jamb, base, cap);
    }

    // 아치 쐐기돌
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n * Math.PI;
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.62, 0.78), m);
      block.position.set(Math.cos(a) * r, spring + Math.sin(a) * r, 0.1);
      block.rotation.z = a - Math.PI / 2;
      this.group.add(block);
    }
    // 아치 윗면 띠 (벽 높이를 넘지 않게)
    const bandY = Math.min(WALL_H - 0.25, spring + r + 0.28);
    const band = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 1.5, 0.3, 0.8), mats.trim);
    band.position.set(0, bandY, 0.08);
    this.group.add(band);

    // 통로 끝 벽 (문 너머가 허공으로 뚫려 보이지 않게)
    const back = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 2.4, WALL_H, 0.6), mats.stoneDark);
    back.position.set(0, WALL_H / 2, -this.depth - 0.25);
    this.group.add(back);

    // 문 옆 배너 (술래 탑뷰 참고 이미지의 보라 깃발) — 문틀 기둥(hw+1.15 까지) 바깥에 걸어 가려지지 않게
    const cloth = new THREE.PlaneGeometry(1.1, 2.1);
    const bx = hw + 2.05;
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(cloth, mats.cloth);
      b.position.set(s * bx, 3.4, 0.05);
      this.group.add(b);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.35, 6), mats.ironWarm);
      rod.rotation.z = Math.PI / 2;
      rod.position.set(s * bx, 4.45, 0.05);
      this.group.add(rod);
    }
  }

  // 철창문 두 짝 (경첩이 문틀에 붙어 안쪽으로 열린다)
  buildLeaves() {
    const { mats } = this.kit;
    const hw = this.hw;
    const H = 5.35;
    const barGeo = new THREE.BoxGeometry(0.13, H, 0.13);
    const spikeGeo = new THREE.ConeGeometry(0.11, 0.32, 4);
    const barMat = new THREE.MeshLambertMaterial({ color: 0x4c465c, emissive: 0x2a1218, emissiveIntensity: 1 });
    const edgeMat = new THREE.MeshLambertMaterial({ color: 0x241f2c, emissive: 0x1a0a10, emissiveIntensity: 1 });
    this.leaves = [];
    for (const side of [-1, 1]) {
      const leaf = new THREE.Group();
      leaf.position.set(side * hw, 0, -0.18);
      const n = 6;
      for (let i = 0; i < n; i++) {
        const x = side * (0.28 + (i / (n - 1)) * (hw - 0.38));
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.set(x, H / 2, 0);
        leaf.add(bar);
        const spike = new THREE.Mesh(spikeGeo, edgeMat);
        spike.position.set(x, H + 0.1, 0);
        spike.rotation.x = Math.PI;
        leaf.add(spike);
      }
      for (const y of [0.55, 2.5, 4.75]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(hw - 0.1, 0.17, 0.2), edgeMat);
        beam.position.set(side * (hw / 2), y, 0);
        leaf.add(beam);
      }
      // 대각 보강재
      const brace = new THREE.Mesh(new THREE.BoxGeometry(hw * 1.15, 0.12, 0.14), edgeMat);
      brace.position.set(side * (hw / 2), 2.9, 0.02);
      brace.rotation.z = side * 0.5;
      leaf.add(brace);
      this.group.add(leaf);
      this.leaves.push({ group: leaf, side });
    }
  }

  // 중앙 자물쇠 (어두운 쇠 + 붉게 타오르는 크레용 테두리)
  buildLock() {
    this.lockGroup = new THREE.Group();
    this.lockGroup.position.set(0, 2.75, 0.6);
    this.lockGroup.rotation.z = 0.05;

    this.lockBodyMat = new THREE.MeshLambertMaterial({ color: 0x1e060b, emissive: 0xff1a2a, emissiveIntensity: 0.12 });
    this.lockEdgeMat = new THREE.LineBasicMaterial({ color: 0xff5c6c, transparent: true, opacity: 1 });
    this.faceMat = new THREE.MeshLambertMaterial({ color: 0x2c0b12, emissive: 0xe8101e, emissiveIntensity: 0.05 });

    const bodyGeo = new THREE.BoxGeometry(1.3, 1.02, 0.36);
    this.lockBody = new THREE.Mesh(bodyGeo, this.lockBodyMat);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeo), this.lockEdgeMat);
    edges.scale.set(1.02, 1.02, 1.02);
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.72, 0.4), this.faceMat);
    face.position.z = 0.01;
    // 모서리 리벳 (붉게 빛나는 못)
    const rivetGeo = new THREE.SphereGeometry(0.055, 6, 5);
    const rivetMat = new THREE.MeshBasicMaterial({ color: 0xff5a68 });
    for (const [rx, ry] of [[-0.5, 0.34], [0.5, 0.34], [-0.5, -0.34], [0.5, -0.34]]) {
      const rivet = new THREE.Mesh(rivetGeo, rivetMat);
      rivet.position.set(rx, ry, 0.2);
      this.lockGroup.add(rivet);
    }
    this.lockGroup.add(this.lockBody, edges, face);

    // 걸쇠 (반원) — 몸통 위로 크게
    this.shackle = new THREE.Group();
    this.shackleMat = new THREE.MeshLambertMaterial({ color: 0x3a2028, emissive: 0xff2c3c, emissiveIntensity: 0.35 });
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.1, 6, 16, Math.PI), this.shackleMat);
    arc.position.y = 0.5;
    const leg = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8);
    const l1 = new THREE.Mesh(leg, this.shackleMat);
    l1.position.set(-0.4, 0.36, 0);
    const l2 = new THREE.Mesh(leg, this.shackleMat);
    l2.position.set(0.4, 0.42, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.02, 4, 20, Math.PI), this.lockEdgeMat);
    ring.position.y = 0.5;
    this.shackle.add(arc, l1, l2, ring);
    this.lockGroup.add(this.shackle);

    // 열쇠 구멍: 앞면 위로 튀어나온 쇠판 + 한 덩어리 열쇠 구멍 모양 (면이 겹치면 깜빡여 깨져 보였다)
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.04, 20), new THREE.MeshBasicMaterial({ color: 0xffb3bb }));
    plate.rotation.x = Math.PI / 2;
    plate.position.set(0, -0.1, 0.23); // 앞면(z=0.21)보다 앞
    const key = new THREE.Shape();
    key.absarc(0, 0.05, 0.085, -Math.PI * 0.3, Math.PI * 1.3, false); // 둥근 윗부분
    key.lineTo(-0.065, -0.17); // 아래로 넓어지는 홈
    key.lineTo(0.065, -0.17);
    key.closePath();
    const hole = new THREE.Mesh(new THREE.ShapeGeometry(key, 12), new THREE.MeshBasicMaterial({ color: 0x0d0205 }));
    hole.position.set(0, -0.08, 0.252); // 쇠판 앞면(0.25)보다 살짝 앞
    this.lockGroup.add(plate, hole);

    // 크레용 광채 (자물쇠 뒤)
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({
      map: crayonGlowTexture('255,40,56'),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.6,
    }));
    this.aura.scale.set(4.4, 4.4, 1);
    this.aura.position.set(0, 0.15, -0.25);
    this.lockGroup.add(this.aura);

    // 실제 빛은 SceneBuilder 가 하나만 만들어 이 자리로 옮겨 단다 (조명 개수 고정)
    this.lockLevel = 7;
    this.lockAnchor = new THREE.Object3D();
    this.lockAnchor.position.set(0, 2.9, 1.4);
    this.group.add(this.lockAnchor);
    this.group.add(this.lockGroup);
  }

  // X자 사슬 4가닥
  buildChains() {
    const { geos, mats } = this.kit;
    const hw = this.hw;
    const defs = [
      { a: [-hw + 0.3, 5.0, 0.34], b: [hw - 0.3, 0.95, 0.34], n: 34 },
      { a: [hw - 0.3, 5.0, 0.34], b: [-hw + 0.3, 0.95, 0.34], n: 34 },
      { a: [-hw + 0.3, 4.15, 0.55], b: [hw - 0.3, 1.6, 0.55], n: 26 },
      { a: [hw - 0.3, 4.15, 0.55], b: [-hw + 0.3, 1.6, 0.55], n: 26 },
    ];
    this.chains = defs.map((d) => {
      const mat = new THREE.MeshLambertMaterial({ color: 0x2a2430, transparent: true, opacity: 1 });
      const c = new ChainStrand(geos.chain, mat, new THREE.Vector3(...d.a), new THREE.Vector3(...d.b), d.n);
      this.group.add(c.mesh);
      return { strand: c, mat, ...d };
    });
    // 사슬 끝 고리 (문틀에 붙은 쇠고리)
    const ringGeo = new THREE.TorusGeometry(0.17, 0.05, 5, 10);
    for (const d of defs) {
      for (const p of [d.a, d.b]) {
        const r = new THREE.Mesh(ringGeo, mats.ironWarm);
        r.position.set(p[0], p[1], p[2]);
        this.group.add(r);
      }
    }
  }

  // 문 너머의 밝은 탈출구 빛
  buildEscapeLight(tex) {
    const hw = this.hw;
    this.exitGlowMat = new THREE.SpriteMaterial({
      map: doorwayTexture(),
      color: 0xfff0c0,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.28,
    });
    this.exitGlow = new THREE.Sprite(this.exitGlowMat);
    this.exitGlow.scale.set(hw * 1.85, 6.2, 1);
    this.exitGlow.position.set(0, 2.95, -this.depth * 0.62);
    this.group.add(this.exitGlow);

    // 문 안쪽 바닥에서 새어 나오는 빛
    this.exitFloorMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, this.depth * 1.2), this.exitFloorMat);
    fl.rotation.x = -Math.PI / 2;
    fl.position.set(0, 0.03, -this.depth * 0.4);
    this.group.add(fl);
    this.exitFloor = fl;

    this.exitLevel = 0;
    this.exitAnchor = new THREE.Object3D();
    this.exitAnchor.position.set(0, 2.6, -this.depth * 0.5);
    this.group.add(this.exitAnchor);
  }

  lockPos(target = new THREE.Vector3()) {
    return this.lockAnchor.getWorldPosition(target);
  }

  exitPos(target = new THREE.Vector3()) {
    return this.exitAnchor.getWorldPosition(target);
  }

  // 문 위치 강조 (탈출구 공개): 자물쇠가 더 붉게 맥동
  reveal() {
    this.revealed = true;
    this.exitGlowMat.opacity = 0.38;
    this.exitFloorMat.opacity = 0.1;
    this.exitLevel = 8;
  }

  open(instant = false) {
    if (this.state === 'open' || this.state === 'opening') return;
    if (instant) {
      this.state = 'open';
      this.applyOpenEnd();
      return;
    }
    this.state = 'opening';
    this.t = 0;
    this._last = null;
  }

  applyOpenEnd() {
    this.leaves?.forEach((l) => { l.group.rotation.y = l.side * (Math.PI / 2 - 0.04); });
    this.chains?.forEach((c) => { c.strand.mesh.visible = false; });
    this.lockGroup.visible = false;
    this.lockLevel = 0;
    this.exitGlowMat.opacity = 0.82;
    this.exitFloorMat.opacity = 0.3;
    this.exitLevel = 40;
  }

  update(dt, time = 0) {
    this.time = time;
    // 닫힌 상태: 자물쇠가 천천히 맥동
    if (this.state === 'closed') {
      const p = 0.82 + Math.sin(time * 2.2) * 0.14 + (this.revealed ? Math.sin(time * 7.5) * 0.12 : 0);
      this.lockBodyMat.emissiveIntensity = 0.12 * p;
      this.faceMat.emissiveIntensity = 0.05 * p;
      this.lockLevel = (this.revealed ? 12 : 6.5) * p;
      this.aura.material.opacity = 0.5 * p;
      this.aura.scale.setScalar(4.1 + p * 0.5);
      this.lockGroup.position.y = 2.75 + Math.sin(time * 1.6) * 0.02;
      return;
    }
    if (this.state === 'open') return;

    this.t += dt;
    const t = this.t;

    // 1) 번쩍 + 문이 덜컹거림
    if (t < 0.5) {
      const k = t / 0.5;
      this.lockBodyMat.emissiveIntensity = 0.16 + 2.6 * (1 - k) ** 2;
      this.faceMat.emissiveIntensity = 0.08 + 1.8 * (1 - k) ** 2;
      this.lockLevel = 7 + 46 * (1 - k) ** 2;
      this.aura.material.opacity = 0.6 + 0.4 * (1 - k);
      this.aura.scale.setScalar(4.2 + 2.6 * (1 - k));
      const shake = 0.035 * (1 - k);
      this.lockGroup.position.x = Math.sin(t * 70) * shake;
      this.group.position.y = Math.sin(t * 55) * shake * 0.4;
      this.leaves.forEach((l) => { l.group.rotation.y = l.side * 0.01 * (1 - k) * Math.sin(t * 60); });
    }
    // 2) 걸쇠가 튀어나가고 자물쇠가 떨어진다
    if (t >= 0.5 && this.lockGroup.visible) {
      const tau = t - 0.5;
      this.lockBodyMat.emissiveIntensity = Math.max(0.08, 2.7 - tau * 3);
      this.faceMat.emissiveIntensity = Math.max(0.04, 1.9 - tau * 2);
      this.lockLevel = Math.max(0, 46 - tau * 60);
      this.aura.material.opacity = Math.max(0, 1.0 - tau * 1.4);
      this.shackle.position.y = Math.min(1.5, tau * 7);
      this.shackle.rotation.z = tau * 3;
      this.lockGroup.position.y = 2.75 - 0.5 * GRAVITY * tau * tau;
      this.lockGroup.rotation.z = 0.05 + tau * 2.2;
      this.lockGroup.position.z = 0.6 + tau * 0.5;
      const o = Math.max(0, 1 - tau / 1.1);
      this.lockBodyMat.transparent = o < 1;
      this.lockBodyMat.opacity = o;
      this.faceMat.transparent = o < 1;
      this.faceMat.opacity = o;
      this.shackleMat.transparent = o < 1;
      this.shackleMat.opacity = o;
      this.lockEdgeMat.opacity = o;
      if (tau > 1.15) this.lockGroup.visible = false;
      this.group.position.y = 0;
    }
    // 3) 사슬: 팽팽 → 늘어짐 → 낙하
    if (t >= 0.45) {
      const tau = t - 0.45;
      for (let i = 0; i < this.chains.length; i++) {
        const c = this.chains[i];
        const lag = i * 0.06;
        const k = Math.max(0, Math.min(1, (tau - lag) / 0.55));
        c.strand.sag = 0.08 + 1.15 * easeInOut(k);
        if (tau - lag > 0.62) {
          const td = tau - lag - 0.62;
          c.strand.drop = 0.4 * GRAVITY * td * td * 0.5 + td * 0.6;
          c.strand.spin = td * 3.2;
          c.strand.fade(Math.max(0, 1 - td / 0.9));
          if (td > 1.0) c.strand.mesh.visible = false;
        }
        c.strand.update();
      }
    }
    // 4) 철창문이 안쪽으로 열린다
    if (t >= SWING_START) {
      const k = Math.min(1, (t - SWING_START) / SWING_TIME);
      const a = easeInOut(k) * (Math.PI / 2 - 0.04);
      this.leaves.forEach((l) => { l.group.rotation.y = l.side * a; });
      // 탈출구 빛
      this.exitGlowMat.opacity = 0.28 + 0.54 * Math.min(1, (t - SWING_START + 0.25) / 1.5);
      this.exitFloorMat.opacity = 0.05 + 0.3 * Math.min(1, k * 1.4);
      this.exitLevel = 40 * Math.min(1, (t - SWING_START + 0.2) / 1.4);
    }
    if (t >= TOTAL) {
      this.state = 'open';
      this.applyOpenEnd();
    }
  }
}
