import { GameMap, CELL, TILE } from './GameMap.js';

// 맵 정의. 새 맵은 builder 하나를 MAPS 에 더하면 된다.
// 맵 1 "낙서 지하감옥" (3×3 방 구조) · 맵 2 "대마왕의 궁전" (원통 홀) — 지금 경기 맵은 궁전

function buildDungeon() {
  const W = 45, H = 35;
  const cells = new Uint8Array(W * H).fill(TILE.WALL);
  const carve = (x, y, w, h, t = TILE.FLOOR) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) cells[yy * W + xx] = t;
  };
  const colX = [2, 16, 32], colW = [11, 13, 11];
  const rowY = [2, 13, 24], rowH = 9;

  const roomCenters = [];
  const rooms = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      carve(colX[c], rowY[r], colW[c], rowH);
      roomCenters.push({ x: (colX[c] + colW[c] / 2) * CELL, z: (rowY[r] + rowH / 2) * CELL });
      rooms.push({ x0: colX[c] * CELL, z0: rowY[r] * CELL, x1: (colX[c] + colW[c]) * CELL, z1: (rowY[r] + rowH) * CELL });
    }
  }
  // 가로 연결 (모두)
  for (let r = 0; r < 3; r++) {
    carve(13, rowY[r] + 2, 3, 5);
    carve(29, rowY[r] + 2, 3, 5);
  }
  // 세로 연결 (일부만 → 돌아가는 길이 생김)
  const vlink = (c, r) => carve(colX[c] + Math.floor((colW[c] - 5) / 2), rowY[r] + rowH, 5, rowY[r + 1] - (rowY[r] + rowH));
  vlink(1, 0);
  vlink(1, 1);
  vlink(0, 1);
  vlink(2, 0);

  // 기둥
  const pillar = (x, y) => (cells[y * W + x] = TILE.PILLAR);
  const hall = { x: colX[1], y: rowY[1] };
  [[3, 2], [9, 2], [3, 6], [9, 6]].forEach(([dx, dy]) => pillar(hall.x + dx, hall.y + dy));
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (r === 1 && c === 1) continue;
      const x0 = colX[c], y0 = rowY[r];
      if ((r + c) % 2 === 0) {
        pillar(x0 + 3, y0 + 3);
        pillar(x0 + colW[c] - 4, y0 + 5);
      } else {
        pillar(x0 + Math.floor(colW[c] / 2), y0 + 4);
      }
    }
  }

  // 탈출 문 후보 3곳 (바깥 벽)
  const doors = [];
  const door = (name, list, dir) => {
    list.forEach(([x, y]) => (cells[y * W + x] = TILE.DOOR));
    const cx = list.reduce((s, c) => s + c[0], 0) / list.length;
    const cy = list.reduce((s, c) => s + c[1], 0) / list.length;
    doors.push({ name, cells: list, center: { x: (cx + 0.5) * CELL, z: (cy + 0.5) * CELL }, dir });
  };
  const nx = colX[1] + Math.floor(colW[1] / 2);
  door('door.north', [[nx - 1, 0], [nx, 0], [nx + 1, 0], [nx - 1, 1], [nx, 1], [nx + 1, 1]], { x: 0, z: -1 });
  const wy = rowY[1] + Math.floor(rowH / 2);
  door('door.west', [[0, wy - 1], [0, wy], [0, wy + 1], [1, wy - 1], [1, wy], [1, wy + 1]], { x: -1, z: 0 });
  door('door.east', [[W - 1, wy - 1], [W - 1, wy], [W - 1, wy + 1], [W - 2, wy - 1], [W - 2, wy], [W - 2, wy + 1]], { x: 1, z: 0 });

  // 횃불: 각 방의 위·아래 벽에 하나씩. 벽 가운데가 통로 구멍이면 옆으로 옮겨 실제 벽 칸에 붙인다.
  const torches = [];
  const isWall = (x, y) => x >= 0 && y >= 0 && x < W && y < H && cells[y * W + x] === TILE.WALL;
  // 문 장식(아치·배너)과 겹치지 않게: 같은 줄에서 문 칸과 4칸 이내면 횃불을 달지 않는다
  const nearDoor = (x, y) => { for (let dx = -4; dx <= 4; dx++) if (x + dx >= 0 && x + dx < W && cells[y * W + x + dx] === TILE.DOOR) return true; return false; };
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const x0 = colX[c], w = colW[c], y0 = rowY[r];
      const mid = x0 + Math.floor(w / 2);
      for (const [wallY, zFace, nz] of [[y0 - 1, y0 * CELL, 1], [y0 + rowH, (y0 + rowH) * CELL, -1]]) {
        for (let k = 0; k < w; k++) {
          const x = mid + (k % 2 ? -1 : 1) * Math.ceil(k / 2);
          if (x < x0 || x >= x0 + w || !isWall(x, wallY) || nearDoor(x, wallY)) continue;
          torches.push({ x: (x + 0.5) * CELL, z: zFace, nx: 0, nz });
          break;
        }
      }
    }
  }

  return new GameMap({
    id: 'dungeon',
    name: 'map.dungeon',
    w: W,
    h: H,
    cells,
    spawn: { x: (hall.x + 6.5) * CELL, z: (hall.y + 4.5) * CELL },
    doors,
    torches,
    roomCenters,
    rooms,
  });
}

