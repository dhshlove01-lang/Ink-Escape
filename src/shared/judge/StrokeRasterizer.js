// 획 데이터 → 격자. 브라우저 캔버스(안티앨리어싱이 PC마다 다름)를 쓰지 않고
// 직접 원을 찍어서, 방장과 미리보기가 언제나 같은 결과를 내게 한다.
//
// 획 형식: { c: 색 인덱스(0=지우개), w: 굵기(px, 512 도화지 기준), p: [x0,y0,x1,y1,...] }

export const CANVAS_SIZE = 512;

export function rasterize(strokes, N) {
  const grid = new Uint8Array(N * N);
  const s = N / CANVAS_SIZE;
  for (const st of strokes) {
    const p = st.p;
    if (!p || p.length < 2) continue;
    const r = Math.max(0.75, (st.w * s) / 2);
    const c = st.c | 0;
    let px = p[0] * s;
    let py = p[1] * s;
    stamp(grid, N, px, py, r, c);
    for (let i = 2; i + 1 < p.length; i += 2) {
      const x = p[i] * s;
      const y = p[i + 1] * s;
      const len = Math.hypot(x - px, y - py);
      const steps = Math.max(1, Math.ceil(len / 0.5));
      for (let k = 1; k <= steps; k++) {
        stamp(grid, N, px + ((x - px) * k) / steps, py + ((y - py) * k) / steps, r, c);
      }
      px = x;
      py = y;
    }
  }
  return grid;
}

function stamp(grid, N, cx, cy, r, c) {
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(N - 1, Math.floor(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(N - 1, Math.floor(cy + r));
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      if (dx * dx + dy * dy <= r2) grid[y * N + x] = c;
    }
  }
}

// 바깥에서 물을 부어 닿지 않는 칸 = 그림 안쪽. 선이 열려 있으면 바깥 실루엣 기준이 된다.
export function silhouette(grid, N) {
  const outside = new Uint8Array(N * N);
  const queue = new Int32Array(N * N);
  let head = 0;
  let tail = 0;
  const push = (i) => {
    if (!outside[i] && grid[i] === 0) {
      outside[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let i = 0; i < N; i++) {
    push(i);
    push((N - 1) * N + i);
    push(i * N);
    push(i * N + N - 1);
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % N;
    const y = (i / N) | 0;
    if (x > 0) push(i - 1);
    if (x < N - 1) push(i + 1);
    if (y > 0) push(i - N);
    if (y < N - 1) push(i + N);
  }
  const sil = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) sil[i] = outside[i] ? 0 : 1;
  return sil;
}
