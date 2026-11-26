// 격자 맵. 충돌·시야·탈출 판정을 담당한다 (그리기는 클라이언트가 따로).
// 좌표: x = 가로(열), z = 세로(행). 칸 하나 = CELL m.

export const CELL = 2;
export const WALL_H = 7;
export const TILE = { FLOOR: 0, WALL: 1, PILLAR: 2, DOOR: 3 };

export class GameMap {
  constructor({ id, name, w, h, cells, spawn, doors, torches, roomCenters, rooms = [] }) {
    this.id = id;
    this.name = name;
    this.w = w;
    this.h = h;
    this.cells = cells;
    this.spawn = spawn;
    this.doors = doors;          // [{ name, cells:[[cx,cy]...], center:{x,z}, dir:{x,z} }]
    this.torches = torches;      // [{ x, z, nx, nz }]
    this.roomCenters = roomCenters;
    this.rooms = rooms;          // [{ x0, z0, x1, z1 }] 월드 좌표 (카메라 위치 계산용)
    this.openDoor = -1;
    this._doorOf = new Map();
    doors.forEach((d, i) => d.cells.forEach(([cx, cy]) => this._doorOf.set(cy * w + cx, i)));
  }

  setOpenDoor(i) {
    this.openDoor = i;
  }

  tile(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h) return TILE.WALL;
    return this.cells[cy * this.w + cx];
  }

  solid(cx, cy) {
    const t = this.tile(cx, cy);
    if (t === TILE.FLOOR) return false;
    if (t === TILE.DOOR) return this._doorOf.get(cy * this.w + cx) !== this.openDoor;
    return true;
  }

  solidAt(x, z) {
    return this.solid(Math.floor(x / CELL), Math.floor(z / CELL));
  }

  // 원(플레이어·몬스터)을 벽 밖으로 밀어낸다
  collideCircle(x, z, r) {
    for (let iter = 0; iter < 2; iter++) {
      const cx0 = Math.floor((x - r) / CELL), cx1 = Math.floor((x + r) / CELL);
      const cy0 = Math.floor((z - r) / CELL), cy1 = Math.floor((z + r) / CELL);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          if (!this.solid(cx, cy)) continue;
          const minX = cx * CELL, maxX = minX + CELL, minZ = cy * CELL, maxZ = minZ + CELL;
          const px = Math.max(minX, Math.min(x, maxX));
          const pz = Math.max(minZ, Math.min(z, maxZ));
          let dx = x - px, dz = z - pz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          if (d2 > 1e-9) {
            const d = Math.sqrt(d2);
            x += (dx / d) * (r - d);
            z += (dz / d) * (r - d);
          } else {
            // 중심이 벽 안: 가장 가까운 면으로
            const opts = [[x - minX, -1, 0], [maxX - x, 1, 0], [z - minZ, 0, -1], [maxZ - z, 0, 1]];
            opts.sort((a, b) => a[0] - b[0]);
            const [d, sx, sz] = opts[0];
            x += sx * (d + r);
            z += sz * (d + r);
          }
        }
      }
    }
    return { x, z };
  }

  // 2D 광선이 벽에 닿는 거리 (DDA). 벽은 충분히 높다고 본다.
  raycast(ox, oz, dx, dz, maxDist) {
    const len = Math.hypot(dx, dz);
    if (len < 1e-9) return maxDist;
    dx /= len;
    dz /= len;
    let cx = Math.floor(ox / CELL), cy = Math.floor(oz / CELL);
    if (this.solid(cx, cy)) return 0;
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = Math.abs(CELL / dx), tDeltaZ = Math.abs(CELL / dz);
    let tMaxX = dx !== 0 ? ((dx > 0 ? (cx + 1) * CELL - ox : ox - cx * CELL) / Math.abs(dx)) : Infinity;
    let tMaxZ = dz !== 0 ? ((dz > 0 ? (cy + 1) * CELL - oz : oz - cy * CELL) / Math.abs(dz)) : Infinity;
    let t = 0;
    while (t < maxDist) {
      if (tMaxX < tMaxZ) {
        t = tMaxX;
        tMaxX += tDeltaX;
        cx += stepX;
      } else {
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        cy += stepZ;
      }
      if (t >= maxDist) break;
      if (this.solid(cx, cy)) return t;
    }
    return maxDist;
  }

  lineOfSight(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    return this.raycast(ax, az, bx - ax, bz - az, d) >= d - 0.05;
  }

  // 열린 문 칸(또는 맵 밖)에 들어왔나
  inOpenDoor(x, z) {
    if (this.openDoor < 0) return false;
    const cx = Math.floor(x / CELL), cy = Math.floor(z / CELL);
    if (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h) return true;
    return this._doorOf.get(cy * this.w + cx) === this.openDoor;
  }

  // 이 위치가 속한 방 (통로면 가장 가까운 방)
  roomAt(x, z) {
    let best = this.rooms[0], bestD = Infinity;
    for (const r of this.rooms) {
      if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r;
      const d = Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
    return best;
  }

  isFloor(x, z) {
    const cx = Math.floor(x / CELL), cy = Math.floor(z / CELL);
    return this.tile(cx, cy) === TILE.FLOOR;
  }

  get worldW() {
    return this.w * CELL;
  }

  get worldH() {
    return this.h * CELL;
  }
}
