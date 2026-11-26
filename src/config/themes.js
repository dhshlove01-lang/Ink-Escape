// 맵별 겉모습(테마). 새 맵을 만들면 MAP_THEME 에 한 줄(필요하면 THEMES 에 새 테마) →
// 게임 전장(SceneBuilder)과 로비 대기실 배경(CharacterStage)이 같이 바뀐다.

export const THEMES = {
  dungeon: {
    tex: { wall: 'tex.wall', floor: 'tex.floor', pillar: 'tex.pillar' }, // config/assets.js 의 이미지 키
    background: 0x08060d,
    fog: { color: 0x0a0712, near: 11, far: 64 },
    hemi: { sky: 0x7a68a8, ground: 0x2a1c18, intensity: 1.05 },
    torch: 0xff9a4a,
    decals: { chalk: [0, 1, 2, 3, 6, 9], red: [0, 1] }, // 로비 벽에 붙일 낙서 (DECALS 번호)
    rune: true, // 바닥 빨간 크레용 원
    banner: true, // 벽에 거는 천
  },
};

// 맵 id → 테마 id
export const MAP_THEME = {
  dungeon: 'dungeon',
};

export function themeFor(mapId) {
  return THEMES[MAP_THEME[mapId]] || THEMES.dungeon;
}
