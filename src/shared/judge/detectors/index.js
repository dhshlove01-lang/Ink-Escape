import { radialPeaks } from '../DrawingAnalyzer.js';

// 형태 감지기들. 각자 한 가지만 본다 (SRP).
// 인터페이스: detect(features, traitsSoFar) => 부분 traits. 등록 순서대로 실행된다.

// 상단 좌우 대칭 돌출 → 날개 → 비행
export class WingDetector {
  constructor(cfg) {
    this.cfg = cfg;
  }

  detect(f) {
    const { sil, N, bbox, cx, cy, silArea } = f;
    const band = bbox.w * 0.3;
    let ul = 0, ur = 0, ll = 0, lr = 0;
    for (let y = bbox.y0; y <= bbox.y1; y++) {
      for (let x = bbox.x0; x <= bbox.x1; x++) {
        if (!sil[y * N + x]) continue;
        const dx = x + 0.5 - cx;
        const upper = y + 0.5 < cy;
        if (dx < -band) upper ? ul++ : ll++;
        else if (dx > band) upper ? ur++ : lr++;
      }
    }
    const minSide = Math.min(ul, ur);
    const maxSide = Math.max(ul, ur, 1);
    const fly =
      minSide >= silArea * this.cfg.wingSideMin &&
      minSide / maxSide >= this.cfg.wingSymmetry &&
      ul > ll * this.cfg.wingUpperBias &&
      ur > lr * this.cfg.wingUpperBias;
    return { fly };
  }
}

// 짧고 뾰족한 봉우리가 많으면 → 뿔·가시 → 돌진
export class SpikeDetector {
  constructor(cfg) {
    this.cfg = cfg;
  }

  detect(f) {
    const peaks = radialPeaks(f, this.cfg.peakProminence);
    const spikes = peaks.filter((p) => p.ratio < this.cfg.limbRatio).length;
    return { spikes, dash: spikes >= this.cfg.spikeCount };
  }
}

// 몸 크기에 비해 아주 길게 뻗은 봉우리 → 긴 팔·촉수 → 원거리
export class LimbDetector {
  constructor(cfg) {
    this.cfg = cfg;
  }

  // 날개 감지기 다음에 돈다: 날개가 있으면 위쪽으로 뻗은 봉우리(날개 끝)는 촉수로 치지 않는다.
  detect(f, traits) {
    const n = f.radial.length;
    const peaks = radialPeaks(f, this.cfg.peakProminence).filter((p) => {
      if (p.ratio < this.cfg.limbRatio) return false;
      const upward = Math.sin((p.i / n) * Math.PI * 2) < -0.3; // 화면 y 는 아래가 +
      return !(traits.fly && upward);
    });
    const maxRatio = peaks.reduce((m, p) => Math.max(m, p.ratio), 0);
    return { limbs: peaks.length, limbRatio: maxRatio };
  }
}

export function defaultDetectors(judgeCfg) {
  return [new WingDetector(judgeCfg), new SpikeDetector(judgeCfg), new LimbDetector(judgeCfg)];
}
