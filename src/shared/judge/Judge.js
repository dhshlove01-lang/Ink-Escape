import { DrawingAnalyzer } from './DrawingAnalyzer.js';
import { StatCalculator } from './StatCalculator.js';
import { defaultDetectors } from './detectors/index.js';
import { nearestPaletteIndex } from '../attributes.js';

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
    // 자유 색(rgb)이 있으면 속성은 방장이 직접 다시 계산한다
    const rgb = Number.isInteger(s.rgb) && s.rgb >= 0 && s.rgb <= 0xffffff ? s.rgb : undefined;
    out.push(rgb !== undefined && c !== 0 ? { c: nearestPaletteIndex(rgb), w, p, rgb } : { c, w, p });
  }
  return out;
}
