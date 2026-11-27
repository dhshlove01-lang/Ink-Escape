import * as THREE from 'three';
import { themeFor } from '../../config/themes.js';
import { gfx } from '../render/GraphicsSettings.js';
import { CELL, WALL_H, TILE } from '../../shared/map/GameMap.js';
import { texture, textureFromUrl } from '../render/Images.js';
import { DECALS } from '../../config/assets.js';
import {
  canvasTex, rand, createDungeonKit, buildProps, buildTorch, buildRuneCircle, glowTexture,
} from '../render/DungeonKit.js';
import { EscapeGate } from '../render/EscapeGate.js';
import { buildRoundHall, buildMapProps } from '../render/PalaceBuilder.js';
import { placeModel } from '../render/MapModels.js';

// 맵 → 3D 장면. 어두운 낙서 던전 (돌벽 + 분필 낙서 + 횃불 + 소품 + 탈출문).

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

export function flameTexture() {
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
  const theme = themeFor(map.id); // 맵 겉모습 (config/themes.js — 로비 배경도 같은 테마)
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.background);
  scene.fog = new THREE.Fog(theme.fog.color, theme.fog.near, theme.fog.far);

  // 사용자가 뽑은 텍스처가 있으면 그것, 없으면 코드로 그린 텍스처
  const tex = makeTextures();
  const wallTex = texture(theme.tex.wall, { repeat: [1, WALL_H / CELL] }) || tex.wall;
  const pillarTex = texture(theme.tex.pillar, { repeat: [1, WALL_H / CELL] });
  const floorTex = texture(theme.tex.floor, { repeat: [map.worldW / 3, map.worldH / 3] }) || tex.floor;
  const kit = createDungeonKit({ wallTex, floorTex, pillarTex });

  // 은은한 기본광 + 위에서 내리쬐는 차가운 림 라이트 (횃불이 주인공)
  scene.add(new THREE.HemisphereLight(theme.hemi.sky, theme.hemi.ground, theme.hemi.intensity));
  const rim = new THREE.DirectionalLight(0x8e7ae0, 0.55);
  rim.position.set(-0.4, 1, 0.55);
  scene.add(rim);
  const warmFill = new THREE.DirectionalLight(0xff8a4a, 0.18);
  warmFill.position.set(0.5, 0.35, -0.8);
  scene.add(warmFill);

  // 둥근 맵(궁전): 바닥·천장·둥근 벽은 PalaceBuilder, 안쪽 벽만 아래 상자로
  const round = map.bounds ? buildRoundHall(scene, map, theme, kit, CEILING_LAYER) : null;

  // 바닥
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(map.worldW, map.worldH), kit.mats.floor);
  floor.visible = !round;
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(map.worldW / 2, 0, map.worldH / 2);
  scene.add(floor);

  // 천장: 플레이어 화면에만 (레이어 1). 술래 구석 카메라는 벽 위에서 내려다보므로 레이어 0 만 본다.
  const ceilTex = kit.mats.ceiling.map;
  ceilTex.repeat.set(map.worldW / 5, map.worldH / 5);
  ceilTex.needsUpdate = true;
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(map.worldW, map.worldH), kit.mats.ceiling);
  ceiling.rotation.x = Math.PI / 2; // 아래를 바라봄
  ceiling.position.set(map.worldW / 2, WALL_H, map.worldH / 2);
  ceiling.layers.set(CEILING_LAYER);
  ceiling.visible = !round;
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
      if (near && !round) wallCells.push([x, y]);
    }
  }
  if (round) wallCells.push(...round.cells);
  const wallMat = round?.wallMat || kit.mats.stone;
  const box = new THREE.BoxGeometry(CELL, WALL_H, CELL);
  const walls = new THREE.InstancedMesh(box, wallMat, wallCells.length);
  const m4 = new THREE.Matrix4();
  wallCells.forEach(([x, y], i) => walls.setMatrixAt(i, m4.makeTranslation((x + 0.5) * CELL, WALL_H / 2, (y + 0.5) * CELL)));
  scene.add(walls);

  // 벽 윗면 캡 (탑뷰·구석 카메라에서 두께가 읽히게) + 걸레받이 + 굵은 검은 외곽선
  const cap = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL + 0.12, 0.34, CELL + 0.12), kit.mats.stoneTop, wallCells.length);
  wallCells.forEach(([x, y], i) => cap.setMatrixAt(i, m4.makeTranslation((x + 0.5) * CELL, WALL_H, (y + 0.5) * CELL)));
  scene.add(cap);
  const skirt = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL + 0.04, 0.85, CELL + 0.04), kit.mats.stoneDark, wallCells.length);
  wallCells.forEach(([x, y], i) => skirt.setMatrixAt(i, m4.makeTranslation((x + 0.5) * CELL, 0.42, (y + 0.5) * CELL)));
  scene.add(skirt);
  const sc = new THREE.Vector3(1.035, 1.005, 1.035);
  const om = new THREE.Matrix4();
  const outline = new THREE.InstancedMesh(box, kit.mats.outline, wallCells.length);
  wallCells.forEach(([x, y], i) => {
    om.makeTranslation((x + 0.5) * CELL, WALL_H / 2, (y + 0.5) * CELL).scale(sc);
    outline.setMatrixAt(i, om);
  });
  scene.add(outline);

  // 기둥: 테마가 GLB 기둥을 주면 그것(천장까지 늘림), 아니면 돌 상자 기둥
  if (theme.models?.pillar) {
    for (const [x, y] of pillarCells) {
      const p = placeModel(theme.models.pillar, {
        fit: { x: CELL * 0.95, y: WALL_H },
        fallback: new THREE.Mesh(new THREE.CylinderGeometry(CELL * 0.4, CELL * 0.45, WALL_H, 12).translate(0, WALL_H / 2, 0), kit.mats.pillar),
      });
      p.position.set((x + 0.5) * CELL, 0, (y + 0.5) * CELL);
      scene.add(p);
    }
    pillarCells.length = 0;
  }
  const pillarGeo = new THREE.BoxGeometry(CELL * 0.84, WALL_H, CELL * 0.84);
  const pillars = new THREE.InstancedMesh(pillarGeo, kit.mats.pillar, Math.max(1, pillarCells.length));
  const pillarCap = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL * 1.02, 0.5, CELL * 1.02), kit.mats.trim, Math.max(1, pillarCells.length));
  const pillarBase = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL * 0.98, 0.6, CELL * 0.98), kit.mats.trim, Math.max(1, pillarCells.length));
  const pillarOutline = new THREE.InstancedMesh(pillarGeo, kit.mats.outline, Math.max(1, pillarCells.length));
  pillarCells.forEach(([x, y], i) => {
    const px = (x + 0.5) * CELL, pz = (y + 0.5) * CELL;
    pillars.setMatrixAt(i, m4.makeTranslation(px, WALL_H / 2, pz));
    pillarCap.setMatrixAt(i, m4.makeTranslation(px, WALL_H - 0.2, pz));
    pillarBase.setMatrixAt(i, m4.makeTranslation(px, 0.3, pz));
    om.makeTranslation(px, WALL_H / 2, pz).scale(sc);
    pillarOutline.setMatrixAt(i, om);
  });
  scene.add(pillars, pillarCap, pillarBase, pillarOutline);

  // 중앙 홀 바닥의 큰 빨간 크레용 원
  const hall = map.roomCenters[Math.floor(map.roomCenters.length / 2)];
  if (hall && theme.rune !== false) {
    const rune = buildRuneCircle(scene, hall.x, hall.z, Math.min(5.4, CELL * 2.6));
    rune.material.opacity = 0.36;
  }

  // 소품: 맵 데이터에 있으면 그것(궁전 — 충돌도 같은 데이터), 없으면 던전 소품 (통·상자·잔돌·배너·벽사슬)
  if (map.props.length) buildMapProps(scene, map, theme);
  else buildProps(scene, kit, map);

  // 탈출 문 (아치·철창·X사슬·자물쇠·열림 연출)
  const gates = map.doors.map((door) => {
    const gate = new EscapeGate({ door, kit, models: theme.models?.door });
    scene.add(gate.group);
    return gate;
  });
  // 문 위로 솟는 빛기둥 (멀리서 위치가 보이게). 천장 위로는 가리므로 문 안쪽까지만.
  const beams = map.doors.map((d) => {
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 2.1, 14, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff3048, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    beam.position.set(d.center.x, 7, d.center.z);
    scene.add(beam);
    return beam;
  });
  // 문 조명은 하나만 (예고된 문으로 옮긴다). 조명 개수가 바뀌면 셰이더를 다시 만들어 끊기므로 개수는 고정.
  const doorLight = new THREE.PointLight(0xff3048, 0, 26, 1.4);
  scene.add(doorLight);
  // 탈출구 빛도 하나만 (문이 열릴 때 그 통로로 옮긴다)
  const exitLight = new THREE.PointLight(0xffe0a0, 0, 30, 1.6);
  scene.add(exitLight);

  // 횃불: 벽에 붙은 받침 + 불꽃 + 빛무리. 실제 빛은 카메라에서 가까운 몇 개만.
  const flameTex = flameTexture();
  const glowTex = glowTexture();
  const torches = map.torches.map((t, i) => {
    const tor = buildTorch(kit, { flame: flameTex, glow: glowTex }, t, i, theme.models?.torch);
    scene.add(tor.group);
    return tor;
  });
  const TORCH_LIGHTS = gfx.preset.torchLights; // 실제 빛을 주는 횃불 수 (그래픽 설정, 판마다 고정 — 바뀌면 셰이더를 다시 만들어 끊김)
  const pool = Array.from({ length: TORCH_LIGHTS }, () => {
    const l = new THREE.PointLight(theme.torch, 0, 30, 1.5);
    scene.add(l);
    return l;
  });

  if (theme.decals) addDecals(scene, map);

  const tmp = new THREE.Vector3();
  let revealed = -1;
  let last = -1;
  return {
    scene,
    // camPos: 이 카메라에서 가까운 횃불 몇 개에만 실제 빛을 옮겨 단다
    update(time, camPos) {
      const dt = last < 0 ? 0 : Math.min(0.05, Math.max(0, time - last));
      last = time;
      for (const t of torches) {
        t.f = 0.85 + Math.sin(time * 9 + t.phase) * 0.08 + Math.sin(time * 23 + t.phase * 2) * 0.05;
        t.flame.scale.set(0.7 * t.f, 0.95 * t.f, 1);
        if (t.glow) {
          t.glow.material.opacity = 0.34 + 0.16 * t.f;
          t.glow.scale.setScalar(3.4 + t.f * 0.8);
        }
        t.d = camPos ? t.tip.distanceToSquared(camPos) : 0;
      }
      const near = camPos ? [...torches].sort((a, b) => a.d - b.d) : torches;
      pool.forEach((l, k) => {
        const t = near[k];
        if (!t) return (l.intensity = 0);
        l.position.copy(t.tip);
        l.intensity = 46 * t.f;
      });
      for (const g of gates) g.update(dt, time);
      // 자물쇠·탈출구 빛: 예고/열린 문 하나에만
      const g = revealed >= 0 ? gates[revealed] : null;
      if (g) {
        if (g.state === 'open') {
          doorLight.intensity = 0;
          exitLight.position.copy(g.exitPos(tmp));
          exitLight.intensity = g.exitLevel;
        } else {
          doorLight.position.copy(g.lockPos(tmp));
          doorLight.intensity = g.lockLevel;
          exitLight.intensity = 0;
        }
      }
    },
    revealDoor(i) {
      revealed = i;
      gates[i]?.reveal();
      if (beams[i]) beams[i].material.opacity = 0.13;
      if (gates[i]) {
        doorLight.position.copy(gates[i].lockPos(tmp));
        doorLight.intensity = 24;
      }
    },
    openDoor(i, instant = false) {
      if (revealed < 0) revealed = i;
      gates[i]?.open(instant);
      if (beams[i]) {
        beams[i].material.color.set(0x9dffc0);
        beams[i].material.opacity = 0.13;
      }
      if (gates[i] && instant) {
        // 이미 열린 뒤 만들어진 화면: 바로 열린 상태로
        gates[i].update(0, 0);
        doorLight.intensity = 0;
        exitLight.position.copy(gates[i].exitPos(tmp));
        exitLight.intensity = gates[i].exitLevel || 40;
      }
    },
    doors: gates,
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
        const px = f.axis === 'z' ? t : f.at - f.out * 0.05;
        const pz = f.axis === 'z' ? f.at - f.out * 0.05 : t;
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
        new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, opacity: j.floor ? 0.8 : 0.92 }),
      );
      m.scale.set(j.size * Math.min(1, aspect), j.size / Math.max(1, aspect), 1);
      m.position.set(...j.pos);
      m.rotation.set(...j.rot, j.floor ? 'XYZ' : 'YXZ');
      m.renderOrder = 1;
      scene.add(m);
    });
  }
}
