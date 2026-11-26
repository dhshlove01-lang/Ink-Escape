import * as THREE from 'three';
import { img } from './Images.js';

// 동글동글 동물 4종을 공·원기둥으로 만든다 (임시 모델 — 나중에 진짜 3D 모델 파일로 교체).
// 모든 모델은 -Z 쪽을 바라본다 (카메라와 같은 방향).

export const ANIMAL_LOOK = {
  shiba: { fur: 0xe39a4b, belly: 0xfff3df, inner: 0xfff3df, hat: 0xd9572b, ear: 'pointy', label: '#e39a4b' },
  bear: { fur: 0x7a4f2e, belly: 0xd9b48a, inner: 0xd9b48a, hat: 0x5f6b3a, ear: 'round', label: '#8a6a3a' },
  rabbit: { fur: 0xf4f1ec, belly: 0xffffff, inner: 0xf5b8b8, hat: 0xe8b43a, ear: 'long', label: '#e8b43a' },
  cat: { fur: 0xf6efe4, belly: 0xffffff, inner: 0xf3b0a0, hat: 0x7b4fc9, ear: 'pointy', patch: [0xe08a3a, 0x2b2622], label: '#7b4fc9' },
  devil: { fur: 0x241d29, belly: 0x8e1f2c, inner: 0xd0303f, hat: 0xc41f30, ear: 'horn', devil: true, label: '#e0384a' },
};

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

function sphere(r, color, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), mat(color));
  m.scale.set(sx, sy, sz);
  return m;
}

// 진짜 3D 모델(ModelLibrary)이 있으면 그것을, 없으면 공·상자로 만든 임시 모델을 쓴다.
let library = null;
export function setModelLibrary(lib) {
  library = lib;
}

// 총: 모델이 늦게 불러와지면 그 자리에서 바꿔 끼운다. decorate 는 바꿔 낄 때마다 다시 적용된다.
export function createGunMesh(decorate = () => {}) {
  const holder = new THREE.Group();
  const put = (obj) => {
    holder.clear();
    holder.add(obj);
    decorate(holder);
  };
  put(library?.get('gun') || primitiveGun());
  if (library && !library.has('gun')) library.onReady('gun', () => put(library.get('gun')));
  return holder;
}

function primitiveGun() {
  const g = new THREE.Group();
  g.userData.tip = { x: 0, y: 0.02, z: -0.53 }; // 총구 끝
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.5), mat(0x2c2b33));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 10), mat(0x1c1b20));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.38);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.1), mat(0x7b4fc9));
  mag.position.set(0, -0.13, -0.05);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.1), mat(0x1c1b20));
  sight.position.set(0, 0.1, 0.02);
  g.add(body, barrel, mag, sight);
  for (const sx of [-0.062, 0.062]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.03, 0.3), mat(0xf0bd1e));
    stripe.position.set(sx, 0.02, -0.05);
    g.add(stripe);
  }
  return g;
}

// 캐릭터(로비·결과 화면): GLB 가 있으면 그것, 없으면 임시 모델. 늦게 도착해도 바꿔 끼운다.
export function createCharacterModel(kind, { gun = false } = {}) {
  const holder = new THREE.Group();
  const put = () => {
    holder.clear();
    holder.add(createAnimalModel(kind, { gun }));
  };
  put();
  if (library && !library.has(kind)) library.onReady(kind, put);
  holder.userData.kind = kind;
  return holder;
}

// 인게임 동물 몸: GLB 가 있으면 GLB + 총, 없으면 공·상자 임시 모델. 늦게 도착하면 그 자리에서 바꿔 끼운다.
export function createAnimalModel(kind, { gun = true } = {}) {
  if (!gun) return library?.get(kind) || primitiveAnimal(kind, { gun: false });
  const holder = new THREE.Group();
  const put = (obj) => {
    holder.clear();
    holder.add(obj);
    if (gun) holder.add(rifleMesh());
  };
  if (library?.has(kind)) put(library.get(kind));
  else {
    put(primitiveAnimal(kind, { gun: false }));
    if (library) library.onReady(kind, () => put(library.get(kind)));
  }
  holder.userData.kind = kind;
  return holder;
}

