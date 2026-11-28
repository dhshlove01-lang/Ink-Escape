import * as THREE from 'three';
import { CELL, WALL_H, VIEW_H, TILE } from '../../shared/map/GameMap.js';
import { texture } from './Images.js';
import { placeModel } from './MapModels.js';
import { glowTexture } from './DungeonKit.js';

// 둥근 맵(map.bounds)의 바닥·천장·둥근 바깥벽 + 맵 데이터 소품(map.props)을 그린다.
// 충돌은 GameMap 이 같은 데이터로 따로 계산한다 — 여기는 보이는 것만.

const DOOR_GAP = 4.3; // 문 자리에서 둥근 벽을 비우는 반폭(m) — 문틀(EscapeGate)이 이 틈을 덮는다

// 텍스처 복제 + 반복
function tiled(key, rx, ry) {
  const base = texture(key);
  if (!base) return null;
  const t = base.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

// 안쪽을 보는 원통 벽 조각 (theta: three 원통과 같은 각 — x = sinθ, z = cosθ)
function innerArc(b, t0, len, tileW, tileH) {
  const segs = Math.max(2, Math.ceil(len * 40));
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const th = t0 + (len * i) / segs;
    const sx = Math.sin(th), sz = Math.cos(th);
    const u = (b.r * len * i) / segs / tileW;
    for (const y of [0, WALL_H]) {
      pos.push(b.x + sx * b.r, y, b.z + sz * b.r);
      nor.push(-sx, 0, -sz);
      uv.push(u, y / tileH);
    }
    if (i < segs) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); // 안쪽(가운데)에서 보이는 방향
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// 바닥·천장·둥근 벽. 돌려주는 값: 상자로 그릴 벽 칸 (안쪽 벽 + 문 통로 옆벽)
export function buildRoundHall(scene, map, theme, kit, ceilingLayer) {
  const b = map.bounds;
  const tile = theme.tile || { wall: [4.5, 7], floor: 4 };

  // 바닥: 원 + 문 통로 아래
  const R = b.r + 1.5;
  const floorTex = tiled(theme.tex.floor, (R * 2) / tile.floor, (R * 2) / tile.floor);
  // 바닥: 윤기 있는 흑요석 대리석. roughness 를 올려 거울처럼 번지는 하이라이트(보라 띠)를 없했다 (2026-11-28: 0.38 → 0.7)
  const floorMat = floorTex ? new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7, metalness: 0.02 }) : kit.mats.floor;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 96), floorMat);
  floor.userData.noCast = true; // 바닥은 그림자를 받기만
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(b.x, 0, b.z);
  scene.add(floor);
  for (const d of map.doors) {
    const xs = d.cells.map((c) => c[0]), ys = d.cells.map((c) => c[1]);
    const w = (Math.max(...xs) - Math.min(...xs) + 1) * CELL, h = (Math.max(...ys) - Math.min(...ys) + 1) * CELL;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w + CELL * 2, h + CELL * 2), floorMat);
    f.userData.noCast = true;
    f.rotation.x = -Math.PI / 2;
    f.position.set((Math.min(...xs) * CELL + Math.max(...xs) * CELL + CELL) / 2, -0.005, (Math.min(...ys) * CELL + Math.max(...ys) * CELL + CELL) / 2);
    scene.add(f);
  }

  // 천장 (플레이어 화면에만)
  const ceiling = new THREE.Mesh(new THREE.CircleGeometry(R, 64), kit.mats.ceiling);
  ceiling.userData.noCast = true;
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(b.x, WALL_H, b.z);
  ceiling.layers.set(ceilingLayer);
  scene.add(ceiling);

  // 둥근 벽: 문 자리만 비우고 이어 붙인다
  const gaps = map.doors.map((d) => {
    const th = Math.atan2(d.center.x - b.x, d.center.z - b.z);
    const half = Math.asin(Math.min(1, DOOR_GAP / b.r));
    return [th - half, th + half];
  }).sort((p, q) => p[0] - q[0]);
  const wallTex = tiled(theme.tex.wall, 1, 1);
  const wallMat = wallTex ? new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.8, metalness: 0.05 }) : kit.mats.stone;
  const arcs = [];
  if (!gaps.length) arcs.push([0, Math.PI * 2]);
  gaps.forEach((g, i) => {
    const next = gaps[(i + 1) % gaps.length];
    let end = next[0];
    if (end <= g[1]) end += Math.PI * 2;
    arcs.push([g[1], end - g[1]]);
  });
  for (const [t0, len] of arcs) scene.add(new THREE.Mesh(innerArc(b, t0, len, tile.wall[0], tile.wall[1]), wallMat));
  // 벽 위 테두리 (술래 카메라가 위에서 볼 때 벽 두께) + 바닥 걸레받이
  const rim = new THREE.Mesh(new THREE.RingGeometry(b.r, b.r + 2.2, 96), kit.mats.stoneTop);
  rim.userData.noCast = true;
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(b.x, WALL_H, b.z);
  scene.add(rim);

  // 상자로 그릴 벽 칸: 원 안쪽 벽(왕좌의 방 ㄱ자) + 문 통로 옆벽
  const nearDoor = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (map.tile(x + dx, y + dy) === TILE.DOOR) return true;
    return false;
  };
  const cells = [];
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    if (map.tile(x, y) !== TILE.WALL) continue;
    const inside = Math.hypot((x + 0.5) * CELL - b.x, (y + 0.5) * CELL - b.z) < b.r;
    if (inside || nearDoor(x, y)) cells.push([x, y]);
  }
  return { cells, wallMat: wallTex ? new THREE.MeshStandardMaterial({ map: tiled(theme.tex.wall, CELL / tile.wall[0], WALL_H / tile.wall[1]), roughness: 0.8 }) : null };
}

