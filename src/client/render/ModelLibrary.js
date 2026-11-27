import * as THREE from 'three';
import { GLTFLoader } from '../../../vendor/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from '../../../vendor/addons/utils/SkeletonUtils.js';
import { PROCEDURAL_MODELS } from './models/index.js';

// GLB 모델 불러오기·보정·복제. 못 불러오면 null 을 주고, 쓰는 쪽은 임시 모델로 대체한다.
// procedural(코드 모델)은 복제하지 않고 쓸 때마다 새로 만든다 (뼈대가 있는 SkinnedMesh 는 clone 하면 깨진다).
// 리깅된 GLB(Tripo 캐릭터)는 SkeletonUtils.clone 으로 복제하고, 애니메이션 클립도 같이 넘긴다.
// 불러오기가 늦게 끝나면 onReady 로 바꿔 끼울 수 있다.

export class ModelLibrary {
  constructor(defs) {
    this.defs = defs;
    this.models = new Map();
    this.waiters = new Map();
    this.factories = new Map(); // 코드 모델: 이름 → 보정까지 한 새 모델을 돌려주는 함수
    this.pending = new Map(); // 불러오는 중인 약속 (같은 모델을 두 번 받지 않는다)
    this.loader = new GLTFLoader();
  }

  // lazy: true 인 모델은 시작할 때 받지 않는다 (필요할 때 load(name) 으로)
  loadAll() {
    return Promise.allSettled(Object.keys(this.defs).filter((n) => !this.defs[n].lazy).map((name) => this.load(name)));
  }

  load(name) {
    if (this.pending.has(name)) return this.pending.get(name);
    const p = this._load(name).finally(() => this.pending.delete(name));
    this.pending.set(name, p);
    return p;
  }

  async _load(name) {
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
        const outer = this.normalize(gltf.scene, def);
        // 달리기 클립에는 앞으로 나아가는 뿌리 이동(root motion)이 들어 있다 → 그대로 두면
        // 모델이 제자리에서 앞으로 흘러가 몸통(충돌 위치)과 어긋난다. Hips 의 앞뒤·좌우 이동만 지운다.
        for (const clip of gltf.animations || []) stripRootMotion(clip);
        // 애니메이션 클립(run·walk 등)은 복제본마다 AnimationMixer 로 재생한다 → 모델과 함께 보관
        outer.userData.animations = gltf.animations || [];
        this.models.set(name, outer);
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
    if (def.tip === '-z') {
      outer.userData.tip = findFrontTip(outer);
      outer.userData.grip = findGrip(outer); // 총 손잡이 자리 (1인칭 앞발이 쥐는 곳)
      outer.userData.sight = findSightTop(outer); // 가늠쇠 꼭대기 = 1인칭 빨간 점이 놓이는 자리
    }
    return outer;
  }

  has(name) {
    return this.models.has(name);
  }

  get(name) {
    const f = this.factories.get(name);
    if (f) return f();
    const m = this.models.get(name);
    if (!m) return null;
    // 리깅(SkinnedMesh)은 clone(true) 하면 스킨·본 연결이 끊긴다 → SkeletonUtils
    const copy = hasSkin(m) ? cloneSkinned(m) : m.clone(true);
    copy.userData.animations = m.userData.animations || [];
    if (m.userData.tip) copy.userData.tip = m.userData.tip;
    if (m.userData.grip) copy.userData.grip = m.userData.grip;
    if (m.userData.sight) copy.userData.sight = m.userData.sight;
    return copy;
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

// 가늠쇠(사이트) 꼭대기: 가장 높은 점들 → 1인칭 빨간 점을 이 자리에 놓는다
function findSightTop(root) {
  root.updateMatrixWorld(true);
  const pts = [];
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / 4000));
    for (let i = 0; i < pos.count; i += step) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
  });
  if (!pts.length) return null;
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const top = pts.filter((p) => p.y > maxY - (maxY - minY) * 0.06);
  return {
    x: top.reduce((a, p) => a + p.x, 0) / top.length,
    y: maxY,
    z: top.reduce((a, p) => a + p.z, 0) / top.length,
  };
}

// 총 손잡이 자리: 아래쪽 25% 안에서 가장 뒤(+Z)쪽에 뭉친 점들 = 권총 손잡이 (탄창은 앞에 달려 있다).
// 1인칭 앞발이 이 자리를 쥐도록 총을 놓는다 (총 모델이 바뀌어도 자동으로 맞음).
function findGrip(root) {
  root.updateMatrixWorld(true);
  const pts = [];
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / 4000));
    for (let i = 0; i < pos.count; i += step) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
  });
  if (!pts.length) return null;
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const low = pts.filter((p) => p.y < minY + (maxY - minY) * 0.25);
  const base = low.length ? low : pts;
  // 아래쪽 무리 안에서 가장 뒤쪽(+Z)에 붙은 점들 = 손잡이 (탄창은 그보다 앞에 매달려 있다)
  let rearZ = -Infinity;
  for (const p of base) rearZ = Math.max(rearZ, p.z);
  const rear = base.filter((p) => p.z > rearZ - 0.08);
  const sel = rear.length ? rear : base;
  const x = sel.reduce((a, p) => a + p.x, 0) / sel.length;
  const y = sel.reduce((a, p) => a + p.y, 0) / sel.length;
  const z = sel.reduce((a, p) => a + p.z, 0) / sel.length;
  return { x, y, z };
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
// SkinnedMesh 는 geometry 의 정점 상자(바인드 자세)가 실제 몸보다 훨씬 작게 나온다
// (Tripo 모델은 뼈 배율이 따로 붙어 있어 1/2 도 안 된다) → 뼈 변형까지 적용한 정점으로 잰다.
function visibleBox(root) {
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.visible) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.every((m) => m && m.visible === false)) return;
    if (o.isSkinnedMesh) {
      o.skeleton?.update();
      const pos = o.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 6000)); // 6천 점만 재도 충분
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i);
        o.applyBoneTransform(i, v);
        v.applyMatrix4(o.matrixWorld);
        box.expandByPoint(v);
      }
      return;
    }
    if (o.isMesh) box.expandByObject(o);
  });
  return box.isEmpty() ? new THREE.Box3().setFromObject(root) : box;
}

function hasSkin(root) {
  let found = false;
  root.traverse((o) => {
    if (o.isSkinnedMesh) found = true;
  });
  return found;
}

// 애니메이션의 뿌리 이동 제거: Hips 위치 트랙의 첫 프레임 기준 x·z 를 빼서 앞뒤 흘러감만 없앤다 (위아래 통통은 유지).
function stripRootMotion(clip) {
  if (clip.userData?.rootStripped) return;
  clip.userData = clip.userData || {};
  clip.userData.rootStripped = true;
  for (const track of clip.tracks) {
    if (!/\.position$/i.test(track.name) || !/hips/i.test(track.name)) continue;
    const v = track.values;
    const x0 = v[0] || 0;
    const z0 = v[2] || 0;
    for (let i = 0; i + 2 < v.length; i += 3) {
      v[i] -= x0;
      v[i + 2] -= z0;
    }
  }
}
