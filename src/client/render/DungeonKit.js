import * as THREE from 'three';
import { CELL, TILE } from '../../shared/map/GameMap.js';

// 던전 소품·재질 키트. SceneBuilder(1인칭/구석 카메라)와 TopDownMap(술래 탑뷰)이
// 같은 배치(planProps)를 쓰도록 여기 한 곳에 모은다.
// 원칙: 이미지가 없어도 코드 그리기로 항상 무언가가 나온다.

export function rand(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// 2D 탑뷰에서 쓰는 결정적 해시 (0~1)
export function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function canvasTex(size, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// 밝은 곳이 볼록하게 보이도록 노멀맵을 만든다 (돌 표면의 요철감).
export function normalMapFrom(image, strength = 1.7, size = 256) {
  if (!image) return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.drawImage(image, 0, 0, size, size);
  let src;
  try {
    src = g.getImageData(0, 0, size, size).data;
  } catch {
    return null;
  }
  const h = new Float32Array(size * size);
  for (let i = 0, p = 0; i < h.length; i++, p += 4) h[i] = (src[p] * 0.3 + src[p + 1] * 0.55 + src[p + 2] * 0.15) / 255;
  const out = new Uint8ClampedArray(size * size * 4);
  const at = (x, y) => h[(y & (size - 1)) * size + (x & (size - 1))];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x - 1, y) - at(x + 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const p = (y * size + x) * 4;
      out[p] = ((dx / l) * 0.5 + 0.5) * 255;
      out[p + 1] = ((dy / l) * 0.5 + 0.5) * 255;
      out[p + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      out[p + 3] = 255;
    }
  }
  const nc = document.createElement('canvas');
  nc.width = nc.height = size;
  nc.getContext('2d').putImageData(new ImageData(out, size, size), 0, 0);
  const t = new THREE.CanvasTexture(nc);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// 부드러운 빛무리 (불꽃 번짐용)
export function glowTexture(inner = 'rgba(255,236,190,1)', mid = 'rgba(255,150,50,0.65)', outer = 'rgba(255,80,10,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 1, 64, 64, 64);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.3, mid);
  gr.addColorStop(1, outer);
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 크레용으로 문지른 듯한 자국 (자물쇠 뒤 붉은 광채)
export function crayonGlowTexture(color = '255,45,60') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = rand(77);
  g.translate(128, 128);
  for (let i = 0; i < 26; i++) {
    const rad = 46 + r() * 66;
    const a0 = r() * Math.PI * 2;
    const a1 = a0 + 0.7 + r() * 1.9;
    g.strokeStyle = `rgba(${color},${0.05 + r() * 0.13})`;
    g.lineWidth = 2 + r() * 6;
    g.beginPath();
    g.arc(0, 0, rad, a0, a1);
    g.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, rad = 40 + r() * 70;
    g.strokeStyle = `rgba(${color},${0.06 + r() * 0.16})`;
    g.lineWidth = 1.5 + r() * 4;
    g.beginPath();
    g.moveTo(Math.cos(a) * rad * 0.4, Math.sin(a) * rad * 0.4);
    g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    g.stroke();
  }
  const gr = g.createRadialGradient(0, 0, 4, 0, 0, 120);
  gr.addColorStop(0, `rgba(${color},0.34)`);
  gr.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gr;
  g.fillRect(-128, -128, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function woodTexture(dark = false) {
  return canvasTex(128, (g, S) => {
    const r = rand(dark ? 55 : 33);
    g.fillStyle = dark ? '#2b1c13' : '#43301f';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 9; i++) {
      const y = (i / 9) * S;
      const v = (dark ? 46 : 74) + r() * 22;
      g.fillStyle = `rgb(${v},${v * 0.68},${v * 0.42})`;
      g.fillRect(0, y + 1, S, S / 9 - 2);
    }
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    for (let i = 0; i < 26; i++) {
      const y = r() * S;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(r() * S, y);
      g.lineTo(r() * S, y + (r() - 0.5) * 6);
      g.stroke();
    }
  }, [1, 1]);
}

function bannerTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 240;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 240);
  gr.addColorStop(0, '#3d2456');
  gr.addColorStop(1, '#1c0f2c');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 232);
  // 아래는 찢어진 천
  g.beginPath();
  g.moveTo(0, 232);
  for (let x = 0; x <= 128; x += 16) g.lineTo(x, 232 - (x % 32 ? 14 : 30));
  g.lineTo(128, 232);
  g.lineTo(128, 240);
  g.lineTo(0, 240);
  g.closePath();
  g.fillStyle = '#1c0f2c';
  g.fill();
  // 천 테두리
  g.strokeStyle = 'rgba(140,110,190,0.5)';
  g.lineWidth = 3;
  g.strokeRect(6, 6, 116, 218);
  // 분필 왕관 + 낙서
  const r = rand(909);
  g.strokeStyle = 'rgba(226,220,236,0.85)';
  g.lineWidth = 3;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(34, 110);
  g.lineTo(34, 62);
  g.lineTo(52, 86);
  g.lineTo(64, 54);
  g.lineTo(76, 86);
  g.lineTo(94, 62);
  g.lineTo(94, 110);
  g.closePath();
  g.stroke();
  g.strokeStyle = 'rgba(220,40,55,0.75)';
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.moveTo(20 + r() * 88, 128 + r() * 80);
    g.lineTo(20 + r() * 88, 128 + r() * 80);
    g.stroke();
  }
  g.strokeStyle = 'rgba(226,220,236,0.5)';
  g.beginPath();
  g.moveTo(26, 150);
  for (let i = 0; i < 8; i++) g.lineTo(26 + i * 10, 150 + (i % 2 ? -8 : 8));
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 벽에 붙는 자리: 방의 네 면. (axis, at, out, from, to)
export function roomFaces(room) {
  return [
    { axis: 'z', at: room.z0, out: -1, from: room.x0, to: room.x1, ry: 0 },              // 북쪽 벽 (안쪽은 +z)
    { axis: 'z', at: room.z1, out: 1, from: room.x0, to: room.x1, ry: Math.PI },        // 남쪽 벽 (안쪽은 -z)
    { axis: 'x', at: room.x0, out: -1, from: room.z0, to: room.z1, ry: Math.PI / 2 },   // 서쪽 벽 (안쪽은 +x)
    { axis: 'x', at: room.x1, out: 1, from: room.z0, to: room.z1, ry: -Math.PI / 2 },   // 동쪽 벽 (안쪽은 -x)
  ];
}

