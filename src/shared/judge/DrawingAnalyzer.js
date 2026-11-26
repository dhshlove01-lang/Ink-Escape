import { rasterize, silhouette } from './StrokeRasterizer.js';

// 그림을 "특징(features)"으로 바꾸고, 등록된 감지기(detector)들에게 형태 판정을 맡긴다.
// 새 형태 규칙은 감지기를 하나 더 만들어 넣으면 된다 (이 파일은 고치지 않는다 — OCP).
//
// 감지기 인터페이스: { detect(features, traitsSoFar) => 부분 traits 객체 }

const RADIAL_SAMPLES = 72; // 5도 간격

export class DrawingAnalyzer {
  constructor({ grid, colorCount, detectors }) {
    this.N = grid;
    this.colorCount = colorCount;
    this.detectors = detectors;
  }

  analyze(strokes) {
    const N = this.N;
    const grid = rasterize(strokes, N);
    const colorCounts = new Array(this.colorCount).fill(0);
    let filled = 0;
    let x0 = N, y0 = N, x1 = -1, y1 = -1;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const c = grid[y * N + x];
        if (!c) continue;
        filled++;
        colorCounts[c]++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    const areaPct = (filled / (N * N)) * 100;
    if (!filled) {
      return { empty: true, areaPct: 0, colorCounts, traits: {} };
    }

    const sil = silhouette(grid, N);
    let silArea = 0, sx = 0, sy = 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (sil[y * N + x]) {
          silArea++;
          sx += x + 0.5;
          sy += y + 0.5;
        }
      }
    }
    const cx = sx / silArea;
    const cy = sy / silArea;
    const radial = radialProfile(sil, N, cx, cy);
    const sorted = Array.from(radial).sort((a, b) => a - b);
    const medianR = Math.max(1, sorted[sorted.length >> 1]);

    const features = {
      N, grid, sil, silArea, filled, areaPct, colorCounts,
      bbox: { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 },
      cx, cy, radial, medianR,
    };

    const traits = {};
    for (const d of this.detectors) Object.assign(traits, d.detect(features, traits));

    return {
      empty: false,
      areaPct,
      colorCounts,
      bbox: features.bbox,
      extent: Math.max(features.bbox.w, features.bbox.h) / N,
      traits,
    };
  }
}

function radialProfile(sil, N, cx, cy) {
  const r = new Float32Array(RADIAL_SAMPLES);
  for (let a = 0; a < RADIAL_SAMPLES; a++) {
    const ang = (a / RADIAL_SAMPLES) * Math.PI * 2;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    let last = 0;
    for (let t = 0; t < N * 1.5; t += 0.5) {
      const x = Math.floor(cx + dx * t);
      const y = Math.floor(cy + dy * t);
      if (x < 0 || y < 0 || x >= N || y >= N) break;
      if (sil[y * N + x]) last = t;
    }
    r[a] = last;
  }
  return r;
}

// 반경 그래프에서 툭 튀어나온 봉우리들. 가시·촉수 감지기가 같이 쓴다.
export function radialPeaks(features, prominenceRatio) {
  if (features._peaks) return features._peaks;
  const r = features.radial;
  const n = r.length;
  const at = (i) => r[(i + n) % n];
  const peaks = [];
  for (let i = 0; i < n; i++) {
    const v = r[i];
    if (v <= 0) continue;
    let isMax = true;
    for (let k = -2; k <= 2 && isMax; k++) {
      if (k === 0) continue;
      const u = at(i + k);
      if (u > v || (u === v && k < 0)) isMax = false;
    }
    if (!isMax) continue;
    let lo = v;
    for (let k = -4; k <= 4; k++) lo = Math.min(lo, at(i + k));
    if (v - lo >= prominenceRatio * features.medianR) {
      peaks.push({ i, r: v, ratio: v / features.medianR });
    }
  }
  features._peaks = peaks;
  return peaks;
}
