import * as THREE from 'three';
import { VIEW_H } from '../../shared/map/GameMap.js';
import { glowTexture } from './DungeonKit.js';

// 마왕 궁전의 공기·빛 (2026-11-28, docs/art_direction_dark_palace.md 1단계)
// 진짜 조명은 2개(반구광·키) + 림 하나뿐 — 여기서는 **가짜 빛**만 만든다:
//   · 횃불·샹들리에·문·창 아래 바닥의 따뜻한 빛 웅덩이 (가산 합성 원형 판)
//   · 창에서 바닥으로 비스듬히 내리꽂히는 스테인드글라스 빛줄기
//   · 바닥 가까이 떠도는 붉은 안개
//   · 공중에 떠다니는 붉은 불티 (Points)
// 판은 전부 한 덩어리(정점 색)로 합쳐 그리기 횟수를 3번만 늘린다.

const EMBERS = 120;
const HALL_TOP = VIEW_H + 1;

// 정점 4개짜리 판 하나를 합치기 (색·투명도는 정점마다 → 웅덩이마다 세기를 다르게)
function quad(g, cx, cy, cz, ax, ay, az, bx, by, bz, rgba) {
  const p = [
    [cx - ax - bx, cy - ay - by, cz - az - bz],
    [cx + ax - bx, cy + ay - by, cz + az - bz],
    [cx + ax + bx, cy + ay + by, cz + az + bz],
    [cx - ax + bx, cy - ay + by, cz - az + bz],
  ];
  const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (let i = 0; i < 4; i++) {
    g.pos.push(p[i][0], p[i][1], p[i][2]);
    g.uv.push(uv[i][0], uv[i][1]);
    g.col.push(rgba[0], rgba[1], rgba[2], rgba[3]);
  }
  const k = g.n;
  g.idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
  g.n += 4;
}

// 색 → [r,g,b] (정점 색은 선형 공간 값이라 sRGB 를 그대로 쓰면 밝게 뜬다 → 감마 되돌림)
const rgbOf = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};

// 빛줄기 알파 텍스처 (2026-11-28 보완): 가로는 가장자리로, 세로는 바닥에 닿기 전에 0으로 사라진다.
// 이게 없으면 낮은 시점에서 판의 끝·모서리가 그대로 보여 바닥에 보라색 띠처럼 납작하게 깔린다.
let shaftAlphaTex = null;
function shaftTexture() {
  if (shaftAlphaTex) return shaftAlphaTex;
  const W = 32, H = 96;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const img = canvas.getContext('2d').createImageData(W, H);
  const ss = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1); // 0 = 창(위), 1 = 바닥(아래)
    const vf = ss(0, 0.2, v) * (1 - ss(0.5, 0.95, v)); // 위는 부드럽게 차오르고 아래는 0
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      const uf = Math.sin(Math.PI * u) ** 1.7; // 가운데가 밝고 가장자리는 사라진다
      const i = (y * W + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * vf * uf);
    }
  }
  canvas.getContext('2d').putImageData(img, 0, 0);
  shaftAlphaTex = new THREE.CanvasTexture(canvas);
  shaftAlphaTex.minFilter = THREE.LinearFilter;
  shaftAlphaTex.magFilter = THREE.LinearFilter;
  return shaftAlphaTex;
}

function geometry(g, withUv) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
  if (withUv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 4));
  geo.setIndex(g.idx);
  return geo;
}

