// 증강 목록 (보급). 수치는 config/balance.js 의 aug, 이름·설명은 strings.js 의 aug.<key>.name / .desc
// icon: 그림이 오기 전 임시 이모지 (그림은 assets 의 'aug.<key>' 이미지가 있으면 그것)
// desc: 설명 문장에 넣을 값 (balance.aug 에서 꺼냄 — 숫자를 바꾸면 설명도 같이 바뀜)

const pct = (v) => Math.round(v * 100);

export const AUGMENTS = {
  player: [
    { key: 'tummy', icon: '🍙', desc: (a) => ({ n: a.maxHp }) },
    { key: 'snack', icon: '🍪', desc: (a) => ({ n: a.healOnKill }) },
    { key: 'paws', icon: '⚡', desc: (a) => ({ p: pct(a.fireRate), s: a.reloadSec }) },
    { key: 'pierce', icon: '🏹', desc: () => ({}) },
    { key: 'eraserShot', icon: '💥', desc: (a) => ({ n: a.every, r: a.radius, d: a.dmg }) },
    { key: 'heart', icon: '💗', desc: (a) => ({ s: a.invulnSec }) },
    { key: 'cheer', icon: '🚩', desc: (a) => ({ r: a.radius, p: pct(a.dmgBonus) }) },
    { key: 'eraserPro', icon: '🧽', desc: (a) => ({ n: a.grenadeMax, p: pct(1 - a.recharge) }) },
    { key: 'swift', icon: '👟', desc: (a) => ({ p: pct(a.speed) }) },
    { key: 'rescue', icon: '🩺', desc: (a) => ({ s: a.holdSec, n: a.revives }) },
  ],
  tagger: [
    { key: 'pencil', icon: '✏️', desc: (a) => ({ n: a.ink }) },
    { key: 'sharpener', icon: '🖍', desc: (a) => ({ p: pct(a.regen) }) },
    { key: 'twin', icon: '👯', desc: (a) => ({ p: pct(a.chance) }) },
    { key: 'thick', icon: '📚', desc: (a) => ({ p: pct(a.hp) }) },
    { key: 'sharp', icon: '📌', desc: (a) => ({ p: pct(a.dmg) }) },
    { key: 'wind', icon: '🌪', desc: (a) => ({ p: pct(a.speed) }) },
    { key: 'recycle', icon: '♻️', desc: (a) => ({ p: pct(a.refund) }) },
    { key: 'bigBrush', icon: '🖌', desc: (a) => ({ s: a.bossCooldownSec, p: pct(a.bossSize) }) },
    { key: 'sticky', icon: '🫧', desc: (a) => ({ s: a.sec, p: pct(a.slow) }) },
    { key: 'shadow', icon: '👤', desc: (a) => ({ m: a.minPlayerDist, s: a.delaySec }) },
  ],
};

export const AUG_SIDE = Object.fromEntries([...AUGMENTS.player.map((a) => [a.key, 'player']), ...AUGMENTS.tagger.map((a) => [a.key, 'tagger'])]);
export const AUG_INFO = Object.fromEntries([...AUGMENTS.player, ...AUGMENTS.tagger].map((a) => [a.key, a]));
