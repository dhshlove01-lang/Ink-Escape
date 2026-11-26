import * as THREE from 'three';
import { GLTFLoader } from '../../../vendor/addons/loaders/GLTFLoader.js';

// GLB 모델 불러오기·보정·복제. 못 불러오면 null 을 주고, 쓰는 쪽은 임시 모델로 대체한다.
// 불러오기가 늦게 끝나면 onReady 로 바꿔 끼울 수 있다.

export class ModelLibrary {
  constructor(defs) {
    this.defs = defs;
    this.models = new Map();
    this.waiters = new Map();
    this.loader = new GLTFLoader();
  }

  loadAll() {
    return Promise.allSettled(Object.keys(this.defs).map((name) => this.load(name)));
  }

  async load(name) {
    const def = this.defs[name];
    try {
      const gltf = await this.loader.loadAsync(def.url);
      const root = this.normalize(gltf.scene, def);
      this.models.set(name, root);
      for (const fn of this.waiters.get(name) || []) fn();
      this.waiters.delete(name);
    } catch (e) {
      console.warn(`[model] ${name} 불러오기 실패 — 임시 모델 사용`, e);
    }
  }

  // 앞이 -Z, 가장 긴 변 = size, 바닥 중심이 아니라 물체 중심이 원점
  normalize(scene, def) {
    scene.rotation.y = def.rotateY || 0;
    const holder = new THREE.Group();
    holder.add(scene);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder);
    const dim = box.getSize(new THREE.Vector3());
    const k = (def.size || 1) / Math.max(dim.x, dim.y, dim.z);
    const center = box.getCenter(new THREE.Vector3());
    scene.position.sub(center);
    holder.scale.setScalar(k);
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const m = def.material || {};
      if (m.metalness !== undefined) o.material.metalness = m.metalness;
      if (m.roughness !== undefined) o.material.roughness = m.roughness;
      if (m.darkenNeutral && o.material.map) o.material.map = darkenNeutral(o.material.map, m.darkenNeutral);
    });
    const outer = new THREE.Group();
    outer.add(holder);
    return outer;
  }

  has(name) {
    return this.models.has(name);
  }

  get(name) {
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
