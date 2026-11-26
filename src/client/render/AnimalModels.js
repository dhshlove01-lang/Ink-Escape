import * as THREE from 'three';

// 동글동글 동물 4종을 공·원기둥으로 만든다 (임시 모델 — 나중에 진짜 3D 모델 파일로 교체).
// 모든 모델은 -Z 쪽을 바라본다 (카메라와 같은 방향).

export const ANIMAL_LOOK = {
  shiba: { fur: 0xe39a4b, belly: 0xfff3df, inner: 0xfff3df, hat: 0xd9572b, ear: 'pointy', label: '#e39a4b' },
  bear: { fur: 0x7a4f2e, belly: 0xd9b48a, inner: 0xd9b48a, hat: 0x5f6b3a, ear: 'round', label: '#8a6a3a' },
  rabbit: { fur: 0xf4f1ec, belly: 0xffffff, inner: 0xf5b8b8, hat: 0xe8b43a, ear: 'long', label: '#e8b43a' },
  cat: { fur: 0xf6efe4, belly: 0xffffff, inner: 0xf3b0a0, hat: 0x7b4fc9, ear: 'pointy', patch: [0xe08a3a, 0x2b2622], label: '#7b4fc9' },
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

export function createAnimalModel(kind) {
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
    if (L.ear === 'pointy') {
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
  const hat = sphere(0.36, L.hat, 1.1, kind === 'cat' ? 0.35 : 0.55, 1.1);
  hat.position.set(kind === 'cat' ? 0.08 : 0, 1.08, 0.02);
  if (kind !== 'rabbit') g.add(hat);
  else {
    const cap = sphere(0.33, L.hat, 1, 0.45, 1);
    cap.position.set(0, 1.08, 0.05);
    g.add(cap);
  }
  // 발
  for (const sx of [-0.25, 0.25]) {
    const foot = sphere(0.15, L.fur, 1, 0.6, 1.2);
    foot.position.set(sx, 0.07, -0.12);
    g.add(foot);
  }
  // 총과 앞발
  const gun = createGunMesh();
  gun.scale.setScalar(1.35);
  gun.position.set(0.32, 0.55, -0.6);
  g.add(gun);
  for (const [x, z] of [[0.28, -0.45], [0.05, -0.7]]) {
    const paw = sphere(0.1, L.fur);
    paw.position.set(x, 0.5, z);
    g.add(paw);
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  g.userData.kind = kind;
  return g;
}

// 1인칭 앞발 + 총
export function createViewModel(kind) {
  const L = ANIMAL_LOOK[kind] || ANIMAL_LOOK.shiba;
  const g = new THREE.Group();
  const gun = createGunMesh(toViewModelMaterial);
  gun.scale.setScalar(0.7);
  gun.rotation.y = 0.05; // 총구가 조준점 쪽, 옆면이 살짝 보이게
  g.add(gun);
  const pawR = sphere(0.055, L.fur, 1.1, 1, 1.2);
  pawR.position.set(0.01, -0.085, 0.06);
  const pawL = sphere(0.05, L.fur, 1.1, 1, 1.2);
  pawL.position.set(-0.02, -0.07, -0.2);
  g.add(pawR, pawL);
  toViewModelMaterial(g);
  return g;
}

// 1인칭 손·총은 벽에 파묻히지 않게 항상 맨 앞에, 조명 없이 그린다.
function toViewModelMaterial(root) {
  root.traverse((o) => {
    if (!o.isMesh || o.userData.vm) return;
    const src = o.material;
    o.material = new THREE.MeshBasicMaterial({ color: src.color.clone().multiplyScalar(src.map ? 1 : 0.8), map: src.map || null });
    o.material.depthTest = false;
    o.renderOrder = 10;
    o.userData.vm = true;
  });
}

// 2D 초상화 (HUD·술래 패널)
export function drawAnimalFace(ctx, kind, cx, cy, r, { dead = false } = {}) {
  const L = ANIMAL_LOOK[kind] || ANIMAL_LOOK.shiba;
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  ctx.save();
  if (dead) ctx.filter = 'grayscale(1) brightness(0.6)';
  const fur = hex(L.fur);
  ctx.fillStyle = fur;
  // 귀
  for (const s of [-1, 1]) {
    ctx.beginPath();
    if (L.ear === 'pointy') {
      ctx.moveTo(cx + s * r * 0.3, cy - r * 0.6);
      ctx.lineTo(cx + s * r * 0.75, cy - r * 1.15);
      ctx.lineTo(cx + s * r * 0.85, cy - r * 0.35);
    } else if (L.ear === 'round') {
      ctx.arc(cx + s * r * 0.7, cy - r * 0.65, r * 0.32, 0, Math.PI * 2);
    } else {
      ctx.ellipse(cx + s * r * 0.35, cy - r * 1.05, r * 0.2, r * 0.6, s * 0.15, 0, Math.PI * 2);
    }
    ctx.fill();
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
  ctx.fillStyle = '#1a1414';
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

export function faceCanvas(kind, size = 64, opts) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  drawAnimalFace(c.getContext('2d'), kind, size / 2, size * 0.58, size * 0.34, opts);
  return c;
}
