import { DrawingAnalyzer } from './DrawingAnalyzer.js';
import { StatCalculator } from './StatCalculator.js';
import { defaultDetectors } from './detectors/index.js';

// 판정 창구 (Facade). 술래 미리보기와 방장 소환이 이것 하나만 안다.
export class Judge {
  constructor({ analyzer, calculator }) {
    this.analyzer = analyzer;
    this.calc = calculator;
  }

  judge(strokes, opt) {
    const analysis = this.analyzer.analyze(strokes);
    const res = this.calc.evaluate(analysis, opt);
    res.icons = this.calc.icons(res.attrs || [], res.traits, res.stats);
    return res;
  }
}

export function createJudge({ balance, palette, attributes }) {
  return new Judge({
    analyzer: new DrawingAnalyzer({
      grid: balance.judge.grid,
      colorCount: palette.length,
      detectors: defaultDetectors(balance.judge),
    }),
    calculator: new StatCalculator({ balance, palette, attributes }),
  });
}

// 네트워크로 받은 획 데이터 검사 (방장이 믿고 쓰기 전에)
export function sanitizeStrokes(strokes, paletteLength) {
  if (!Array.isArray(strokes) || strokes.length > 400) return null;
  let points = 0;
  const out = [];
  for (const s of strokes) {
    if (!s || !Array.isArray(s.p)) return null;
    const c = s.c | 0;
    const w = Number(s.w);
    if (c < 0 || c >= paletteLength || !(w >= 4 && w <= 80)) return null;
    points += s.p.length;
    if (points > 20000) return null;
    const p = s.p.map((v) => Math.max(0, Math.min(512, Math.round(Number(v) || 0))));
    out.push({ c, w, p });
  }
  return out;
}
