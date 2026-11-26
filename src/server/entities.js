import { PSTATE } from '../shared/protocol.js';

// 방장이 들고 있는 경기 상태의 모양. 로직은 시스템들이 맡는다.

export function createPlayer({ id, name, animal }, spawn, index, balance, playerCount) {
  const ang = (index / Math.max(1, playerCount)) * Math.PI * 2;
  return {
    id,
    name,
    animal,
    x: spawn.x + Math.cos(ang) * 2,
    y: 0,
    z: spawn.z + Math.sin(ang) * 2,
    yaw: 0,
    hp: balance.player.hp,
    maxHp: balance.player.hp,
    state: PSTATE.ALIVE,
    deadAt: 0,
    respawnAt: 0,
    lives: playerCount === 1 ? balance.match.soloLives : 1,
    revivesLeft: Math.max(0, playerCount - 1),
    invulnUntil: 0,
    afk: false,
    burn: null,
    poison: null,
    slow: null,
    grenades: balance.grenade.startCount,
    grenadeAt: balance.grenade.rechargeSec,
    reviving: null,   // { target, start, x, z }
    reviveProg: 0,    // 내가 부활 받는 중일 때 진행도
    hitTokens: balance.net.hitsPerSecMax,
    kills: 0,
    deaths: 0,
    dmg: 0,
    // 결과 화면 정산용 누적 기록
    revives: 0,        // 내가 살린 팀원 수
    grenadeKills: 0,   // 지우개 수류탄으로 잡은 몬스터
    bossKills: 0,      // 보스 막타
    survivedSec: 0,    // 살아 있던 시간
    escapedAt: 0,      // 탈출한 시각 (0 = 못 나감)
  };
}

export function createTagger({ taggerId, taggerName, taggerAnimal }, inkProfile) {
  return {
    id: taggerId,
    name: taggerName,
    animal: taggerAnimal || 'devil', // 결과 화면 단상에 세울 캐릭터
    ink: inkProfile.max,
    max: inkProfile.max,
    regen: inkProfile.regen,
    bossHp: inkProfile.bossHp,
    bossReadyAt: 0,
    recallUsed: new Map(), // 그림 해시 → 마지막 사용 시각 (최후 발악 재사용 대기)
    spawned: 0,
    bosses: 0,
  };
}

export function createMonster(id, pending, balance) {
  const s = pending.stats;
  return {
    id,
    x: pending.x,
    z: pending.z,
    y: s.fly ? balance.monster.flyHeight : 0,
    stats: s,
    hp: s.hp,
    maxHp: s.hp,
    target: null,
    retargetAt: 0,
    dashReadyAt: 0,
    dashUntil: 0,
    dashDir: null,
    dashHit: false,
    rangedReadyAt: 1,
    attacking: false,
  };
}
