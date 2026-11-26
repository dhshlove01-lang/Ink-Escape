import { GameMap, CELL, TILE } from './GameMap.js';

// 맵 정의. 새 맵은 builder 하나를 MAPS 에 더하면 된다.
// v0.1: 맵 1 "낙서 지하감옥" (3×3 방 구조, 좁은 복도 없음)

function buildDungeon() {
  const W = 45, H = 35;
  const cells = new Uint8Array(W * H).fill(TILE.WALL);
  const carve = (x, y, w, h, t = TILE.FLOOR) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) cells[yy * W + xx] = t;
  };
  const colX = [2, 16, 32], colW = [11, 13, 11];
  const rowY = [2, 13, 24], rowH = 9;

  const roomCenters = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      carve(colX[c], rowY[r], colW[c], rowH);
      roomCenters.push({ x: (colX[c] + colW[c] / 2) * CELL, z: (rowY[r] + rowH / 2) * CELL });
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
  door('북쪽 문', [[nx - 1, 0], [nx, 0], [nx + 1, 0], [nx - 1, 1], [nx, 1], [nx + 1, 1]], { x: 0, z: -1 });
  const wy = rowY[1] + Math.floor(rowH / 2);
  door('서쪽 문', [[0, wy - 1], [0, wy], [0, wy + 1], [1, wy - 1], [1, wy], [1, wy + 1]], { x: -1, z: 0 });
  door('동쪽 문', [[W - 1, wy - 1], [W - 1, wy], [W - 1, wy + 1], [W - 2, wy - 1], [W - 2, wy], [W - 2, wy + 1]], { x: 1, z: 0 });

  // 횃불: 각 방 위쪽 벽 가운데
  const torches = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      torches.push({ x: (colX[c] + colW[c] / 2) * CELL, z: rowY[r] * CELL + 0.25, nx: 0, nz: 1 });
    }
  }

  return new GameMap({
    id: 'dungeon',
    name: '낙서 지하감옥',
    w: W,
    h: H,
    cells,
    spawn: { x: (hall.x + 6.5) * CELL, z: (hall.y + 4.5) * CELL },
    doors,
    torches,
    roomCenters,
  });
}

export const MAPS = {
  dungeon: buildDungeon,
};

export function createMap(id) {
  const build = MAPS[id] || MAPS.dungeon;
  return build();
}