// 진짜 몸에 들려주는 총 (몸 앞쪽 오른발 근처, 총구가 앞)
function rifleMesh() {
  const g = createGunMesh();
  g.scale.setScalar(1.15);
  g.position.set(0.34, 0.62, -0.66);
  g.rotation.set(0.06, -0.12, 0);
  return g;
}

function primitiveAnimal(kind, { gun = true } = {}) {
  const L = ANIMAL_LOOK[kind] || ANIMAL_LOOK.shiba;
  const g = new THREE.Group();
  const body = sphere(0.58, L.fur, 1, 0.95, 0.95);
  body.position.y = 0.6;
  g.add(body);
  const belly = sphere(0.42, L.belly, 1, 0.9, 0.6);
  belly.position.set(0, 0.5, -0.3);
  g.add(belly);
  if (L.patch) {
    const p1 = sphere(0.22, L.patch[0], 1, 0.7, 0.5);
    p1.position.set(-0.32, 0.85, -0.35);
    const p2 = sphere(0.2, L.patch[1], 1, 0.7, 0.5);
    p2.position.set(0.3, 0.95, -0.3);
    g.add(p1, p2);
  }
  // 눈·코
  for (const sx of [-0.17, 0.17]) {
    const eye = sphere(0.075, 0x1a1414);
    eye.position.set(sx, 0.78, -0.52);
    const shine = sphere(0.022, 0xffffff);
    shine.position.set(sx + 0.025, 0.8, -0.59);
    g.add(eye, shine);
  }
  const nose = sphere(0.05, kind === 'bear' ? 0x1a1414 : 0xe88a9a);
  nose.position.set(0, 0.68, -0.57);
  g.add(nose);
  // 귀
  for (const side of [-1, 1]) {
    let ear;
    if (L.ear === 'horn') {
      // 술래 악마: 검은 고양이 귀 + 빨간 뿔
      ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 12), mat(L.inner));
      ear.position.set(side * 0.19, 1.2, -0.02);
      ear.rotation.z = -side * 0.22;
      const catEar = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.4, 12), mat(L.fur));
      catEar.position.set(side * 0.34, 1.08, 0.02);
      catEar.rotation.z = -side * 0.42;
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 10), mat(L.inner));
      inner.position.set(side * 0.36, 1.05, -0.05);
      inner.rotation.z = -side * 0.42;
      g.add(catEar, inner);
    } else if (L.ear === 'pointy') {
      ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 12), mat(L.fur));
      ear.position.set(side * 0.3, 1.18, -0.05);
      ear.rotation.z = -side * 0.35;
    } else if (L.ear === 'round') {
      ear = sphere(0.14, L.fur, 1, 1, 0.6);
      ear.position.set(side * 0.38, 1.08, 0);
    } else {
      ear = sphere(0.12, L.fur, 0.8, 2.6, 0.5);
      ear.position.set(side * 0.2, 1.42, 0.02);
      ear.rotation.z = -side * 0.15;
      const inner = sphere(0.07, L.inner, 0.7, 2.4, 0.4);
      inner.position.set(side * 0.2, 1.42, -0.04);
      inner.rotation.z = -side * 0.15;
      g.add(inner);
    }
    g.add(ear);
  }
  // 모자
  if (!L.devil) {
    const hat = sphere(0.36, L.hat, 1.1, kind === 'cat' ? 0.35 : 0.55, 1.1);
    hat.position.set(kind === 'cat' ? 0.08 : 0, 1.08, 0.02);
    if (kind !== 'rabbit') g.add(hat);
    else {
      const cap = sphere(0.33, L.hat, 1, 0.45, 1);
      cap.position.set(0, 1.08, 0.05);
      g.add(cap);
    }
  }
  if (L.devil) {
    // 박쥐 날개 + 화살 꼬리
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 3), mat(L.inner));
      wing.position.set(side * 0.62, 0.78, 0.22);
      wing.rotation.set(0.3, side * 0.5, side * 1.9);
      wing.scale.set(1, 1, 0.35);
      g.add(wing);
    }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.6, 8), mat(L.inner));
    tail.position.set(0, 0.45, 0.62);
    tail.rotation.x = 0.9;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 4), mat(L.inner));
    tip.position.set(0, 0.78, 0.86);
    tip.rotation.x = 0.5;
    g.add(tail, tip);
  }
  // 발
  for (const sx of [-0.25, 0.25]) {
    const foot = sphere(0.15, L.fur, 1, 0.6, 1.2);
    foot.position.set(sx, 0.07, -0.12);
    g.add(foot);
  }
  // 총과 앞발
  if (gun) {
    const gunMesh = createGunMesh();
    gunMesh.scale.setScalar(1.35);
    gunMesh.position.set(0.32, 0.55, -0.6);
    g.add(gunMesh);
    for (const [x, z] of [[0.28, -0.45], [0.05, -0.7]]) {
      const paw = sphere(0.1, L.fur);
      paw.position.set(x, 0.5, z);
      g.add(paw);
    }
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  g.userData.kind = kind;
  return g;
}

