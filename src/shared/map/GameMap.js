// 격자 맵. 충돌·시야·탈출 판정을 담당한다 (그리기는 클라이언트가 따로).
// 좌표: x = 가로(열), z = 세로(행). 칸 하나 = CELL m.
// 둥근 맵: bounds(원) 밖은 벽 (문 입구만 예외). 소품: props 중 solid 가 있는 것은 부딪힌다 (방장·클라이언트 같은 데이터).

export const CELL = 2;
export const WALL_H = 14; // 천장 높이 (2026-11-27 사용자 지시: 7 → 2배)
export const VIEW_H = 7.5; // 몬스터 그림·표시·걸린 소품이 올라갈 수 있는 최대 높이 (너무 높으면 안 보임)
export const TILE = { FLOOR: 0, WALL: 1, PILLAR: 2, DOOR: 3 };
const ON_TOP = 0.08; // 발이 소품 윗면보다 이만큼 아래까지는 '위에 있다'로 본다 (한 프레임 낙하 오차)

export class GameMap {
  constructor({ id, name, w, h, cells, spawn, doors, torches, roomCenters, rooms = [], bounds = null, props = [] }) {
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
    this.bounds = bounds;        // { x, z, r } 둥근 바깥벽 (없으면 격자만)
    this.props = props;          // [{ kind, x, z, ry, s, y?, solid?: { r } | { hx, hz }, h?, tall? }] — h: 윗면 높이 (올라설 수 있음)
    this.solids = props.filter((p) => p.solid);
    this.openDoor = -1;
    this._doorOf = new Map();
    doors.forEach((d, i) => d.cells.forEach(([cx, cy]) => this._doorOf.set(cy * w + cx, i)));
    // 문 입구: 둥근 벽이 문 앞을 막지 않게 (문 칸 상자를 안쪽으로 3칸 늘린 사각형)
    this._mouths = doors.map((d) => {
      const xs = d.cells.map((c) => c[0]), ys = d.cells.map((c) => c[1]);
      const m = { x0: Math.min(...xs) * CELL, x1: (Math.max(...xs) + 1) * CELL, z0: Math.min(...ys) * CELL, z1: (Math.max(...ys) + 1) * CELL };
      const k = 3 * CELL;
      if (d.dir.z < 0) m.z1 += k; else if (d.dir.z > 0) m.z0 -= k;
      if (d.dir.x < 0) m.x1 += k; else if (d.dir.x > 0) m.x0 -= k;
      return m;
    });
    // 몬스터 길찾기용: 소품이 차지한 칸 (칸 가운데가 소품 안)
    this._propCells = new Set();
    for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) {
      if (this.solids.some((p) => insideProp(p, (cx + 0.5) * CELL, (cy + 0.5) * CELL, 0.2))) this._propCells.add(cy * w + cx);
    }
  }

  // 발을 디딜 높이: 발(y)이 윗면 근처 이상인 소품 중 발밑(반지름 r 원)에 걸친 가장 높은 윗면, 없으면 바닥 0
  groundAt(x, z, r, y) {
    let g = 0;
    for (const p of this.solids) {
      if (p.h === undefined || p.h <= g || y < p.h - ON_TOP) continue;
      if (insideProp(p, x, z, r)) g = p.h;
    }
    return g;
  }

  inMouth(x, z) {
    return this._mouths.some((m) => x >= m.x0 && x <= m.x1 && z >= m.z0 && z <= m.z1);
  }

  // 둥근 벽 안인가 (pad 만큼 안쪽까지)
  inBounds(x, z, pad = 0) {
    const b = this.bounds;
    if (!b) return true;
    return Math.hypot(x - b.x, z - b.z) <= b.r - pad || this.inMouth(x, z);
  }

  // 몬스터 길찾기: 벽 + 소품 칸
  blocked(cx, cy) {
    return this.solid(cx, cy) || this._propCells.has(cy * this.w + cx);
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
    return this.solid(Math.floor(x / CELL), Math.floor(z / CELL)) || !this.inBounds(x, z);
  }

  // 원(플레이어·몬스터)을 벽·둥근 벽·소품 밖으로 밀어낸다.
  // y = 발 높이: 소품 윗면(h)보다 높이 있으면 그 소품은 막지 않는다 (점프해서 위로 넘어가 올라섬). 몬스터는 y 없이 = 늘 막힘
  collideCircle(x, z, r, y = 0) {
    for (let iter = 0; iter < 2; iter++) {
      for (const p of this.solids) if (!(p.h !== undefined && y >= p.h - ON_TOP)) ({ x, z } = pushOut(p, x, z, r));
      const b = this.bounds;
      if (b && !this.inMouth(x, z)) {
        const dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz);
        if (d > b.r - r) {
          x = b.x + (dx / d) * (b.r - r);
          z = b.z + (dz / d) * (b.r - r);
        }
      }
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
      if (this.solid(cx, cy)) return this._clipRay(ox, oz, dx, dz, t);
    }
    return this._clipRay(ox, oz, dx, dz, maxDist);
  }

  // 격자 결과 t 를 둥근 벽·키 큰 소품(왕좌 등)으로 더 짧게
  _clipRay(ox, oz, dx, dz, t) {
    const b = this.bounds;
    if (b) {
      const fx = ox - b.x, fz = oz - b.z;
      const bb = fx * dx + fz * dz, c = fx * fx + fz * fz - b.r * b.r;
      if (c < 0) {
        const exit = -bb + Math.sqrt(bb * bb - c);
        if (exit < t && !this.inMouth(ox + dx * exit, oz + dz * exit)) t = exit;
      }
    }
    for (const p of this.solids) {
      if (!p.tall) continue;
      const rr = p.solid.r ?? Math.max(p.solid.hx, p.solid.hz);
      const fx = ox - p.x, fz = oz - p.z;
      const bb = fx * dx + fz * dz, c = fx * fx + fz * fz - rr * rr;
      const disc = bb * bb - c;
      if (disc < 0) continue;
      const hit = -bb - Math.sqrt(disc);
      if (hit > 0 && hit < t) t = hit;
    }
    return t;
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

  // 바닥 (둥근 벽 안, 소품 위가 아닌 곳)
  isFloor(x, z) {
    const cx = Math.floor(x / CELL), cy = Math.floor(z / CELL);
    if (this.tile(cx, cy) !== TILE.FLOOR) return false;
    if (this.bounds && Math.hypot(x - this.bounds.x, z - this.bounds.z) > this.bounds.r - 0.3) return false;
    return !this.solids.some((p) => insideProp(p, x, z, 0.3));
  }

  get worldW() {
    return this.w * CELL;
  }

  get worldH() {
    return this.h * CELL;
  }
}