// 소품·배너·벽사슬 배치. 같은 맵이면 모두에게 같은 자리 (고정 시드).
export function planProps(map) {
  const r = rand(20817);
  const props = [];
  const far = (x, z, dist) => {
    if (!map.isFloor(x, z)) return false;
    if (Math.hypot(x - map.spawn.x, z - map.spawn.z) < 4) return false;
    for (const d of map.doors) if (Math.hypot(x - d.center.x, z - d.center.z) < 5) return false;
    for (const p of props) if (Math.hypot(p.x - x, p.z - z) < 1.6) return false;
    return true;
  };
  for (const room of map.rooms) {
    const faces = roomFaces(room);
    // 바닥 소품 (벽에 붙여서)
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const f = faces[Math.floor(r() * 4)];
      const t = f.from + 1.8 + r() * Math.max(0.1, f.to - f.from - 3.6);
      const x = f.axis === 'z' ? t : f.at + f.out * 1.0;
      const z = f.axis === 'z' ? f.at + f.out * 1.0 : t;
      if (!far(x, z)) continue;
      const pick = r();
      const kind = pick < 0.42 ? 'barrel' : pick < 0.78 ? 'crate' : 'rubble';
      props.push({ kind, x, z, ry: r() * Math.PI * 2, s: 0.85 + r() * 0.3 });
    }
    // 벽 배너: 뒤가 끝까지 진짜 벽이고(통로·문 아님), 문 장식(아치)·횃불·다른 배너와 안 겹칠 때만
    if (r() < 0.62) {
      const f = faces[Math.floor(r() * 4)];
      const t = f.from + 2.4 + r() * Math.max(0.1, f.to - f.from - 4.8);
      const x = f.axis === 'z' ? t : f.at - f.out * 0.1;
      const z = f.axis === 'z' ? f.at - f.out * 0.1 : t;
      const s = 0.9 + r() * 0.25;
      const y = 3.7 + r() * 0.5;
      if (bannerFits(map, f, t, 0.9 * s, props)) props.push({ kind: 'banner', x, z, ry: f.ry, s, y });
    }
    // 벽에 걸린 사슬
    if (r() < 0.45) {
      const f = faces[Math.floor(r() * 4)];
      const t = f.from + 2 + r() * Math.max(0.1, f.to - f.from - 4);
      const x = f.axis === 'z' ? t : f.at - f.out * 0.12;
      const z = f.axis === 'z' ? f.at - f.out * 0.12 : t;
      const nearDoor = map.doors.some((d) => Math.hypot(x - d.center.x, z - d.center.z) < 7);
      if (!nearDoor) props.push({ kind: 'wallchain', x, z, ry: f.ry, s: 0.9 + r() * 0.3, y: 3.4 + r() * 0.9 });
    }
  }
  return props;
}