// 1인칭 앞발 + 총 (카메라 기준 뷰모델). 동물마다 털색·무늬·소매·발바닥이 다르다.
export function createViewModel(kind) {
  const L = ANIMAL_LOOK[kind] || ANIMAL_LOOK.shiba;
  const g = new THREE.Group();
  const gun = createGunMesh(toViewModelMaterial);
  g.userData.gun = gun;
  gun.scale.setScalar(0.7);
  gun.rotation.y = 0.05; // 총구가 조준점 쪽, 옆면이 살짝 보이게
  g.add(gun);

  // 방아쇠를 쥔 오른발 (총 손잡이 뒤) · 총열을 받치는 왼발 (앞몸통 아래)
  // 좌표는 view 기준(m). 총은 대각선(-z 쪽이 왼쪽 위)이라 발도 그 각도에 맞춘다.
  const rearWrist = new THREE.Vector3(-0.07, -0.094, -0.028);
  const rearElbow = new THREE.Vector3(0.02, -0.5, 0.06);
  const frontWrist = new THREE.Vector3(-0.106, -0.056, -0.15);
  const frontElbow = new THREE.Vector3(-0.15, -0.5, -0.01);
  g.add(buildArm(rearWrist, rearElbow, L, kind));
  g.add(buildArm(frontWrist, frontElbow, L, kind));

  const rear = buildPawView(L, kind, { size: 0.05, padsUp: false });
  rear.position.copy(rearWrist);
  rear.rotation.set(1.05, 0.12, 0.32);
  g.add(rear);

  const front = buildPawView(L, kind, { size: 0.047, padsUp: true });
  front.position.copy(frontWrist);
  front.rotation.set(1.0, 0.12, 0.75);
  g.add(front);
  // Weapon.aimGun 이 총을 조준점 쪽으로 돌릴 때 발도 같이 옮긴다 (배열이어야 함)
  g.userData.paws = [rear, front];
  g.userData.pawParts = { rear, front, rearArm: g.children[1], frontArm: g.children[2] };

  // 레드도트 사이트 (총 위) — 빛나는 점의 위치를 Weapon 이 받아 쓴다
  const sight = buildRedDotSight();
  sight.position.set(-0.014, 0.085, 0.03);
  g.add(sight);
  g.userData.sightObj = sight;
  g.userData.sight = { x: -0.014, y: 0.087, z: 0.062 };

  toViewModelMaterial(g);
  return g;
}