// 맵 2 "대마왕의 궁전" (2026-11-27): 큰 원통 홀. 가운데 왕좌의 방(ㄱ자 벽 4개로 둘러쌈) + 바깥 둘레 + 기둥 고리.
// 바깥벽은 둥글다(bounds). 소품(왕좌·발판·통·상자·잉크병)은 맵 데이터라 방장·클라이언트가 같이 부딪힌다.
function buildPalace() {
  const N = 39, C = 19; // 격자 39×39, 가운데 칸 19
  const R = 34; // 바깥벽 반지름 (m)
  const cx = (C + 0.5) * CELL, cz = (C + 0.5) * CELL; // 월드 중심 (39, 39)
  const cells = new Uint8Array(N * N).fill(TILE.WALL);
  const set = (x, y, t) => (cells[y * N + x] = t);
  // 원 안 (칸이 조금이라도 원 안에 걸치면 바닥 — 실제 경계는 bounds 원이 막는다)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (Math.hypot((x + 0.5) * CELL - cx, (y + 0.5) * CELL - cz) < R + 1.41) set(x, y, TILE.FLOOR);
  }
  // 왕좌의 방: 네 모서리 ㄱ자 벽 (가운데에서 7칸, 팔 길이 5칸) → 동서남북에 10m 입구
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    for (let k = 3; k <= 7; k++) {
      set(C + sx * k, C + sy * 7, TILE.WALL);
      set(C + sx * 7, C + sy * k, TILE.WALL);
    }
  }
  // 기둥: 바깥 둘레 고리 8개 + 왕좌의 방 안 4개
  const pillar = (x, y) => set(x, y, TILE.PILLAR);
  for (let i = 0; i < 8; i++) {
    const a = ((22.5 + i * 45) * Math.PI) / 180;
    pillar(Math.round(C + Math.sin(a) * 11.5), Math.round(C - Math.cos(a) * 11.5));
  }
  [[-4, -2], [4, -2], [-4, 3], [4, 3]].forEach(([dx, dy]) => pillar(C + dx, C + dy));

  // 탈출 문 후보 3곳 (북·서·동, 둥근 벽 바깥 2칸)
  const doors = [];
  const door = (name, list, dir) => {
    list.forEach(([x, y]) => set(x, y, TILE.DOOR));
    const mx = list.reduce((s, c) => s + c[0], 0) / list.length;
    const my = list.reduce((s, c) => s + c[1], 0) / list.length;
    doors.push({ name, cells: list, center: { x: (mx + 0.5) * CELL, z: (my + 0.5) * CELL }, dir });
  };
  const span = (a, b, fn) => { const out = []; for (let i = a; i <= b; i++) out.push(...fn(i)); return out; };
  door('door.north', span(C - 1, C + 1, (x) => [[x, 0], [x, 1]]), { x: 0, z: -1 });
  door('door.west', span(C - 1, C + 1, (y) => [[0, y], [1, y]]), { x: -1, z: 0 });
  door('door.east', span(C - 1, C + 1, (y) => [[N - 1, y], [N - 2, y]]), { x: 1, z: 0 });

  // 바깥벽 위의 자리: 북쪽에서 시계방향 각도(도) → 벽 위 점 + 안쪽 방향
  const onWall = (deg, inset = 0) => {
    const a = (deg * Math.PI) / 180;
    return { x: cx + Math.sin(a) * (R - inset), z: cz - Math.cos(a) * (R - inset), nx: -Math.sin(a), nz: Math.cos(a), ry: -a };
  };
  // 횃불 (문 근처 제외)
  const torches = [45, 135, 165, 195, 225, 315].map((d) => { const w = onWall(d); return { x: w.x, z: w.z, nx: w.nx, nz: w.nz }; });

  // 소품. solid = 부딪힘 모양 (r 원 / hx·hz 상자), h = 윗면 높이(m, 점프로 닿으면 올라설 수 있음), tall = 총알·시야도 막음
  const props = [];
  const add = (p) => props.push(p);
  // 스테인드글라스 창 (벽에 붙음, 높이는 VIEW_H 안)
  for (const d of [30, 60, 120, 150, 180, 210, 240, 300, 330]) { const w = onWall(d, 0.12); add({ kind: 'window', x: w.x, z: w.z, ry: w.ry }); }
  // 왕좌의 방: 왕좌(북쪽을 봄) + 앞 발판 + 붉은 카펫 + 잉크병
  const throneZ = cz + 10;
  add({ kind: 'throne', x: cx, z: throneZ, ry: Math.PI, solid: { hx: 1.35, hz: 1.0 }, h: 3.4, tall: true });
  add({ kind: 'pad', x: cx, z: throneZ - 2.7, ry: 0, solid: { r: 1.5 }, h: 0.69 });
  add({ kind: 'carpet', x: cx, z: (cz - 14 + throneZ - 4.2) / 2, ry: 0, len: throneZ - 4.2 - (cz - 14), w: 2.4 });
  for (const [dx, dz] of [[-2.3, 0.4], [2.3, 0.4], [-2.6, -2.6], [2.6, -2.6], [-1.9, -4.6], [1.9, -4.6]]) {
    add({ kind: 'inkbottle', x: cx + dx, z: throneZ + dz, ry: dx * 0.7, solid: { r: 0.3 }, h: 0.6 });
  }
  // 샹들리에 (천장에 매달림 — 높이는 VIEW_H 까지만)
  add({ kind: 'chandelier', x: cx, z: cz - 3 });
  for (const d of [0, 90, 180, 270]) { const w = onWall(d, 10); add({ kind: 'chandelier', x: w.x, z: w.z }); }
  // 바깥 둘레: 벽에 붙은 통·상자·잉크병 무더기 (문·창 앞 피함)
  const pile = (deg, list) => {
    const a = (deg * Math.PI) / 180;
    const tx = Math.cos(a), tz = Math.sin(a); // 벽을 따라가는 방향
    for (const [kind, along, inset] of list) {
      const w = onWall(deg, inset);
      const x = w.x + tx * along, z = w.z + tz * along;
      if (kind === 'barrel') add({ kind, x, z, ry: along * 1.3, solid: { r: 0.5 }, h: 1.1 });
      else if (kind === 'crate') add({ kind, x, z, ry: w.ry + along * 0.2, solid: { hx: 0.55, hz: 0.55 }, h: 1.05 });
      else add({ kind, x, z, ry: along, solid: { r: 0.3 }, h: 0.6 });
    }
  };
  pile(45, [['barrel', -1.6, 1.3], ['barrel', -0.5, 1.2], ['crate', 1.0, 1.3]]);
  pile(105, [['crate', -0.6, 1.3], ['inkbottle', 0.6, 1.0], ['barrel', 1.6, 1.2]]);
  pile(160, [['barrel', -1.2, 1.2], ['crate', 0.2, 1.3], ['crate', 0.4, 2.5]]);
  pile(225, [['crate', -1.0, 1.3], ['barrel', 0.4, 1.2], ['inkbottle', 1.4, 1.0]]);
  pile(285, [['barrel', -0.8, 1.2], ['barrel', 0.4, 1.3]]);
  pile(330, [['crate', -1.4, 1.3], ['barrel', -0.1, 1.2], ['inkbottle', 0.9, 1.0]]);
  // 둘레 가운데쯤 엄폐용 상자 더미
  for (const d of [70, 200, 250, 20]) {
    const w = onWall(d, 7.5);
    add({ kind: 'crate', x: w.x, z: w.z, ry: w.ry, solid: { hx: 0.55, hz: 0.55 }, h: 1.05 });
    add({ kind: 'barrel', x: w.x + w.nz * 1.1, z: w.z - w.nx * 1.1, ry: d, solid: { r: 0.5 }, h: 1.1 });
  }

  // 방(사각형): 왕좌의 방 먼저 (roomAt 은 처음 맞는 방), 그다음 네 사분면 (원 밖 점은 isFloor 가 걸러냄)
  const hall = { x0: (C - 6) * CELL, z0: (C - 6) * CELL, x1: (C + 7) * CELL, z1: (C + 7) * CELL };
  const quad = (sx, sz) => ({ x0: sx < 0 ? cx - R : cx, x1: sx < 0 ? cx : cx + R, z0: sz < 0 ? cz - R : cz, z1: sz < 0 ? cz : cz + R });
  const rooms = [hall, quad(-1, -1), quad(1, -1), quad(-1, 1), quad(1, 1)];
  const roomCenters = [{ x: cx, z: cz }, ...[315, 45, 225, 135].map((d) => onWall(d, 8))].map(({ x, z }) => ({ x, z }));

  return new GameMap({
    id: 'palace',
    name: 'map.palace',
    w: N,
    h: N,
    cells,
    spawn: { x: cx, z: cz },
    doors,
    torches,
    roomCenters,
    rooms,
    bounds: { x: cx, z: cz, r: R },
    props,
  });
}

export const MAPS = {
  palace: buildPalace,
  dungeon: buildDungeon, // 예전 맵 (지금은 안 씀 — 로비 기본은 palace)
};

export function createMap(id) {
  const build = MAPS[id] || MAPS.palace;
  return build();
}
