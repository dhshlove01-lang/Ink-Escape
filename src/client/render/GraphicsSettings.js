import { GRAPHICS, GRAPHICS_DEFAULT, BACKGROUND_FPS } from '../../config/graphics.js';

// 그래픽 품질 고르기 + 화면 크기·창 포커스에 맞춘 그리기 해상도·빈도 계산.
// 3D 화면(PlayerView·TaggerCam·CharacterStage)은 여기서 숫자만 받아 쓴다.

const KEY = 'inkEscape.gfx';
const INK_KEY = 'inkEscape.ink';
const listeners = new Set();
let level = GRAPHICS_DEFAULT;
try {
  const v = localStorage.getItem(KEY);
  if (v && GRAPHICS[v]) level = v;
} catch {}

// 그림체 (2026-11-28): 기본은 **선 없는** 자연스러운 렌더(조명·공기감·후처리).
// 예전 잉크 선 + 셀 명암은 화면의 '잉크 선' 버튼으로 따로 켜고 끈다.
let inkStyle = false;
try {
  inkStyle = localStorage.getItem(INK_KEY) === '1';
} catch {}

// 자동 해상도 (2026-11-27): 경기 화면 프레임이 목표보다 느리면 그리는 해상도를 낮추고, 여유가 생기면 다시 올린다.
// GPU 부담 = 픽셀 수 → 0.8배면 약 36% 가벼움. 1 = 그래픽 설정의 해상도 그대로, 최저 0.5
const DYN = { min: 0.5, down: 0.85, up: 1.08, slow: 1.2, fast: 1.06, checkMs: 1000, upAfter: 4 };
let scale = 1;
let ema = 0, lastCheck = 0, fastStreak = 0;
const frameStats = { calls: 0, tris: 0 };

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
  /** 잉크 선 스타일 (기본 꺼짐 — 선 없는 렌더) */
  get ink() {
    return inkStyle;
  },
  /** 선 없는 후처리 렌더를 쓰는가 (품질이 후처리를 주고, 잉크 선은 꺼져 있을 때) */
  get post() {
    return !inkStyle && this.preset.post !== false;
  },
  setInk(v) {
    v = !!v;
    if (v === inkStyle) return;
    inkStyle = v;
    try {
      localStorage.setItem(INK_KEY, v ? '1' : '0');
    } catch {}
    listeners.forEach((f) => f(level));
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
  /** 이 CSS 크기에 쓸 픽셀 비율 (≤1). 가로가 maxWidth 를 넘으면 줄여서 그린다 + 자동 해상도 배율 */
  pixelRatio(cssWidth) {
    return Math.min(1, this.preset.maxWidth / Math.max(1, cssWidth)) * scale;
  },
  get scale() {
    return scale;
  },
  /** 경기 화면 한 프레임이 끝날 때마다 (App 루프). dtMs = 앞 프레임과의 간격 */
  frame(dtMs, now = performance.now()) {
    this.stats.calls = frameStats.calls; // 이번 프레임에 그린 양
    this.stats.tris = frameStats.tris;
    frameStats.calls = frameStats.tris = 0;
    if (!(dtMs > 0) || dtMs > 1000) return; // 탭이 숨었다 돌아온 순간 등은 무시
    ema = ema ? ema * 0.9 + dtMs * 0.1 : dtMs;
    this.stats.fps = 1000 / ema;
    this.stats.ms = ema;
    if (now - lastCheck < DYN.checkMs) return;
    lastCheck = now;
    const target = this.frameInterval() + 0.5;
    let next = scale;
    if (ema > target * DYN.slow) {
      next = Math.max(DYN.min, scale * DYN.down);
      fastStreak = 0;
    } else if (ema < target * DYN.fast && scale < 1) {
      if (++fastStreak >= DYN.upAfter) (next = Math.min(1, scale * DYN.up)), (fastStreak = 0);
    } else fastStreak = 0;
    if (Math.abs(next - scale) > 1e-3) {
      scale = next;
      listeners.forEach((f) => f(level)); // 각 화면이 resize → 새 해상도
    }
  },
  /** 그린 양 더하기 (InkRenderer — 성능 표시용) */
  count(info) {
    frameStats.calls += info.render.calls;
    frameStats.tris += info.render.triangles;
  },
  stats: { fps: 0, ms: 0, calls: 0, tris: 0 },
  /** 프레임 사이 최소 간격(ms). cap: 화면이 따로 정한 최대 fps (로비 등) */
  frameInterval(cap = Infinity) {
    const fps = Math.min(cap, this.preset.fps, focused ? Infinity : BACKGROUND_FPS);
    return 1000 / fps - 0.5;
  },
};