// 1인칭 동물 앞발 ────────────────────────────────────────────
// 1 단위 = 손바닥 반지름. 다 만든 뒤 size 로 줄여 쓴다.
// 뷰모델 전용 조명(Weapon.vmScene)을 받는 Lambert 재질이라 부피가 산다.
const INK_MAT = new THREE.MeshBasicMaterial({ color: 0x0e0910, side: THREE.BackSide });
const PAD = 0xff9db0;
const PAD_DARK = 0xdf6b86;
const CLAW = 0xfff4dc;

function vmMat(color, k = 1) {
  const c = new THREE.Color(color);
  c.multiplyScalar(k);
  const m = new THREE.MeshLambertMaterial({ color: c });
  m.userData.vm = true;
  return m;
}

function vmSphere(color, r, sx = 1, sy = 1, sz = 1, k = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 11), vmMat(color, k));
  m.scale.set(sx, sy, sz);
  m.userData.vm = true;
  return m;
}

// 메시들에 굵은 잉크 외곽선(BackSide 확대 복제)을 붙인다
function addInk(parent, k = 1.07, skip = []) {
  for (const m of [...parent.children]) {
    if (!m.isMesh || skip.includes(m)) continue;
    const o = new THREE.Mesh(m.geometry, INK_MAT);
    o.position.copy(m.position);
    o.rotation.copy(m.rotation);
    o.scale.copy(m.scale).multiplyScalar(k);
    o.renderOrder = -1;
    o.userData.vm = true;
    parent.add(o);
  }
}

/// 동물 앞발 하나 (손바닥·발가락·발톱·발바닥 젤리)
function buildPawView(L, kind, { size = 0.05, padsUp = false } = {}) {
  const root = new THREE.Group();
  const fur = L.fur;
  const light = L.belly;
  const sy = padsUp ? 1 : -1; // 발바닥 젤리가 향하는 쪽

  // 손바닥
  const palm = vmSphere(fur, 1, 1.08, 0.86, 1.02, 0.98);
  palm.position.set(0, 0, 0.12);
  root.add(palm);
  // 손등 하이라이트 (털 밝은 부분) — 발바닥 젤리가 위를 보면 반대쪽에
  const back = vmSphere(light, 0.72, 1, 0.5, 0.86, 1);
  back.position.set(0, sy * 0.5, 0.2);
  root.add(back);

  // 발가락 3개 (앞쪽 -z 로 굽어 감싼다)
  const toes = [-0.62, 0, 0.62];
  toes.forEach((x, i) => {
    const r = 0.5 - Math.abs(i - 1) * 0.045;
    const toe = vmSphere(fur, r, 1, 0.94, 1.18, 1.06);
    toe.position.set(x, -0.14, -0.72 - (i === 1 ? 0.06 : 0));
    root.add(toe);
    // 발톱
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.34, 6), vmMat(CLAW, 1));
    claw.position.set(x, -0.1, -1.26 - (i === 1 ? 0.06 : 0));
    claw.rotation.x = -Math.PI / 2;
    root.add(claw);
    // 발가락 젤리
    const bean = vmSphere(PAD, 0.21, 1, 0.5, 1.15, 1);
    bean.position.set(x, sy * 0.4, -0.78 - (i === 1 ? 0.06 : 0));
    root.add(bean);
  });
  // 엄지
  const thumb = vmSphere(fur, 0.44, 1, 0.9, 1.05, 0.92);
  thumb.position.set(1.02, -0.18, 0.06);
  thumb.rotation.z = -0.5;
  root.add(thumb);
  // 손바닥 젤리
  const pad = vmSphere(PAD_DARK, 0.5, 1, 0.42, 1.05, 1);
  pad.position.set(0, sy * 0.62, 0.1);
  root.add(pad);
  // 발가락 사이 홈 (잉크 선)
  for (const x of [-0.31, 0.31]) {
    const gap = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.5), vmMat(0x1a1218, 1));
    gap.position.set(x, sy * 0.16, -0.62);
    root.add(gap);
  }

  // 무늬: 삼색고양이 = 주황·검정 얼룩, 시바 = 크림 양말, 곰 = 진한 발끝, 토끼 = 흰 발
  if (L.patch) {
    const p1 = vmSphere(L.patch[0], 0.42, 1, 0.5, 0.8, 1);
    p1.position.set(-0.45, 0.56, 0.16);
    root.add(p1);
    const p2 = vmSphere(L.patch[1], 0.34, 1, 0.5, 0.75, 1);
    p2.position.set(0.5, 0.5, 0.05);
    root.add(p2);
    const p3 = vmSphere(L.patch[0], 0.2, 1, 0.6, 1, 1);
    p3.position.set(-0.62, 0.02, -0.95);
    root.add(p3);
  } else if (kind === 'shiba') {
    for (const x of toes) {
      const sock = vmSphere(light, 0.27, 1, 0.7, 0.9, 1);
      sock.position.set(x, -0.34, -1.02);
      root.add(sock);
    }
  } else if (kind === 'bear') {
    for (const x of toes) {
      const tip = vmSphere(0x4a2c18, 0.24, 1, 0.8, 0.9, 1);
      tip.position.set(x, -0.28, -1.06);
      root.add(tip);
    }
  }

  // 소매(팔)는 createViewModel 이 따로 만든다
  addInk(root, 1.12, [pad]);
  root.scale.setScalar(size);
  root.userData.paw = true;
  return root;
}

