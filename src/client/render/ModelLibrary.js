import * as THREE from 'three';
import { GLTFLoader } from '../../../vendor/addons/loaders/GLTFLoader.js';
import { PROCEDURAL_MODELS } from './models/index.js';

// GLB 모델 불러오기·보정·복제. 못 불러오면 null 을 주고, 쓰는 쪽은 임시 모델로 대체한다.
// procedural(코드 모델)은 복제하지 않고 쓸 때마다 새로 만든다 (뼈대가 있는 SkinnedMesh 는 clone 하면 깨진다).
// 불러오기가 늦게 끝나면 onReady 로 바꿔 끼울 수 있다.

export class ModelLibrary {
  constructor(defs) {
    this.defs = defs;
    this.models = new Map();
    this.waiters = new Map();
    this.factories = new Map(); // 코드 모델: 이름 → 보정까지 한 새 모델을 돌려주는 함수
    this.loader = new GLTFLoader();
  }

  loadAll() {
    return Promise.allSettled(Object.keys(this.defs).map((name) => this.load(name)));
  }

  async load(name) {
    const def = this.defs[name];
    try {
      if (def.procedural) {
        const make = await PROCEDURAL_MODELS[def.procedural]();
        const build = () => this.normalize(make(), def);
        build(); // 한 번 만들어 보아 오류를 여기서 잡는다
        this.factories.set(name, build);
        this.models.set(name, true);
      } else {
        const gltf = await this.loader.loadAsync(def.url);
        this.models.set(name, this.normalize(gltf.scene, def));
      }
      for (const fn of this.waiters.get(name) || []) fn();
      this.waiters.delete(name);
    } catch (e) {
      console.warn(`[model] ${name} 불러오기 실패 — 임시 모델 사용`, e);
    }
  }

  // 앞이 -Z, 가장 긴 변 = size, anchor 'bottom' 이면 발이 y=0
  normalize(scene, def) {
    scene.rotation.y = def.rotateY || 0;
    hideClearParts(scene);
    const holder = new THREE.Group();
    holder.add(scene);
    holder.updateMatrixWorld(true);
    const box = visibleBox(holder); // 안 보이는 부품(코드 모델의 root 상자 등)은 크기 계산에서 뺀다
    const dim = box.getSize(new THREE.Vector3());
    const k = (def.size || 1) / Math.max(dim.x, dim.y, dim.z);
    const center = box.getCenter(new THREE.Vector3());
    scene.position.x -= center.x;
    scene.position.z -= center.z;
    scene.position.y = def.anchor === 'bottom' ? -box.min.y : -center.y;
    holder.scale.setScalar(k);
    if (def.material) scene.traverse((o) => {
      if (!o.isMesh) return;
      const m = def.material;
      if (m.metalness !== undefined) o.material.metalness = m.metalness;
      if (m.roughness !== undefined) o.material.roughness = m.roughness;
      if (m.darkenNeutral && o.material.map) o.material.map = darkenNeutral(o.material.map, m.darkenNeutral);
    });
    const outer = new THREE.Group();
    outer.add(holder);
    if (def.tip === '-z') outer.userData.tip = findFrontTip(outer);
    return outer;
  }

  has(name) {
    return this.models.has(name);
  }

  get(name) {
    const f = this.factories.get(name);
    if (f) return f();
    const m = this.models.get(name);
    return m ? m.clone(true) : null;
  }

  onReady(name, fn) {
    if (this.models.has(name)) return fn();
    if (!this.waiters.has(name)) this.waiters.set(name, []);
    this.waiters.get(name).push(fn);
  }
}

// 채도가 낮은(회색) 픽셀만 어둡게. 보라·노랑·빨강처럼 색이 있는 부분은 유지.
function darkenNeutral(tex, factor) {
  const img = tex.image;
  if (!img || !img.width) return tex;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], gg = p[i + 1], b = p[i + 2];
    const sat = Math.max(r, gg, b) - Math.min(r, gg, b);
    const t = Math.min(1, sat / 70); // 0 = 회색, 1 = 뚜렷한 색
    const k = factor + (1 - factor) * t;
    p[i] = r * k;
    p[i + 1] = gg * k;
    p[i + 2] = b * k;
  }
  g.putImageData(d, 0, 0);
  const out = new THREE.CanvasTexture(c);
  out.flipY = tex.flipY; // glTF 텍스처는 flipY=false
  out.colorSpace = tex.colorSpace;
  out.wrapS = tex.wrapS;
  out.wrapT = tex.wrapT;
  out.anisotropy = 4;
  return out;
}

// 모델에서 가장 앞쪽(-Z) 끝 점들의 평균 = 총구 위치 (모델 좌표)
function findFrontTip(root) {
  root.updateMatrixWorld(true);
  const pts = [];
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
  });
  if (!pts.length) return null;
  let minZ = Infinity, maxZ = -Infinity;
  for (const p of pts) {
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const near = pts.filter((p) => p.z < minZ + (maxZ - minZ) * 0.03);
  const x = near.reduce((a, p) => a + p.x, 0) / near.length;
  const y = near.reduce((a, p) => a + p.y, 0) / near.length;
  return { x, y, z: minZ };
}

// 완전히 투명한 부품(코드 모델의 뼈대 받침 root 상자 등)은 재질만 끈다 → 그리지도, 그림자를 내지도 않는다.
// (메시 자체를 끄면 자식 부품까지 사라지므로 재질만)
function hideClearParts(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m && m.transparent && m.opacity === 0) m.visible = false;
    }
  });
}

// 보이는 메시만으로 크기 상자 (재질이 visible:false 인 것 제외)
function visibleBox(root) {
  const box = new THREE.Box3();
  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.every((m) => m && m.visible === false)) return;
    box.expandByObject(o);
  });
  return box.isEmpty() ? new THREE.Box3().setFromObject(root) : box;
}