// ── 맵 데이터 소품 ──────────────────────────────────────────────
const lam = (color) => new THREE.MeshLambertMaterial({ color });

// GLB 를 못 받았을 때 대신 그릴 간단한 도형
const FALLBACK = {
  barrel: () => new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 12).translate(0, 0.5, 0), lam(0x5a3a26)),
  crate: () => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), lam(0x6b4a2c)),
  inkbottle: () => new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10).translate(0, 0.25, 0), lam(0x3b2a5a)),
  pad: () => new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.6, 24).translate(0, 0.3, 0), lam(0x4a4650)),
  throne: () => new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.4, 1.8).translate(0, 1.7, 0), lam(0x2a1a22)),
  window: () => new THREE.Mesh(new THREE.PlaneGeometry(3, 5.2).translate(0, 2.6, 0), new THREE.MeshBasicMaterial({ color: 0x6a1830 })),
  chandelier: () => new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.08, 6, 20).rotateX(Math.PI / 2).translate(0, 0.6, 0), lam(0x222026)),
};

const MODEL_OF = {
  barrel: 'prop_barrel', crate: 'prop_crate', inkbottle: 'prop_inkbottle', pad: 'prop_pad',
  throne: 'palace_throne', window: 'palace_window', chandelier: 'prop_chandelier',
};

// 스테인드글라스: 빛이 비쳐 보이게 텍스처를 스스로 빛나게
function glowGlass(m) {
  m.traverse((o) => {
    if (!o.isMesh || o.material.userData.glass) return;
    o.material.emissive = new THREE.Color(0xffffff);
    o.material.emissiveMap = o.material.map;
    o.material.emissiveIntensity = 0.55;
    o.material.userData.glass = true;
    o.material.needsUpdate = true;
  });
}

export function buildMapProps(scene, map, theme) {
  const chandeliers = [];
  for (const p of map.props) {
    if (p.kind === 'carpet') {
      scene.add(carpet(p, theme));
      continue;
    }
    const name = MODEL_OF[p.kind];
    if (!name) continue;
    const holder = placeModel(name, { fallback: FALLBACK[p.kind]?.(), decorate: p.kind === 'window' ? glowGlass : null });
    let y = p.y ?? 0;
    if (p.kind === 'window') y = Math.max(0.8, VIEW_H - 5.2); // 창 위끝이 VIEW_H
    if (p.kind === 'chandelier') {
      y = VIEW_H - 2.8; // 샹들리에 위끝이 VIEW_H, 그 위는 사슬
      chandeliers.push({ x: p.x, z: p.z, y });
    }
    holder.position.set(p.x, y, p.z);
    holder.rotation.y = p.ry || 0;
    scene.add(holder);
  }
  // 샹들리에: 천장까지 사슬 + 촛불 빛무리 (진짜 빛 없음 — 빛나 보이기만)
  const glow = glowTexture();
  const chainMat = lam(0x1c1a20);
  for (const c of chandeliers) {
    const top = c.y + 2.7;
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, WALL_H - top, 5), chainMat);
    chain.position.set(c.x, (WALL_H + top) / 2, c.z);
    scene.add(chain);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
    halo.scale.set(5.5, 3.2, 1);
    halo.position.set(c.x, c.y + 0.9, c.z);
    scene.add(halo);
  }
}

// 붉은 러너 카펫 (긴 쪽이 z)
function carpet(p, theme) {
  const tile = theme.tile?.carpet || 2.4;
  const tex = tiled(theme.tex.carpet, 1, p.len / tile);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(p.w, p.len),
    tex ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }) : lam(0x7a1020),
  );
  m.userData.noCast = true; // 카펫도 그림자를 받기만
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = p.ry || 0;
  m.position.set(p.x, 0.015, p.z);
  return m;
}