// 동물 팔: 털 팔목 + 팔 끝 쪽에 천 소매 단. 손목에서 화면 아래로 빠져나간다.
function buildArm(wrist, elbow, L, kind) {
  const g = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(elbow, wrist);
  const len = dir.length();
  const unit = dir.clone().normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), unit);
  const mid = new THREE.Vector3().addVectors(wrist, elbow).multiplyScalar(0.5);

  // 털 팔 (손목 쪽이 가늘고 팔꿈치 쪽이 두룹다)
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.032, len, 14, 1, true), vmMat(L.fur, 0.95));
  arm.userData.vm = true;
  arm.position.copy(mid);
  arm.quaternion.copy(q);
  g.add(arm);
  // 손목 털 (복슬한 단)
  const fluff = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.027, 0.04, 14), vmMat(L.belly, 1));
  fluff.userData.vm = true;
  fluff.position.copy(wrist).addScaledVector(unit, 0.03);
  fluff.quaternion.copy(q);
  g.add(fluff);
  // 소매 (손목 아래에서 보이는 색 단) + 접힌 끝
  const cuffLen = 0.075;
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.035, cuffLen, 14, 1, true), vmMat(L.hat, 0.6));
  sleeve.userData.vm = true;
  sleeve.position.copy(wrist).addScaledVector(unit, 0.052 + cuffLen / 2);
  sleeve.quaternion.copy(q);
  g.add(sleeve);
  const trim = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.014, 14), vmMat(L.belly, 0.9));
  trim.userData.vm = true;
  trim.position.copy(wrist).addScaledVector(unit, 0.05);
  trim.quaternion.copy(q);
  g.add(trim);
  return g;
}

// 레드도트 사이트: 검은 몸통 + 빛나는 빨간 렌즈 (뷰모델의 다른 것과 같은 조명 없는 재질)
function buildRedDotSight() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.024, 0.05), vmMat(0x18161c, 1));
  g.add(body);
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.014, 12), vmMat(0x0d0b10, 1));
  hood.rotation.x = Math.PI / 2;
  hood.position.set(0, 0.002, -0.012);
  g.add(hood);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.012, 16), new THREE.MeshBasicMaterial({ color: 0xff2333, transparent: true, opacity: 0.9 }));
  lens.position.set(0, 0.002, 0.026);
  lens.userData.vm = true;
  g.add(lens);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.01, 0.06), vmMat(0x24202a, 1));
  rail.position.set(0, -0.022, 0);
  g.add(rail);
  return g;
}

