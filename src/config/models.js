// 3D 모델 파일 목록과 보정값. 새 모델은 여기 한 줄 추가 (코드는 고치지 않는다).
//   url        GLB 경로
//   rotateY    모델 앞(총구·얼굴)이 -Z 를 보도록 돌리는 각도
//   size       가장 긴 변을 이 길이(m)로 맞춤
//   anchor     'center'(기본, 물체 중심이 원점) 또는 'bottom'(발이 바닥 y=0)
//   tip        '-z' 이면 가장 앞쪽 끝 점을 찾아 userData.tip 에 저장 (총구 위치)
//   procedural 코드로 만든 모델 이름 (src/client/render/models/index.js). url 대신 쓴다
//   material   재질 보정: metalness·roughness 덮어쓰기,
//              darkenNeutral = 무채색(회색) 텍스처를 이 배율로 어둡게 (Stable Fast 3D 가 밝게 구워서)
//
// 파일이 아직 없으면 그 줄을 넣지 않는다 (없는 파일은 404 가 되고, 임시 모델로 대신 그린다).

const CHARACTER = { rotateY: 0, size: 1.55, anchor: 'bottom', material: { metalness: 0, roughness: 0.88 } };

export const MODEL_DEFS = {
  gun: {
    url: 'assets/models/gun.glb',
    rotateY: Math.PI / 2, // 원본은 총구가 +X
    size: 0.62,
    tip: '-z', // 총구 끝 = 가장 앞쪽(-Z) 점들 → 불꽃·총알 궤적 시작점
    material: { metalness: 0, roughness: 0.65, darkenNeutral: 0.3 },
  },
  // 캐릭터 (원본이 이미 -Z 를 보므로 돌리지 않는다 — 원단이 +Z 를 보면 여기만 고치면 된다)
  shiba: { url: 'assets/models/shiba.glb', ...CHARACTER },
  bear: { url: 'assets/models/bear.glb', ...CHARACTER },
  rabbit: { url: 'assets/models/rabbit.glb', ...CHARACTER },
  cat: { url: 'assets/models/cat.glb', ...CHARACTER },
  devil: { url: 'assets/models/devil.glb', ...CHARACTER },

  // 1인칭 앞발(팔뚝+앞발). 그림 1장을 부풀려 만든 메시라 긴 변 = 1 이 되게 맞춘다.
  // lazy: 시작할 때 모두 받지 않고, 그 동물로 플레이할 때만 받는다 (4종 합쳐 9MB).
  // 원본이 그림 그대로 +Z 를 보므로 돌리지 않는다. 자세·위치는 AnimalModels.createViewModel.
  paw_shiba: { url: 'assets/models/paw_shiba.glb', size: 0.19, rotateY: 0, anchor: 'center', lazy: true },
  paw_bear: { url: 'assets/models/paw_bear.glb', size: 0.19, rotateY: 0, anchor: 'center', lazy: true },
  paw_rabbit: { url: 'assets/models/paw_rabbit.glb', size: 0.19, rotateY: 0, anchor: 'center', lazy: true },
  paw_cat: { url: 'assets/models/paw_cat.glb', size: 0.19, rotateY: 0, anchor: 'center', lazy: true },
};

// 다른 모양 묶음: 주소에 ?models=<이름> 을 붙이면 그 묶음의 줄이 위 기본 줄을 대신한다 (비교·시험용).
// 코드 모델을 기본으로 쓰기로 하면 그 줄을 MODEL_DEFS 로 옮기면 된다.
export const MODEL_VARIANTS = {
  code: {
    // 코드로 만든 시바 (img2threejs, art/models/shiba). 앞이 +Z 라 반 바퀴 돌림. 재질은 모델 것 그대로(눈 광택 유지).
    shiba: { procedural: 'shiba', rotateY: Math.PI, size: CHARACTER.size, anchor: 'bottom' },
  },
};

export function modelDefsFor(variant) {
  return { ...MODEL_DEFS, ...(MODEL_VARIANTS[variant] || {}) };
}
