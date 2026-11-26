// 증강이 반영된 실제 수치. 방장 서버와 화면(총·이동·소환 금지 원)이 같은 계산을 쓴다.
// aug: { 증강키: 개수 } (없으면 0)

const n = (aug, key) => (aug && aug[key]) || 0;

// ── 플레이어 ──
export const maxHpBonus = (b, aug) => n(aug, 'tummy') * b.aug.tummy.maxHp;
export const fireRate = (b, aug) => b.gun.rps * (1 + n(aug, 'paws') * b.aug.paws.fireRate);
export const reloadSec = (b, aug) => (n(aug, 'paws') ? b.aug.paws.reloadSec : b.gun.reloadSec);
export const moveMult = (b, aug) => 1 + n(aug, 'swift') * b.aug.swift.speed;
export const jumps = (aug) => (n(aug, 'swift') ? 2 : 1);
export const pierces = (aug) => n(aug, 'pierce') > 0;
export const grenadeMax = (b, aug) => b.grenade.max + n(aug, 'eraserPro') * b.aug.eraserPro.grenadeMax;
export const grenadeRecharge = (b, aug) => b.grenade.rechargeSec * Math.pow(b.aug.eraserPro.recharge, n(aug, 'eraserPro'));
export const reviveHoldSec = (b, aug) => (n(aug, 'rescue') ? b.aug.rescue.holdSec : b.match.reviveHoldSec);
export const reviveHpRatio = (b, aug) => (n(aug, 'rescue') ? b.aug.rescue.reviveHp : b.match.reviveHpRatio);
// 명중 신고 허용량 (연사·관통이 늘면 같이)
export const hitsPerSec = (b, aug) => b.net.hitsPerSecMax * (1 + n(aug, 'paws') * b.aug.paws.fireRate) * (pierces(aug) ? 2 : 1);

// ── 술래 ──
export const monsterHpMult = (b, aug) => 1 + n(aug, 'thick') * b.aug.thick.hp;
export const monsterDmgMult = (b, aug) => 1 + n(aug, 'sharp') * b.aug.sharp.dmg;
export const monsterSpeedMult = (b, aug) => 1 + n(aug, 'wind') * b.aug.wind.speed;
export const minPlayerDist = (b, aug) => (n(aug, 'shadow') ? b.aug.shadow.minPlayerDist : b.spawn.minPlayerDist);
export const spawnDelay = (b, aug) => (n(aug, 'shadow') ? b.aug.shadow.delaySec : b.spawn.delaySec);
export const bossCooldown = (b, aug) => (n(aug, 'bigBrush') ? b.aug.bigBrush.bossCooldownSec : b.spawn.bossCooldownSec);
export const bossSizeMult = (b, aug) => 1 + n(aug, 'bigBrush') * b.aug.bigBrush.bossSize;
