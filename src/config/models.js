// 3D 모델 파일 목록과 보정값. 새 모델은 여기 한 줄 추가 (코드는 고치지 않는다).
//   url        GLB 경로
//   rotateY    모델 앞(총구·얼굴)이 -Z 를 보도록 돌리는 각도
//   size       가장 긴 변을 이 길이(m)로 맞춤
//   material   재질 보정: metalness·roughness 덮어쓰기,
//              darkenNeutral = 무채색(회색) 텍스처를 이 배율로 어둡게 (Stable Fast 3D 가 밝게 구워서)

export const MODEL_DEFS = {
  gun: {
    url: 'assets/models/gun.glb',
    rotateY: Math.PI / 2, // 원본은 총구가 +X
    size: 0.62,
    material: { metalness: 0, roughness: 0.65, darkenNeutral: 0.3 },
  },
  // shiba: { url: 'assets/models/shiba.glb', rotateY: 0, size: 1.25, material: { metalness: 0, roughness: 0.9 } },
};
