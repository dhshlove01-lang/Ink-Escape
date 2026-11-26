// 색 → 속성 표. 새 색을 추가하려면 PALETTE 와 ATTRIBUTES 에 한 줄씩 더한다 (OCP).
// index 0 은 지우개(빈칸).

export const PALETTE = [
  null,
  { key: 'black', hex: '#1d1b22', name: '검정' },
  { key: 'red', hex: '#d8283f', name: '빨강' },
  { key: 'blue', hex: '#2f6fde', name: '파랑' },
  { key: 'yellow', hex: '#f0bd1e', name: '노랑' },
  { key: 'purple', hex: '#8b3fd2', name: '보라' },
];

export const ATTRIBUTES = {
  black: { name: '방어', icon: '🛡', aura: '#9aa0ad', hp: 1.5, speed: 0.8, dmg: 0.8 },
  red: { name: '화염', icon: '🔥', aura: '#ff6a2b', hp: 0.9, dmg: 1.5, onHit: { burn: { dps: 3, sec: 3 } } },
  blue: { name: '빙결', icon: '❄', aura: '#7fd3ff', onHit: { slow: { amount: 0.4, sec: 2 } } },
  yellow: { name: '번개', icon: '⚡', aura: '#ffe14a', hp: 0.8, speed: 1.5 },
  purple: { name: '독', icon: '☠', aura: '#b46cff', hp: 0.8, ranged: 15, onHit: { poison: { dps: 4, sec: 4 } } },
};

export const TRAIT_INFO = {
  fly: { icon: '🪽', name: '비행' },
  dash: { icon: '💨', name: '돌진' },
  ranged: { icon: '🎯', name: '원거리' },
};

export function paletteIndexOf(key) {
  return PALETTE.findIndex((p) => p && p.key === key);
}