// 1인칭 손·총은 조명 없이 그린다. 벽·낙서에 가려지지 않는 것은 Weapon 이 따로 마지막에 그리기 때문 (뷰모델 층).
function toViewModelMaterial(root) {
  root.traverse((o) => {
    if (!o.isMesh || o.userData.vm) return;
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!src?.color) return;
    // 뷰모델 조명을 받는 Lambert 로 바꿔 총이 어둠에 잠기지 않게 (텍스처는 그대로)
    o.material = new THREE.MeshLambertMaterial({ color: src.color.clone().multiplyScalar(1.5), map: src.map || null });
    o.userData.vm = true;
  });
}

// 2D 초상화 (HUD·술래 패널)
export function drawAnimalFace(ctx, kind, cx, cy, r, { dead = false } = {}) {
  const face = img('face.' + kind);
  if (face) {
    // 사용자 초상화 (머리 모양 그대로, 원 안에 맞춤)
    const k = (r * 2.5) / Math.max(face.width, face.height);
    const w = face.width * k, h = face.height * k;
    ctx.save();
    if (dead) ctx.filter = 'grayscale(1) brightness(0.55)';
    ctx.drawImage(face, cx - w / 2, cy - h * 0.55, w, h);
    ctx.restore();
    return;
  }
  if (kind === 'devil') return drawDevilFace(ctx, cx, cy, r, dead);
  const L = ANIMAL_LOOK[kind] || ANIMAL_LOOK.shiba;
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  ctx.save();
  if (dead) ctx.filter = 'grayscale(1) brightness(0.6)';
  const fur = hex(L.fur);
  // 귀 / 뿔
  for (const s of [-1, 1]) {
    ctx.fillStyle = fur;
    ctx.beginPath();
    if (L.ear === 'pointy' || L.ear === 'horn') {
      ctx.moveTo(cx + s * r * 0.3, cy - r * 0.6);
      ctx.lineTo(cx + s * r * 0.75, cy - r * 1.15);
      ctx.lineTo(cx + s * r * 0.85, cy - r * 0.35);
    } else if (L.ear === 'round') {
      ctx.arc(cx + s * r * 0.7, cy - r * 0.65, r * 0.32, 0, Math.PI * 2);
    } else {
      ctx.ellipse(cx + s * r * 0.35, cy - r * 1.05, r * 0.2, r * 0.6, s * 0.15, 0, Math.PI * 2);
    }
    ctx.fill();
    if (L.ear === 'horn') {
      ctx.fillStyle = hex(L.inner);
      ctx.beginPath();
      ctx.moveTo(cx + s * r * 0.04, cy - r * 0.9);
      ctx.lineTo(cx + s * r * 0.3, cy - r * 1.55);
      ctx.lineTo(cx + s * r * 0.44, cy - r * 0.8);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  if (L.patch) {
    ctx.fillStyle = hex(L.patch[0]);
    ctx.beginPath();
    ctx.arc(cx - r * 0.45, cy - r * 0.4, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hex(L.patch[1]);
    ctx.beginPath();
    ctx.arc(cx + r * 0.5, cy - r * 0.35, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = hex(L.belly);
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.35, r * 0.55, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = kind === 'devil' ? '#8e1f2c' : '#1a1414';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    if (dead) {
      ctx.lineWidth = r * 0.1;
      ctx.strokeStyle = '#1a1414';
      const ex = cx + s * r * 0.33, ey = cy - r * 0.05, d = r * 0.12;
      ctx.moveTo(ex - d, ey - d);
      ctx.lineTo(ex + d, ey + d);
      ctx.moveTo(ex + d, ey - d);
      ctx.lineTo(ex - d, ey + d);
      ctx.stroke();
    } else {
      ctx.arc(cx + s * r * 0.33, cy - r * 0.05, r * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = kind === 'bear' ? '#1a1414' : '#e88a9a';
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.2, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 술래 악마 얼굴 (3D 모델과 같은 모습: 까만 털·빨간 뿔과 귀 안쪽·빨간 눈동자·송곳니 웃음)
function drawDevilFace(ctx, cx, cy, r, dead) {
  const BLACK = '#1b1620', RED = '#d4283c', DARK_RED = '#7c1424';
  ctx.save();
  if (dead) ctx.filter = 'grayscale(1) brightness(0.6)';
  ctx.lineJoin = 'round';
  // 큰 뾰족 귀 (바깥 까맣게, 안쪽 빨갛게)
  for (const s of [-1, 1]) {
    ctx.fillStyle = BLACK;
    ctx.beginPath();
    ctx.moveTo(cx + s * r * 0.35, cy - r * 0.75);
    ctx.lineTo(cx + s * r * 1.08, cy - r * 1.2);
    ctx.lineTo(cx + s * r * 0.95, cy - r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = DARK_RED;
    ctx.beginPath();
    ctx.moveTo(cx + s * r * 0.5, cy - r * 0.7);
    ctx.lineTo(cx + s * r * 0.98, cy - r * 1.02);
    ctx.lineTo(cx + s * r * 0.88, cy - r * 0.35);
    ctx.closePath();
    ctx.fill();
  }
  // 머리 (어두운 카드 위에서도 보이게 옅은 테두리)
  ctx.fillStyle = BLACK;
  ctx.strokeStyle = 'rgba(236,200,210,0.28)';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 1.0, r * 0.94, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // 빨간 뿔 (살짝 휜 모양)
  ctx.fillStyle = RED;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * r * 0.12, cy - r * 0.78);
    ctx.quadraticCurveTo(cx + s * r * 0.08, cy - r * 1.32, cx + s * r * 0.36, cy - r * 1.46);
    ctx.quadraticCurveTo(cx + s * r * 0.3, cy - r * 1.1, cx + s * r * 0.46, cy - r * 0.8);
    ctx.closePath();
    ctx.fill();
  }
  // 빨간 턱 (입 주변)
  ctx.fillStyle = DARK_RED;
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.48, r * 0.5, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  // 눈썹
  ctx.strokeStyle = RED;
  ctx.lineWidth = r * 0.13;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * r * 0.15, cy - r * 0.3);
    ctx.lineTo(cx + s * r * 0.6, cy - r * 0.45);
    ctx.stroke();
  }
  // 눈
  for (const s of [-1, 1]) {
    const ex = cx + s * r * 0.38, ey = cy - r * 0.02;
    if (dead) {
      ctx.strokeStyle = '#f3ecdd';
      ctx.lineWidth = r * 0.1;
      const d = r * 0.14;
      ctx.beginPath();
      ctx.moveTo(ex - d, ey - d);
      ctx.lineTo(ex + d, ey + d);
      ctx.moveTo(ex + d, ey - d);
      ctx.lineTo(ex - d, ey + d);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#fbf4ea';
    ctx.beginPath();
    ctx.ellipse(ex, ey, r * 0.25, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.arc(ex - s * r * 0.02, ey + r * 0.02, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#120d12';
    ctx.beginPath();
    ctx.arc(ex - s * r * 0.02, ey + r * 0.02, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex - s * r * 0.06, ey - r * 0.04, r * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
  // 코
  ctx.fillStyle = '#3a1016';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.24, r * 0.09, r * 0.065, 0, 0, Math.PI * 2);
  ctx.fill();
  // 웃는 입 + 송곳니
  ctx.fillStyle = '#2a070d';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.3, cy + r * 0.4);
  ctx.quadraticCurveTo(cx, cy + r * 0.78, cx + r * 0.3, cy + r * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fbf4ea';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * r * 0.24, cy + r * 0.41);
    ctx.lineTo(cx + s * r * 0.12, cy + r * 0.41);
    ctx.lineTo(cx + s * r * 0.17, cy + r * 0.55);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function faceCanvas(kind, size = 64, opts) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  drawAnimalFace(c.getContext('2d'), kind, size / 2, size * 0.58, size * 0.34, opts);
  return c;
}
