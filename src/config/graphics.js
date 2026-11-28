// 그래픽 품질 (컴퓨터 팬·발열 줄이기). 화면에서 고르면 브라우저에 저장된다 (GraphicsSettings).
// maxWidth: 3D 를 이 가로 픽셀보다 크게 그리지 않는다 (더 큰 화면은 늘려서 보여 줌 — 픽셀 수가 곧 GPU 부담)
// fps: 초당 최대 그리기 횟수, antialias: 계단 현상 줄이기(다음 판부터 적용)
// post: 선 없는 기본 렌더의 후처리(블룸·톤매핑·색보정, render/PostRenderer.js). '끄기'는 후처리 없이 그냥 그린다
// shadows: 키 라이트 실시간 그림자 (부드러운 PCF). '끄기'는 꺼서 가볍게
// ('잉크 선' 스타일은 품질과 별개의 토글 — GraphicsSettings 의 inkStyle, render/InkRenderer.js)
export const GRAPHICS = {
  low: { maxWidth: 1100, fps: 45, antialias: false, post: false, shadows: false },
  mid: { maxWidth: 1600, fps: 60, antialias: true, post: true, shadows: true },
  high: { maxWidth: 4096, fps: 60, antialias: true, post: true, shadows: true },
};
export const GRAPHICS_DEFAULT = 'mid';
export const MENU_FPS = 30; // 로비·결과 화면 3D 무대
export const BACKGROUND_FPS = 15; // 창이 다른 창 뒤로 갔을 때 (보이는데 포커스가 없을 때)
