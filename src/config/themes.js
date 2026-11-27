// 맵별 겉모습(테마). 새 맵을 만들면 MAP_THEME 에 한 줄(필요하면 THEMES 에 새 테마) →
// 게임 전장(SceneBuilder)과 로비 대기실 배경(CharacterStage)이 같이 바뀐다.

export const THEMES = {
  dungeon: {
    tex: { wall: 'tex.wall', floor: 'tex.floor', pillar: 'tex.pillar' }, // config/assets.js 의 이미지 키
    background: 0x08060d,
    fog: { color: 0x0a0712, near: 11, far: 64 },
    hemi: { sky: 0x9a88c8, ground: 0x4a3428, intensity: 3.6 },
    key: { color: 0xffe2c4, intensity: 2.2 }, // 셀 명암을 만드는 위쪽 빛 하나 (진짜 점광원은 없음 — 횃불·샹들리에는 빛무리 그림만)
    torch: 0xff9a4a,
    decals: { chalk: [0, 1, 2, 3, 6, 9], red: [0, 1] }, // 로비 벽에 붙일 낙서 (DECALS 번호)
    rune: true, // 바닥 빨간 크레용 원
    banner: true, // 벽에 거는 천
  },
  // 대마왕의 궁전 (2026-11-27): 흑요석 대리석 바닥 + 금장 몰딩 석벽 + 진홍 카펫, Tripo 소품(왕좌·기둥·창·샹들리에)
  palace: {
    tex: { wall: 'tex.palace_wall', floor: 'tex.palace_floor', carpet: 'tex.palace_carpet' },
    tile: { wall: [4.5, 7], floor: 4, carpet: 2.4 }, // 텍스처 한 장의 실제 크기(m): 벽 [가로, 세로], 바닥 한 변, 카펫 길이
    background: 0x0b0710,
    fog: { color: 0x1c1222, near: 20, far: 90 },
    hemi: { sky: 0xecd6e4, ground: 0x8a5a40, intensity: 5.2 }, // 진짜 점광원을 뺀 만큼 밝게 (따뜻한 횃불빛 느낌)
    key: { color: 0xffe6c8, intensity: 2.6 },
    torch: 0xffa35a,
    decals: null,
    rune: false,
    banner: false,
    // GLB 로 그릴 것 (없으면 코드 도형)
    models: { pillar: 'palace_pillar', torch: 'prop_torch', door: { frame: 'door_frame', leaf: 'door_leaf', lock: 'door_lock' } },
    lobby: { window: 'palace_window' }, // 대기실 뒷벽 가운데 (banner 자리)
  },
};

// 맵 id → 테마 id
export const MAP_THEME = {
  dungeon: 'dungeon',
  palace: 'palace',
};

export function themeFor(mapId) {
  return THEMES[MAP_THEME[mapId]] || THEMES.dungeon;
}
