// 색 → 속성 표. 새 색을 추가하려면 PALETTE 와 ATTRIBUTES 에 한 줄씩 더한다 (OCP).
// index 0 은 지우개(빈칸).

export const PALETTE = [
  null,
  { key: 'black', hex: '#1d1b22' },
  { key: 'red', hex: '#d8283f' },
  { key: 'blue', hex: '#2f6fde' },
  { key: 'yellow', hex: '#f0bd1e' },
  { key: 'purple', hex: '#8b3fd2' },
];

export const ATTRIBUTES = {
  black: { icon: '🛡', aura: '#9aa0ad', hp: 1.5, speed: 0.8, dmg: 0.8 },
  red: { icon: '🔥', aura: '#ff6a2b', hp: 0.9, dmg: 1.5, onHit: { burn: { dps: 3, sec: 3 } } },
  blue: { icon: '❄', aura: '#7fd3ff', onHit: { slow: { amount: 0.4, sec: 2 } } },
  yellow: { icon: '⚡', aura: '#ffe14a', hp: 0.8, speed: 1.5 },
  purple: { icon: '☠', aura: '#b46cff', hp: 0.8, ranged: 15, onHit: { poison: { dps: 4, sec: 4 } } },
};

export const TRAIT_INFO = {
  fly: { icon: '🪽' },
  dash: { icon: '💨' },
  ranged: { icon: '🎯' },
};

export function paletteIndexOf(key) {
  return PALETTE.findIndex((p) => p && p.key === key);
}

// ── 자유 색 → 가장 가까운 기본 색(속성) ──────────────────────────────
// 컬러 피커로 고른 어떤 색이든 속성 하나로 정한다. 사람이 보기에 자연스럽게:
//   너무 어둡거나 회색에 가까우면 → 검정(방어)
//   나머지는 무지개(색상) 위치가 가장 가까운 기본 색 → 빨강·노랑·파랑·보라
// 방장도 같은 함수로 다시 계산하므로 색과 속성을 다르게 보내도 소용없다.
export const hexToInt = (hex) => parseInt(hex.slice(1), 16);
export const intToHex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');

export function rgbToHsv(rgb) {
  const r = ((rgb >> 16) & 255) / 255, g = ((rgb >> 8) & 255) / 255, b = (rgb & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return { h: (h + 360) % 360, s: max ? d / max : 0, v: max };
}

// 검정으로 보는 기준 (채도·밝기 0~1)
export const ACHROMATIC = { minSat: 0.22, minVal: 0.25 };
const BLACK = PALETTE.findIndex((p) => p && p.key === 'black');
const HUES = PALETTE.map((p, i) => (p && i !== BLACK ? rgbToHsv(hexToInt(p.hex)).h : null));

/** rgb(정수 0xRRGGBB) → PALETTE 인덱스 (1~5) */
export function nearestPaletteIndex(rgb) {
  const { h, s, v } = rgbToHsv(rgb);
  if (s < ACHROMATIC.minSat || v < ACHROMATIC.minVal) return BLACK;
  let best = BLACK, bd = Infinity;
  HUES.forEach((hue, i) => {
    if (hue === null) return;
    const d = Math.min(Math.abs(h - hue), 360 - Math.abs(h - hue));
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}
