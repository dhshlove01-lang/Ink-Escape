// 코드로 만든 3D 모델 목록 (img2threejs 로 만들어 export 한 파일). config/models.js 의 procedural 이름 → 만드는 함수.
// 필요할 때만 불러온다 (파일이 커서 쓰지 않으면 받지 않게).
export const PROCEDURAL_MODELS = {
  shiba: () => import('./shiba.js').then((m) => m.createShibaModel),
};