export function buildPalaceAtmosphere(scene, map, theme) {
  const L = theme.light || {};
  const warm = rgbOf(L.pool ?? 0xff8a3c);
  const deep = rgbOf(L.poolDeep ?? 0xd8304a);
  const shaftCol = rgbOf(L.shaft ?? 0xb060ff);
  const haze = rgbOf(L.haze ?? 0x8a1030);
  const group = new THREE.Group();
  group.userData.noInk = true;
  scene.add(group);

  // ── 1) 빛 웅덩이 (바닥·벽) ─────────────────────────────────
  const P = { pos: [], uv: [], col: [], idx: [], n: 0 };
  const floorPool = (x, z, r, col, a, y = 0.025) => quad(P, x, y, z, r, 0, 0, 0, 0, r, [...col, a]);
  const wallPool = (x, y, z, nx, nz, w, h, col, a) => {
    // 벽에 붙은 세로 판: 가로 = 벽을 따라가는 방향, 세로 = 위
    const tx = nz, tz = -nx;
    quad(P, x + nx * 0.05, y, z + nz * 0.05, tx * w, 0, tz * w, 0, h, 0, [...col, a]);
  };

  for (const t of map.torches) {
    const nx = t.nx || 0, nz = t.nz || 1;
    floorPool(t.x + nx * 1.7, t.z + nz * 1.7, 3.6, warm, 0.42);
    wallPool(t.x, 2.9, t.z, nx, nz, 1.7, 1.9, warm, 0.3);
  }
  for (const p of map.props) {
    if (p.kind === 'chandelier') floorPool(p.x, p.z, 5.4, warm, 0.3);
    if (p.kind === 'window') {
      // 창 아래 바닥에 스테인드글라스 빛이 고인 자리 (빛줄기가 끝나는 자리 — 넓게 번지지 않게 옅게)
      const a = -(p.ry || 0); // 창의 ry = -a (maps.js onWall)
      const nx = -Math.sin(a), nz = Math.cos(a);
      floorPool(p.x + nx * 6.5, p.z + nz * 6.5, 2.6, shaftCol, 0.075, 0.02);
    }
  }
  for (const d of map.doors) {
    // 문 앞 바닥: 진홍 빛이 새어 나온다
    const nx = -d.dir.x, nz = -d.dir.z;
    floorPool(d.center.x + nx * 2.4, d.center.z + nz * 2.4, 3.2, deep, 0.3);
    wallPool(d.center.x, 2.2, d.center.z, nx, nz, 2.6, 2.2, deep, 0.16);
  }
  // 왕좌 앞 따뜻한 웅덩이 (왕좌 소품 자리)
  for (const p of map.props) if (p.kind === 'throne') floorPool(p.x, p.z - 3.4, 4.2, warm, 0.2);
  // 바닥 가까이 붉은 안개 (높이를 달리한 큰 판 3장 — 가산이라 겹치면 더 밝다)
  const b = map.bounds;
  if (b) {
    for (const [y, r, a] of [[0.14, b.r * 1.05, 0.022], [0.5, b.r * 0.95, 0.018], [0.9, b.r * 0.8, 0.014]]) {
      floorPool(b.x, b.z, r, haze, a, y);
    }
  }

  const pools = new THREE.Mesh(
    geometry(P, true),
    new THREE.MeshBasicMaterial({
      map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0)'),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
    }),
  );
  pools.renderOrder = 2;
  pools.userData.noInk = true;
  group.add(pools);

  // ── 2) 스테인드글라스 빛줄기 (창 → 바닥) ─────────────────────────
  // 2026-11-28 보완: 낮은 시점(홀·탈출문)에서 바닥에 보라색 넓은 띠로 납작하게 깔리던 것 →
  //  · 빛줄기 축을 따라 90° 엇갈린 두 판(십자)으로 세워 어느 각도에서 봐도 부피가 있다
  //  · 바닥에 닿기 전(0.45m)에 끝내고, 텍스처 알파가 그 전에 0으로 사라진다 (판의 모서리·끝이 안 보인다)
  //  · 바닥에 고인 빛은 1번 빛 웅덩이가 은은하게 그린다
  const S = { pos: [], uv: [], col: [], idx: [], n: 0 };
  for (const p of map.props) {
    if (p.kind !== 'window') continue;
    const a = -(p.ry || 0);
    const nx = -Math.sin(a), nz = Math.cos(a);
    const yTop = 2.3 + 5.2; // 창 윗변 (PalaceBuilder: 창 위끝이 VIEW_H)
    const L6 = 7.5; // 빛줄기가 뻗는 거리
    const top = new THREE.Vector3(p.x + nx * 0.2, yTop, p.z + nz * 0.2);
    const foot = new THREE.Vector3(p.x + nx * L6, 0.45, p.z + nz * L6);
    const axis = foot.clone().sub(top).normalize();
    const across = new THREE.Vector3(nz, 0, -nx); // 벽을 따라가는 방향 (창 너비)
    const perp = new THREE.Vector3().crossVectors(axis, across).normalize(); // 축에 수직인 두 번째 폭
    // [폭 방향, 창 쪽 반폭, 바닥 쪽 반폭, 세기] — 두 번째 판은 좁고 옅게 (십자)
    for (const [dir, wTop, wFoot, str] of [[across, 1.25, 1.7, 1], [perp, 0.62, 0.95, 0.55]]) {
      const col = [...shaftCol, 0.075 * str];
      const v = [
        top.clone().addScaledVector(dir, -wTop),
        top.clone().addScaledVector(dir, wTop),
        foot.clone().addScaledVector(dir, wFoot),
        foot.clone().addScaledVector(dir, -wFoot),
      ];
      const k = S.n;
      for (let i = 0; i < 4; i++) {
        S.pos.push(v[i].x, v[i].y, v[i].z);
        S.col.push(col[0], col[1], col[2], col[3]);
      }
      S.uv.push(0, 0, 1, 0, 1, 1, 0, 1); // v=0 창(위), v=1 바닥(아래)
      S.idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
      S.n += 4;
    }
  }
  let shafts = null;
  if (S.n) {
    shafts = new THREE.Mesh(
      geometry(S, true),
      new THREE.MeshBasicMaterial({
        map: shaftTexture(),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    shafts.renderOrder = 3;
    shafts.userData.noInk = true;
    group.add(shafts);
  }

  // ── 3) 떠다니는 불티 ──────────────────────────────────────────
  const er = b ? b.r - 3 : 12;
  const ex = b ? b.x : 0, ez = b ? b.z : 0;
  const base = new Float32Array(EMBERS * 3);
  const seed = new Float32Array(EMBERS * 3);
  const pos = new Float32Array(EMBERS * 3);
  const ecol = new Float32Array(EMBERS * 3);
  const emberCol = rgbOf(L.ember ?? 0xff7a36);
  for (let i = 0; i < EMBERS; i++) {
    const ang = Math.random() * Math.PI * 2, rad = Math.sqrt(Math.random()) * er;
    base[i * 3] = ex + Math.cos(ang) * rad;
    base[i * 3 + 1] = Math.random() * HALL_TOP;
    base[i * 3 + 2] = ez + Math.sin(ang) * rad;
    seed[i * 3] = 0.25 + Math.random() * 0.6; // 위로 뜨는 속도
    seed[i * 3 + 1] = Math.random() * Math.PI * 2; // 흔들림 위상
    seed[i * 3 + 2] = 0.4 + Math.random() * 0.9; // 밝기
    const k = seed[i * 3 + 2];
    ecol[i * 3] = emberCol[0] * k;
    ecol[i * 3 + 1] = emberCol[1] * k;
    ecol[i * 3 + 2] = emberCol[2] * k;
    pos.set([base[i * 3], base[i * 3 + 1], base[i * 3 + 2]], i * 3);
  }
  const egeo = new THREE.BufferGeometry();
  egeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  egeo.setAttribute('color', new THREE.BufferAttribute(ecol, 3));
  const dots = new THREE.Points(
    egeo,
    new THREE.PointsMaterial({
      size: 0.075,
      map: glowTexture('rgba(255,255,255,1)', 'rgba(255,235,210,0.8)', 'rgba(255,170,90,0)'),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      fog: false,
    }),
  );
  dots.userData.noInk = true;
  dots.renderOrder = 4;
  group.add(dots);

  let last = -1;
  return {
    update(time) {
      // 불티: 위로 천천히 떠오르며 좌우로 흔들린다 (꼭대기에서 다시 바닥으로)
      if (last < 0 || time - last > 0.016) {
        last = time;
        const arr = egeo.getAttribute('position').array;
        for (let i = 0; i < EMBERS; i++) {
          const j = i * 3;
          const y = (base[j + 1] + time * seed[j]) % HALL_TOP;
          arr[j] = base[j] + Math.sin(time * 0.55 + seed[j + 1] + y * 0.2) * 0.5;
          arr[j + 1] = y;
          arr[j + 2] = base[j + 2] + Math.cos(time * 0.43 + seed[j + 1] + y * 0.17) * 0.5;
        }
        egeo.getAttribute('position').needsUpdate = true;
      }
      // 빛 웅덩이·빛줄기가 아주 천천히 숨쉬듯 흔들린다 (가짜 빛이 살아 있게)
      pools.material.opacity = 0.92 + Math.sin(time * 1.7) * 0.05;
      if (shafts) shafts.material.opacity = 0.95 + Math.sin(time * 1.3 + 1.2) * 0.05;
    },
    dispose() {
      scene.remove(group);
      group.traverse((o) => {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      });
    },
  };
}
