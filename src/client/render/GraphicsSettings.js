import { GRAPHICS, GRAPHICS_DEFAULT, BACKGROUND_FPS } from '../../config/graphics.js';

// 그래픽 품질 고르기 + 화면 크기·창 포커스에 맞춘 그리기 해상도·빈도 계산.
// 3D 화면(PlayerView·CornerCam·CharacterStage)은 여기서 숫자만 받아 쓴다.

const KEY = 'inkEscape.gfx';
const listeners = new Set();
let level = GRAPHICS_DEFAULT;
try {
  const v = localStorage.getItem(KEY);
  if (v && GRAPHICS[v]) level = v;
} catch {}

let focused = document.hasFocus();
window.addEventListener('focus', () => (focused = true));
window.addEventListener('blur', () => (focused = false));

export const gfx = {
  levels: Object.keys(GRAPHICS),
  get level() {
    return level;
  },
  get preset() {
    return GRAPHICS[level];
  },
  set(v) {
    if (!GRAPHICS[v] || v === level) return;
    level = v;
    try {
      localStorage.setItem(KEY, v);
    } catch {}
    listeners.forEach((f) => f(v));
  },
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /** 이 CSS 크기에 쓸 픽셀 비율 (≤1). 가로가 maxWidth 를 넘으면 줄여서 그린다 */
  pixelRatio(cssWidth) {
    return Math.min(1, this.preset.maxWidth / Math.max(1, cssWidth));
  },
  /** 프레임 사이 최소 간격(ms). cap: 화면이 따로 정한 최대 fps (로비 등) */
  frameInterval(cap = Infinity) {
    const fps = Math.min(cap, this.preset.fps, focused ? Infinity : BACKGROUND_FPS);
    return 1000 / fps - 0.5;
  },
};
