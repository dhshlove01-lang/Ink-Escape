// 2D 이미지 목록 (tools/process_assets.py 가 만든 webp). 새 이미지는 한 줄 추가.
// 못 불러오면 각 화면이 기존 코드 그리기로 대체한다.

const A = 'assets/';

export const IMAGE_DEFS = {
  // 맵 텍스처
  'tex.wall': A + 'tex/wall.webp',
  'tex.floor': A + 'tex/floor.webp',
  'tex.pillar': A + 'tex/pillar.webp',
  // 이펙트 (vfx.* 중 검은 배경은 가산 합성으로 그린다)
  'vfx.muzzle': A + 'vfx/muzzle.webp',
  'vfx.spark': A + 'vfx/spark.webp',
  'vfx.grenade': A + 'vfx/grenade.webp',
  'vfx.eraser_boom': A + 'vfx/eraser_boom.webp',
  'vfx.summon': A + 'vfx/summon.webp',
  'vfx.summon_boss': A + 'vfx/summon_boss.webp',
  'vfx.proj_black': A + 'vfx/spark.webp',
  'vfx.proj_red': A + 'vfx/proj_red.webp',
  'vfx.proj_blue': A + 'vfx/proj_blue.webp',
  'vfx.proj_yellow': A + 'vfx/proj_yellow.webp',
  'vfx.proj_purple': A + 'vfx/proj_purple.webp',
  // UI
  'ui.logo': A + 'ui/logo.webp',
  'ui.title_bg': A + 'ui/title_bg.webp',
  'ui.paper': A + 'ui/paper.webp',
  'ui.spawn_btn': A + 'ui/spawn_btn.webp',
  'ui.bar_hp': A + 'ui/bar_hp.webp',
  'ui.bar_boss': A + 'ui/bar_boss.webp',
  'ui.pencil': A + 'ui/pencil_full.webp',
  'ui.crosshair': A + 'ui/crosshair.webp',
  'face.shiba': A + 'ui/faces/shiba.webp',
  'face.bear': A + 'ui/faces/bear.webp',
  'face.rabbit': A + 'ui/faces/rabbit.webp',
  'face.cat': A + 'ui/faces/cat.webp',
  'icon.black': A + 'ui/icons/elem_black.webp',
  'icon.red': A + 'ui/icons/elem_red.webp',
  'icon.blue': A + 'ui/icons/elem_blue.webp',
  'icon.yellow': A + 'ui/icons/elem_yellow.webp',
  'icon.purple': A + 'ui/icons/elem_purple.webp',
  'icon.fly': A + 'ui/icons/trait_fly.webp',
  'icon.dash': A + 'ui/icons/trait_dash.webp',
  'icon.ranged': A + 'ui/icons/trait_ranged.webp',
};

// 벽·바닥에 흩뿌릴 낙서 데칼
export const DECALS = {
  chalk: Array.from({ length: 12 }, (_, i) => `${A}decals/chalk_${String(i + 1).padStart(2, '0')}.webp`),
  red: Array.from({ length: 8 }, (_, i) => `${A}decals/red_${String(i + 1).padStart(2, '0')}.webp`),
};