// 배너(반폭 half)가 이 벽면 자리에 깔끔히 걸리나
function bannerFits(map, f, t, half, props) {
  const at = (u, depth) => (f.axis === 'z' ? [u, f.at + f.out * depth] : [f.at + f.out * depth, u]);
  for (const u of [t - half - 0.2, t, t + half + 0.2]) {
    const [bx, bz] = at(u, 0.5); // 벽 안쪽
    const [fx, fz] = at(u, -0.6); // 방 쪽
    if (map.tile(Math.floor(bx / CELL), Math.floor(bz / CELL)) !== TILE.WALL) return false;
    if (!map.isFloor(fx, fz)) return false;
  }
  const [x, z] = at(t, 0);
  if (map.doors.some((d) => Math.hypot(x - d.center.x, z - d.center.z) < 8)) return false; // 탈출문 아치 근처
  if (map.torches.some((tc) => Math.hypot(x - tc.x, z - tc.z) < half + 1.2)) return false;
  if (props.some((p) => p.kind === 'banner' && Math.hypot(x - p.x, z - p.z) < 3)) return false;
  return true;
}

// 벽 윗면·기둥 머리용: 낙서 없는 무늬 돌
function capTexture() {
  return canvasTex(128, (g, S) => {
    const r = rand(71);
    g.fillStyle = '#272231';
    g.fillRect(0, 0, S, S);
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        const v = 44 + r() * 16;
        g.fillStyle = `rgb(${v + 4},${v},${v + 12})`;
        g.fillRect(i * 32 + 1, j * 32 + 1, 30, 30);
        g.fillStyle = 'rgba(180,170,210,0.12)';
        g.fillRect(i * 32 + 1, j * 32 + 1, 30, 1);
      }
    }
    for (let i = 0; i < 120; i++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.3})`;
      g.fillRect(r() * S, r() * S, 2, 2);
    }
  }, [2, 2]);
}

// 재질·지오메트리 묶음
export function createDungeonKit({ wallTex, floorTex, pillarTex }) {
  const capTex = capTexture();
  const stoneNormal = normalMapFrom(wallTex?.image || null, 1.8);
  const floorNormal = normalMapFrom(floorTex?.image || null, 1.4);

  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x07050a, side: THREE.BackSide });
  const mats = {
    stone: new THREE.MeshLambertMaterial({ map: wallTex, normalMap: stoneNormal, color: 0xe6dcf4 }),
    stoneTop: new THREE.MeshLambertMaterial({ map: capTex, color: 0xd8cfe8 }),
    stoneDark: new THREE.MeshLambertMaterial({ color: 0x1c1826 }),
    trim: new THREE.MeshLambertMaterial({ map: capTex, color: 0x9c8fb8 }),
    // 천장: 낙서 없는 어두운 돌 (아래에서 올려다볼 때만 보임)
    ceiling: new THREE.MeshLambertMaterial({ map: capTex.clone(), color: 0x585070 }),
    pillar: new THREE.MeshLambertMaterial({
      map: pillarTex || wallTex,
      normalMap: stoneNormal,
      color: 0xf0e6ff,
    }),
    floor: new THREE.MeshLambertMaterial({ map: floorTex, normalMap: floorNormal, color: 0xffffff }),
    wood: new THREE.MeshLambertMaterial({ map: woodTexture(false) }),
    woodDark: new THREE.MeshLambertMaterial({ map: woodTexture(true) }),
    iron: new THREE.MeshLambertMaterial({ color: 0x2a2733 }),
    ironWarm: new THREE.MeshLambertMaterial({ color: 0x4a3b33 }),
    cloth: new THREE.MeshLambertMaterial({ map: bannerTexture(), side: THREE.DoubleSide, transparent: true }),
    outline: outlineMat,
  };

  const geos = {
    barrel: barrelGeometry(),
    ring: new THREE.TorusGeometry(0.4, 0.035, 5, 12),
    crate: new THREE.BoxGeometry(0.86, 0.86, 0.86),
    rubble: new THREE.DodecahedronGeometry(0.34, 0),
    link: new THREE.TorusGeometry(0.15, 0.042, 5, 9),
    banner: new THREE.PlaneGeometry(1.5, 2.6),
    rod: new THREE.CylinderGeometry(0.05, 0.05, 1.75, 6),
    chain: new THREE.TorusGeometry(0.115, 0.03, 5, 8),
    wallLink: new THREE.TorusGeometry(0.085, 0.026, 4, 7),
  };

  return { mats, geos, stoneNormal, floorNormal };
}

// 가운데가 불룩한 통
function barrelGeometry() {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const r = 0.33 + Math.sin(t * Math.PI) * 0.085;
    pts.push(new THREE.Vector2(r, t * 0.98));
  }
  const g = new THREE.LatheGeometry(pts, 12);
  g.computeVertexNormals();
  return g;
}

// 소품 배치 → 인스턴스로 그린다 (그리기 호출 수를 아낀다)
export function buildProps(scene, kit, map) {
  const plan = planProps(map);
  const { mats, geos } = kit;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const put = (list, x, z, ry, s, y = 0) => list.push({ x, z, ry, s, y });

  const barrels = [], crates = [], rubble = [], banners = [], wallchains = [];
  for (const p of plan) {
    if (p.kind === 'barrel') put(barrels, p.x, p.z, p.ry, p.s);
    else if (p.kind === 'crate') put(crates, p.x, p.z, p.ry, p.s);
    else if (p.kind === 'rubble') put(rubble, p.x, p.z, p.ry, p.s);
    else if (p.kind === 'banner') put(banners, p.x, p.z, p.ry, p.s, p.y);
    else if (p.kind === 'wallchain') put(wallchains, p.x, p.z, p.ry, p.s, p.y);
  }

  const mesh = (geo, mat, count, matrixAt, outline = 0) => {
    if (!count) return;
    const im = new THREE.InstancedMesh(geo, mat, count);
    for (let i = 0; i < count; i++) im.setMatrixAt(i, matrixAt(i));
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
    if (outline) {
      const om = new THREE.InstancedMesh(geo, mats.outline, count);
      for (let i = 0; i < count; i++) {
        const base = matrixAt(i);
        sc.set(outline, outline, outline);
        m4.copy(base).scale(sc);
        om.setMatrixAt(i, m4);
      }
      om.instanceMatrix.needsUpdate = true;
      scene.add(om);
    }
  };

  // 통: 몸통 + 테 3개
  mesh(geos.barrel, mats.woodDark, barrels.length, (i) => {
    const b = barrels[i];
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.ry);
    return m4.compose(v.set(b.x, b.y, b.z), q, sc.set(b.s, b.s, b.s));
  }, 1.06);
  mesh(geos.ring, mats.iron, barrels.length * 3, (i) => {
    const b = barrels[(i / 3) | 0];
    const y = 0.18 + (i % 3) * 0.3;
    const rr = 0.33 + Math.sin((y / 0.98) * Math.PI) * 0.085 + 0.02;
    q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    return m4.compose(v.set(b.x, b.y + y * b.s, b.z), q, sc.set((rr / 0.4) * b.s, (rr / 0.4) * b.s, b.s));
  });

  // 나무 상자
  mesh(geos.crate, mats.wood, crates.length, (i) => {
    const c = crates[i];
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.ry);
    return m4.compose(v.set(c.x, 0.44 * c.s, c.z), q, sc.set(c.s, c.s, c.s));
  }, 1.05);

  // 잔돌
  mesh(geos.rubble, mats.stoneTop, rubble.length * 2, (i) => {
    const b = rubble[(i / 2) | 0];
    const k = 1 - (i % 2) * 0.4;
    q.setFromEuler(new THREE.Euler(b.ry * k, b.ry * 1.7, b.ry * 0.6));
    return m4.compose(
      v.set(b.x + (i % 2 ? 0.34 : -0.2) * b.s, 0.12 * b.s, b.z + (i % 2 ? -0.24 : 0.2) * b.s),
      q,
      sc.set(b.s * k, b.s * k * 0.7, b.s * k),
    );
  }, 1.12);

  // 배너 + 막대
  for (const b of banners) {
    const g = new THREE.Group();
    const cloth = new THREE.Mesh(geos.banner, mats.cloth);
    cloth.position.y = -1.35;
    const rod = new THREE.Mesh(geos.rod, mats.ironWarm);
    rod.rotation.z = Math.PI / 2;
    rod.position.y = 0.05;
    g.add(cloth, rod);
    g.position.set(b.x, b.y, b.z);
    g.rotation.y = b.ry;
    g.scale.setScalar(b.s);
    scene.add(g);
  }

  // 벽에 걸린 사슬 (아래로 축 늘어짐)
  for (const w of wallchains) {
    const n = 9;
    const im = new THREE.InstancedMesh(geos.wallLink, mats.iron, n);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const sway = Math.sin(t * 3.2) * 0.12;
      q.setFromEuler(new THREE.Euler(i % 2 ? Math.PI / 2 : 0, 0, sway));
      m4.compose(v.set(w.x + sway * 0.5, w.y - t * 1.25, w.z), q, sc.set(1, 1, 1));
      im.setMatrixAt(i, m4);
    }
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
  }

  return plan;
}

// 바닥에 큰 빨간 크레용 원 (중앙 홀). 참고 이미지의 바닥 낙서.
export function buildRuneCircle(scene, x, z, radius = 6.2) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const r = rand(4242);
  g.translate(256, 256);
  g.lineCap = 'round';
  const ring = (rad, w, a) => {
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = `rgba(198,26,42,${a})`;
      g.lineWidth = w + r() * 2;
      g.beginPath();
      g.arc((r() - 0.5) * 6, (r() - 0.5) * 6, rad + (r() - 0.5) * 5, r() * 0.4, Math.PI * 2 + r() * 0.3);
      g.stroke();
    }
  };
  ring(226, 5, 0.5);
  ring(186, 3, 0.38);
  // 별 모양
  g.strokeStyle = 'rgba(198,26,42,0.42)';
  g.lineWidth = 4;
  g.beginPath();
  for (let i = 0; i <= 5; i++) {
    const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const px = Math.cos(a) * 176, py = Math.sin(a) * 176;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.stroke();
  // 삐뚤빼뚤 낙서
  for (let i = 0; i < 30; i++) {
    const a = r() * Math.PI * 2, rad = 40 + r() * 180;
    g.strokeStyle = `rgba(198,26,42,${0.1 + r() * 0.28})`;
    g.lineWidth = 1.5 + r() * 3;
    g.beginPath();
    g.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    g.lineTo(Math.cos(a + 0.2) * (rad + 20), Math.sin(a + 0.2) * (rad + 20));
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.72, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.025, z);
  m.renderOrder = 1;
  scene.add(m);
  return m;
}

// 횃불 한 자리: 벽 받침 + 비스듬한 손잡이 + 잔 + 불꽃 + 빛무리 (실제 빛은 SceneBuilder 가 가까운 것에만)
export function buildTorch(kit, tex, t, i) {
  const { mats } = kit;
  const g = new THREE.Group();
  g.position.set(t.x, 3.0, t.z);
  g.rotation.y = Math.atan2(t.nx || 0, t.nz || 1); // 로컬 +Z 가 방 안쪽
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.5, 0.06), mats.ironWarm);
  plate.position.set(0, 0, 0.03);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.55, 8), mats.woodDark);
  arm.rotation.x = 0.6;
  arm.position.set(0, 0.2, 0.2);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.07, 0.16, 10), mats.ironWarm);
  cup.position.set(0, 0.45, 0.36);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.flame, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  flame.scale.set(0.7, 0.95, 1);
  flame.position.set(0, 0.82, 0.38);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: 0xffa050, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45 }));
  glow.scale.set(3.8, 3.8, 1);
  glow.position.set(0, 0.8, 0.4);
  g.add(plate, arm, cup, flame, glow);
  const tip = new THREE.Vector3(t.x + (t.nx || 0) * 0.9, 3.8, t.z + (t.nz || 1) * 0.9);
  return { group: g, flame, glow, tip, phase: i * 1.7 };
}
