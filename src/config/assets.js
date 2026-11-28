// 2D 이미지 목록 (tools/process_assets.py 가 만든 webp). 새 이미지는 한 줄 추가.
// 못 불러오면 각 화면이 기존 코드 그리기로 대체한다.

const A = 'assets/';

export const IMAGE_DEFS = {
  // 맵 텍스처
  'tex.wall': A + 'tex/wall.webp',
  'tex.floor': A + 'tex/floor.webp',
  'tex.pillar': A + 'tex/pillar.webp',
  'tex.palace_wall': A + 'tex/palace_wall.webp', // 대마왕 궁전 (심리스 1024)
  'tex.palace_floor': A + 'tex/palace_floor.webp',
  'tex.palace_carpet': A + 'tex/palace_carpet.webp',
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
  'face.devil': A + 'ui/faces/devil.webp', // 술래 악마 초상화 (없으면 코드 그림으로 대체)
  'icon.black': A + 'ui/icons/elem_black.webp',
  'icon.red': A + 'ui/icons/elem_red.webp',
  'icon.blue': A + 'ui/icons/elem_blue.webp',
  'icon.yellow': A + 'ui/icons/elem_yellow.webp',
  'icon.purple': A + 'ui/icons/elem_purple.webp',
  'icon.fly': A + 'ui/icons/trait_fly.webp',
  'icon.dash': A + 'ui/icons/trait_dash.webp',
  'icon.ranged': A + 'ui/icons/trait_ranged.webp',
  // 공용 UI 키트 (tools/process_ui_kit.py → assets/ui/kit). 모두 불러와지면 body 에 art-kit (style.css)
  'kit.btn_primary': A + 'ui/kit/btn_primary.webp',
  'kit.btn_primary_hover': A + 'ui/kit/btn_primary_hover.webp',
  'kit.btn_primary_down': A + 'ui/kit/btn_primary_down.webp',
  'kit.btn_secondary': A + 'ui/kit/btn_secondary.webp',
  'kit.btn_secondary_hover': A + 'ui/kit/btn_secondary_hover.webp',
  'kit.btn_secondary_down': A + 'ui/kit/btn_secondary_down.webp',
  'kit.btn_danger': A + 'ui/kit/btn_danger.webp',
  'kit.btn_danger_hover': A + 'ui/kit/btn_danger_hover.webp',
  'kit.btn_danger_down': A + 'ui/kit/btn_danger_down.webp',
  'kit.btn_disabled': A + 'ui/kit/btn_disabled.webp',
  'kit.panel_large': A + 'ui/kit/panel_large.webp',
  'kit.card_small': A + 'ui/kit/card_small.webp',
  'kit.input': A + 'ui/kit/input.webp',
  'kit.chip_gray': A + 'ui/kit/chip_gray.webp',
  'kit.chip_yellow': A + 'ui/kit/chip_yellow.webp',
  'kit.popup': A + 'ui/kit/popup.webp',
  'kit.banner_alert': A + 'ui/kit/banner_alert.webp',
  'kit.badge_crown': A + 'ui/kit/badge_crown.webp',
  'kit.badge_check': A + 'ui/kit/badge_check.webp',
};

// 벽·바닥에 흩뿌릴 낙서 데칼
export const DECALS = {
  chalk: Array.from({ length: 12 }, (_, i) => `${A}decals/chalk_${String(i + 1).padStart(2, '0')}.webp`),
  red: Array.from({ length: 8 }, (_, i) => `${A}decals/red_${String(i + 1).padStart(2, '0')}.webp`),
};
