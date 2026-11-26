// 그래픽 품질 (컴퓨터 팬·발열 줄이기). 화면에서 고르면 브라우저에 저장된다 (GraphicsSettings).
// maxWidth: 3D 를 이 가로 픽셀보다 크게 그리지 않는다 (더 큰 화면은 늘려서 보여 줌 — 픽셀 수가 곧 GPU 부담)
// fps: 초당 최대 그리기 횟수, torchLights: 실제 빛을 주는 횟불 수, antialias: 계단 현상 줄이기(다음 판부터 적용)
export const GRAPHICS = {
  low: { maxWidth: 1100, fps: 45, torchLights: 2, antialias: false },
  mid: { maxWidth: 1600, fps: 60, torchLights: 3, antialias: true },
  high: { maxWidth: 4096, fps: 60, torchLights: 4, antialias: true },
};
export const GRAPHICS_DEFAULT = 'mid';
export const MENU_FPS = 30; // 로비·결과 화면 3D 무대
export const BACKGROUND_FPS = 15; // 창이 다른 창 뒤로 갔을 때 (보이는데 포커스가 없을 때)
