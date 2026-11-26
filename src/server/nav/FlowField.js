// 플레이어 한 명까지의 길 거리표 (BFS). 몬스터는 숫자가 줄어드는 칸으로 걸어간다.

const N4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export class FlowField {
  constructor(map) {
    this.map = map;
    this.dist = new Int16Array(map.w * map.h);
    this.queue = new Int32Array(map.w * map.h);
  }

  build(cx, cy) {
    const { w, h } = this.map;
    const dist = this.dist;
    const q = this.queue;
    dist.fill(-1);
    if (cx < 0 || cy < 0 || cx >= w || cy >= h || this.map.solid(cx, cy)) return this;
    let head = 0;
    let tail = 0;
    dist[cy * w + cx] = 0;
    q[tail++] = cy * w + cx;
    while (head < tail) {
      const i = q[head++];
      const x = i % w;
      const y = (i / w) | 0;
      const d = dist[i] + 1;
      for (const [dx, dy] of N4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (dist[j] !== -1 || this.map.solid(nx, ny)) continue;
        dist[j] = d;
        q[tail++] = j;
      }
    }
    return this;
  }

  at(cx, cy) {
    const { w, h } = this.map;
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) return -1;
    return this.dist[cy * w + cx];
  }

  // 지금 칸에서 가장 가까워지는 이웃 칸 (대각선은 양옆이 막히지 않을 때만)
  next(cx, cy) {
    let best = null;
    let bestD = this.at(cx, cy);
    if (bestD < 0) bestD = 1e9;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const d = this.at(cx + dx, cy + dy);
        if (d < 0) continue;
        if (dx && dy && (this.map.solid(cx + dx, cy) || this.map.solid(cx, cy + dy))) continue;
        const score = d + (dx && dy ? 0.4 : 0);
        if (score < bestD) {
          bestD = score;
          best = [cx + dx, cy + dy];
        }
      }
    }
    return best;
  }
}
