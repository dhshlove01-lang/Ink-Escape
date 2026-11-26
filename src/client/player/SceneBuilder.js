import * as THREE from 'three';
import { CELL, WALL_H, TILE } from '../../shared/map/GameMap.js';
import { texture, textureFromUrl } from '../render/Images.js';
import { DECALS } from '../../config/assets.js';

// 맵 → 3D 장면. 어두운 낙서 던전 (돌벽 + 분필 낙서 + 횃불).

function rand(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvasTex(size, draw, repeat = [1, 1]) {
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

function doodle(g, r, x, y, s, color) {
  g.strokeStyle = color;
  g.lineWidth = 2 + r() * 2;
  g.lineCap = 'round';
  g.beginPath();
  const kind = Math.floor(r() * 5);
  if (kind === 0) {
    // 소용돌이
    for (let a = 0; a < 14; a += 0.3) g.lineTo(x + Math.cos(a) * a * s * 0.06, y + Math.sin(a) * a * s * 0.06);
  } else if (kind === 1) {
    // 막대 인간
    g.arc(x, y - s * 0.35, s * 0.12, 0, Math.PI * 2);
    g.moveTo(x, y - s * 0.23);
    g.lineTo(x, y + s * 0.15);
    g.lineTo(x - s * 0.15, y + s * 0.4);
    g.moveTo(x, y + s * 0.15);
    g.lineTo(x + s * 0.15, y + s * 0.4);
    g.moveTo(x - s * 0.2, y - s * 0.05);
    g.lineTo(x + s * 0.2, y - s * 0.05);
  } else if (kind === 2) {
    // 뿔 달린 얼굴
    g.arc(x, y, s * 0.22, 0, Math.PI * 2);
    g.moveTo(x - s * 0.15, y - s * 0.15);
    g.lineTo(x - s * 0.25, y - s * 0.4);
    g.lineTo(x - s * 0.05, y - s * 0.2);
    g.moveTo(x + s * 0.15, y - s * 0.15);
    g.lineTo(x + s * 0.25, y - s * 0.4);
    g.lineTo(x + s * 0.05, y - s * 0.2);
    g.moveTo(x - s * 0.12, y + s * 0.08);
    for (let i = 0; i <= 6; i++) g.lineTo(x - s * 0.12 + i * s * 0.04, y + s * (i % 2 ? 0.14 : 0.06));
  } else if (kind === 3) {
    // 엑스 표시
    g.moveTo(x - s * 0.2, y - s * 0.2);
    g.lineTo(x + s * 0.2, y + s * 0.2);
    g.moveTo(x + s * 0.2, y - s * 0.2);
    g.lineTo(x - s * 0.2, y + s * 0.2);
  } else {
    // 지그재그
    g.moveTo(x - s * 0.3, y);
    for (let i = 0; i < 7; i++) g.lineTo(x - s * 0.3 + i * s * 0.1, y + (i % 2 ? -1 : 1) * s * 0.1);
  }
  g.stroke();
}

export function makeTextures() {
  const wall = canvasTex(256, (g, S) => {
    const r = rand(7);
    g.fillStyle = '#3a3742';
    g.fillRect(0, 0, S, S);
    const bh = 32;
    for (let row = 0; row < S / bh; row++) {
      const off = row % 2 ? 32 : 0;
      for (let col = -1; col < S / 64 + 1; col++) {
        const x = col * 64 + off, y = row * bh;
        const v = 62 + Math.floor(r() * 22);
        g.fillStyle = `rgb(${v},${v - 2},${v + 6})`;
        g.fillRect(x + 2, y + 2, 60, bh - 4);
      }
    }
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.25})`;
      g.fillRect(r() * S, r() * S, 2, 2);
    }
    for (let i = 0; i < 5; i++) doodle(g, r, 30 + r() * (S - 60), 30 + r() * (S - 60), 50 + r() * 50, r() < 0.3 ? 'rgba(200,40,50,0.55)' : 'rgba(230,225,215,0.35)');
  }, [1, WALL_H / CELL]);

  const floor = canvasTex(256, (g, S) => {
    const r = rand(11);
    g.fillStyle = '#2a2730';
    g.fillRect(0, 0, S, S);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const v = 48 + Math.floor(r() * 14);
        g.fillStyle = `rgb(${v},${v - 1},${v + 3})`;
        g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
      }
    }
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      let x = r() * S, y = r() * S;
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) g.lineTo((x += (r() - 0.5) * 50), (y += (r() - 0.5) * 50));
      g.stroke();
    }
    if (r() < 0.9) doodle(g, r, S * 0.7, S * 0.3, 70, 'rgba(190,35,45,0.35)');
  }, [1, 1]);

  return { wall, floor };
}

function flameTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 40, 2, 32, 36, 30);
  grad.addColorStop(0, 'rgba(255,245,200,1)');
  grad.addColorStop(0.35, 'rgba(255,160,50,0.9)');
  grad.addColorStop(1, 'rgba(255,60,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const CEILING_LAYER = 1;

export function buildScene(map) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0b12);
  scene.fog = new THREE.Fog(0x0d0b12, 18, 80);

  // 사용자가 뽑은 텍스처가 있으면 그것, 없으면 코드로 그린 텍스처
  const tex = makeTextures();
  const wallTex = texture('tex.wall', { repeat: [1, WALL_H / CELL] }) || tex.wall;
  const pillarTex = texture('tex.pillar', { repeat: [1, WALL_H / CELL] });
  const floorTex = texture('tex.floor', { repeat: [map.worldW / 3, map.worldH / 3] });
  scene.add(new THREE.HemisphereLight(0xa69cd0, 0x3a2c24, 2.4));

  // 바닥
  let fTex = floorTex;
  if (!fTex) {
    fTex = tex.floor.clone();
    fTex.needsUpdate = true;
    fTex.repeat.set(map.w, map.h);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(map.worldW, map.worldH), new THREE.MeshLambertMaterial({ map: fTex }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(map.worldW / 2, 0, map.worldH / 2);
  scene.add(floor);

  // 천장: 플레이어 화면에만 (레이어 1). 술래 구석 카메라는 벽 위에서 내려다보므로 레이어 0 만 본다.
  const ceilTex = texture('tex.pillar', { repeat: [map.worldW / 4, map.worldH / 4] }) || texture('tex.wall', { repeat: [map.worldW / 4, map.worldH / 4] });
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(map.worldW, map.worldH),
    new THREE.MeshLambertMaterial({ map: ceilTex, color: ceilTex ? 0x7a7088 : 0x2a2630 }),
  );
  ceiling.rotation.x = Math.PI / 2; // 아래를 바라봄
  ceiling.position.set(map.worldW / 2, WALL_H, map.worldH / 2);
  ceiling.layers.set(CEILING_LAYER);
  scene.add(ceiling);

  // 벽 (바닥과 닿은 벽만)
  const wallCells = [];
  const pillarCells = [];
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const t = map.tile(x, y);
      if (t === TILE.PILLAR) pillarCells.push([x, y]);
      if (t !== TILE.WALL) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) {
        const n = map.tile(x + dx, y + dy);
        if (n === TILE.FLOOR || n === TILE.PILLAR) near = true;
      }
      if (near) wallCells.push([x, y]);
    }
  }
  const box = new THREE.BoxGeometry(CELL, WALL_H, CELL);
  const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
  const walls = new THREE.InstancedMesh(box, wallMat, wallCells.length);
  const m4 = new THREE.Matrix4();
  wallCells.forEach(([x, y], i) => walls.setMatrixAt(i, m4.makeTranslation((x + 0.5) * CELL, WALL_H / 2, (y + 0.5) * CELL)));
  scene.add(walls);

  const pillarMat = pillarTex ? new THREE.MeshLambertMaterial({ map: pillarTex }) : new THREE.MeshLambertMaterial({ map: tex.wall, color: 0xb9b0c8 });
  const pillars = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL * 0.9, WALL_H, CELL * 0.9), pillarMat, pillarCells.length);
  pillarCells.forEach(([x, y], i) => pillars.setMatrixAt(i, m4.makeTranslation((x + 0.5) * CELL, WALL_H / 2, (y + 0.5) * CELL)));
  scene.add(pillars);

  // 탈출 문 (붉은 쇠창살)
  const doors = map.doors.map((d) => {
    const g = new THREE.Group();
    const barMat = new THREE.MeshBasicMaterial({ color: 0xc8283a });
    const xs = d.cells.map((c) => c[0]), ys = d.cells.map((c) => c[1]);
    const minX = Math.min(...xs) * CELL, maxX = (Math.max(...xs) + 1) * CELL;
    const minZ = Math.min(...ys) * CELL, maxZ = (Math.max(...ys) + 1) * CELL;
    const horizontal = d.dir.z !== 0;
    const len = horizontal ? maxX - minX : maxZ - minZ;
    const n = Math.round(len / 0.6);
    const along = horizontal ? 'x' : 'z';
    const fixed = horizontal ? (d.dir.z < 0 ? maxZ - 0.3 : minZ + 0.3) : d.dir.x < 0 ? maxX - 0.3 : minX + 0.3;
    for (let i = 0; i <= n; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, WALL_H * 0.8, 0.12), barMat);
      const p = (horizontal ? minX : minZ) + (i / n) * len;
      bar.position.set(along === 'x' ? p : fixed, WALL_H * 0.4, along === 'z' ? p : fixed);
      g.add(bar);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? len : 0.3, 0.3, horizontal ? 0.3 : len), barMat);
    beam.position.set(horizontal ? (minX + maxX) / 2 : fixed, WALL_H * 0.8, horizontal ? fixed : (minZ + maxZ) / 2);
    g.add(beam);
    // 문 바닥 (벽 대신 보이는 어두운 통로)
    const gap = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ), new THREE.MeshBasicMaterial({ color: 0x050407 }));
    gap.rotation.x = -Math.PI / 2;
    gap.position.set((minX + maxX) / 2, 0.01, (minZ + maxZ) / 2);
    scene.add(gap);
    scene.add(g);
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 40, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff3048, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    pillar.position.set(d.center.x, 20, d.center.z);
    scene.add(pillar);
    return { bars: g, pillar, lightPos: new THREE.Vector3(d.center.x - d.dir.x * 3, 3, d.center.z - d.dir.z * 3) };
  });
  // 문 조명은 하나만 (예고된 문으로 옮긴다). 조명 개수가 바뀌면 셰이더를 다시 만들어 끊기므로 개수는 고정.
  const doorLight = new THREE.PointLight(0xff3048, 0, 26, 1.4);
  scene.add(doorLight);

  // 횃불: 벽에 붙은 받침 + 비스듬한 손잡이 + 불꽃. 불꽃 그림은 모두, 실제 빛은 카메라에서 가까운 몇 개만.
  const flameTex = flameTexture();
  const ironMat = new THREE.MeshLambertMaterial({ color: 0x2e2622 });
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x4a3020 });
  const plateGeo = new THREE.BoxGeometry(0.32, 0.5, 0.06);
  const armGeo = new THREE.CylinderGeometry(0.045, 0.035, 0.55, 8);
  const cupGeo = new THREE.CylinderGeometry(0.13, 0.07, 0.16, 10);
  const torches = map.torches.map((t, i) => {
    const g = new THREE.Group();
    g.position.set(t.x, 3.0, t.z);
    g.rotation.y = Math.atan2(t.nx, t.nz); // 로컬 +Z 가 방 안쪽
    const plate = new THREE.Mesh(plateGeo, ironMat);
    plate.position.set(0, 0, 0.03);
    const arm = new THREE.Mesh(armGeo, woodMat);
    arm.rotation.x = 0.6; // 위로 비스듬히 벽에서 나옴
    arm.position.set(0, 0.2, 0.2);
    const cup = new THREE.Mesh(cupGeo, ironMat);
    cup.position.set(0, 0.45, 0.36);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false }));
    flame.scale.set(0.7, 0.9, 1);
    flame.position.set(0, 0.82, 0.38);
    g.add(plate, arm, cup, flame);
    scene.add(g);
    const tip = new THREE.Vector3(t.x + t.nx * 0.9, 3.75, t.z + t.nz * 0.9);
    return { flame, tip, phase: i * 1.7 };
  });
  const TORCH_LIGHTS = 4;
  const pool = Array.from({ length: TORCH_LIGHTS }, () => {
    const l = new THREE.PointLight(0xff9a4a, 0, 30, 1.5);
    scene.add(l);
    return l;
  });

  addDecals(scene, map);

  return {
    scene,
    // camPos: 이 카메라에서 가까운 횃불 몇 개에만 실제 빛을 옮겨 단다
    update(time, camPos) {
      for (const t of torches) {
        t.f = 0.85 + Math.sin(time * 9 + t.phase) * 0.08 + Math.sin(time * 23 + t.phase * 2) * 0.05;
        t.flame.scale.set(0.7 * t.f, 0.95 * t.f, 1);
        t.d = camPos ? t.tip.distanceToSquared(camPos) : 0;
      }
      const near = camPos ? [...torches].sort((a, b) => a.d - b.d) : torches;
      pool.forEach((l, k) => {
        const t = near[k];
        if (!t) return (l.intensity = 0);
        l.position.copy(t.tip);
        l.intensity = 70 * t.f;
      });
    },
    revealDoor(i) {
      const d = doors[i];
      if (!d) return;
      d.pillar.material.opacity = 0.18;
      doorLight.position.copy(d.lightPos);
      doorLight.intensity = 60;
    },
    openDoor(i) {
      const d = doors[i];
      if (!d) return;
      d.bars.visible = false;
      d.pillar.material.color.set(0x7dffb0);
      d.pillar.material.opacity = 0.25;
      doorLight.position.copy(d.lightPos);
      doorLight.color.set(0x9dffc0);
      doorLight.intensity = 90;
    },
    doors,
  };
}

// 벽(방 안쪽 면)과 바닥에 분필·빨간 낙서를 흩뿌린다. 같은 맵이면 모두에게 같은 자리 (고정 시드).
function addDecals(scene, map) {
  if (!map.rooms?.length) return;
  const r = rand(23);
  const pick = (list) => list[Math.floor(r() * list.length)];
  const jobs = [];
  for (const room of map.rooms) {
    // 네 벽: [면 위치, 방향] — 면 바로 바깥 칸이 벽일 때만 붙인다 (통로 구멍엔 안 붙임)
    const faces = [
      { axis: 'z', at: room.z0, out: -1, from: room.x0, to: room.x1, rotY: 0 },
      { axis: 'z', at: room.z1, out: 1, from: room.x0, to: room.x1, rotY: Math.PI },
      { axis: 'x', at: room.x0, out: -1, from: room.z0, to: room.z1, rotY: Math.PI / 2 },
      { axis: 'x', at: room.x1, out: 1, from: room.z0, to: room.z1, rotY: -Math.PI / 2 },
    ];
    for (const f of faces) {
      const n = 1 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        const chalk = r() < 0.65;
        const size = chalk ? 1.1 + r() * 0.9 : 0.9 + r() * 0.7;
        const half = size / 2 + 0.3; // 낙서 반폭 + 여유 (기울기 포함)
        const t = f.from + half + r() * Math.max(0, f.to - f.from - half * 2);
        // 낙서 폭 전체 뒤가 "진짜 벽"이어야 붙인다: 통로 구멍·모서리 밖·탈출 문(닫혀 있어도 벽 아님) 제외
        let ok = true;
        for (let u = t - half; u <= t + half + 1e-6 && ok; u += 0.25) {
          const wx = f.axis === 'z' ? u : f.at + f.out * 0.5;
          const wz = f.axis === 'z' ? f.at + f.out * 0.5 : u;
          ok = map.tile(Math.floor(wx / CELL), Math.floor(wz / CELL)) === TILE.WALL;
        }
        if (!ok) continue;
        const px = f.axis === 'z' ? t : f.at - f.out * 0.03;
        const pz = f.axis === 'z' ? f.at - f.out * 0.03 : t;
        jobs.push({ url: pick(chalk ? DECALS.chalk : DECALS.red), size, pos: [px, 1.4 + r() * 3, pz], rot: [0, f.rotY, (r() - 0.5) * 0.5] });
      }
    }
    // 바닥 빨간 낙서
    for (let i = 0; i < 2; i++) {
      const x = room.x0 + 2 + r() * (room.x1 - room.x0 - 4);
      const z = room.z0 + 2 + r() * (room.z1 - room.z0 - 4);
      const fs = 1.2 + r() * 1.2;
      const h = fs * 0.75; // 회전해도 들어가게 대각선 반쯤
      if (![[-h, -h], [h, -h], [-h, h], [h, h], [0, 0]].every(([dx, dz]) => map.isFloor(x + dx, z + dz))) continue;
      jobs.push({ url: pick(DECALS.red), size: fs, pos: [x, 0.02, z], rot: [-Math.PI / 2, 0, r() * Math.PI * 2], floor: true });
    }
  }
  const geo = new THREE.PlaneGeometry(1, 1);
  for (const j of jobs) {
    textureFromUrl(j.url).then((tex) => {
      if (!tex) return;
      const aspect = tex.image.width / tex.image.height;
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, opacity: j.floor ? 0.75 : 0.9 }),
      );
      m.scale.set(j.size * Math.min(1, aspect), j.size / Math.max(1, aspect), 1);
      m.position.set(...j.pos);
      m.rotation.set(...j.rot, j.floor ? 'XYZ' : 'YXZ');
      m.renderOrder = 1;
      scene.add(m);
    });
  }
}