// 소품 모양(원 또는 ry 로 돈 상자) 안인가 (pad 만큼 넓혀서)
function insideProp(p, x, z, pad = 0) {
  const s = p.solid;
  if (s.r !== undefined) return Math.hypot(x - p.x, z - p.z) < s.r + pad;
  const c = Math.cos(p.ry || 0), sn = Math.sin(p.ry || 0);
  const lx = (x - p.x) * c - (z - p.z) * sn, lz = (x - p.x) * sn + (z - p.z) * c;
  return Math.abs(lx) < s.hx + pad && Math.abs(lz) < s.hz + pad;
}

// 원(x,z,r)을 소품 밖으로
function pushOut(p, x, z, r) {
  const s = p.solid;
  if (s.r !== undefined) {
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz), min = s.r + r;
    if (d >= min) return { x, z };
    if (d < 1e-6) return { x: p.x + min, z };
    return { x: p.x + (dx / d) * min, z: p.z + (dz / d) * min };
  }
  // 돈 상자: 소품 좌표로 바꿔 가장 가까운 점에서 밀어낸 뒤 되돌린다
  const c = Math.cos(p.ry || 0), sn = Math.sin(p.ry || 0);
  let lx = (x - p.x) * c - (z - p.z) * sn, lz = (x - p.x) * sn + (z - p.z) * c;
  const qx = Math.max(-s.hx, Math.min(lx, s.hx)), qz = Math.max(-s.hz, Math.min(lz, s.hz));
  let dx = lx - qx, dz = lz - qz;
  const d = Math.hypot(dx, dz);
  if (d >= r) return { x, z };
  if (d > 1e-6) {
    lx = qx + (dx / d) * r;
    lz = qz + (dz / d) * r;
  } else {
    // 중심이 상자 안: 가까운 면으로
    const ex = s.hx - Math.abs(lx), ez = s.hz - Math.abs(lz);
    if (ex < ez) lx = Math.sign(lx || 1) * (s.hx + r);
    else lz = Math.sign(lz || 1) * (s.hz + r);
  }
  return { x: p.x + lx * c + lz * sn, z: p.z - lx * sn + lz * c };
}
