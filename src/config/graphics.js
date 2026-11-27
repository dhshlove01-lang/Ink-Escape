// 그래픽 품질 (컴퓨터 팬·발열 줄이기). 화면에서 고르면 브라우저에 저장된다 (GraphicsSettings).
// maxWidth: 3D 를 이 가로 픽셀보다 크게 그리지 않는다 (더 큰 화면은 늘려서 보여 줌 — 픽셀 수가 곧 GPU 부담)
// fps: 초당 최대 그리기 횟수, antialias: 계단 현상 줄이기(다음 판부터 적용)
// ink: 잉크 스타일(셀 셰이딩 + 잉크 외곽선, render/InkRenderer.js). 장면을 두 번 그려 무겁다 → 'low'(화면 이름 '끄기')는 끔
export const GRAPHICS = {
  low: { maxWidth: 1100, fps: 45, antialias: false, ink: false },
  mid: { maxWidth: 1600, fps: 60, antialias: true, ink: true },
  high: { maxWidth: 4096, fps: 60, antialias: true, ink: true },
};
export const GRAPHICS_DEFAULT = 'mid';
export const MENU_FPS = 30; // 로비·결과 화면 3D 무대
export const BACKGROUND_FPS = 15; // 창이 다른 창 뒤로 갔을 때 (보이는데 포커스가 없을 때)
