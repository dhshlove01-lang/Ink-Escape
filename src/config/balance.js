// 모든 밸런스 수치는 여기 한 곳에만 둔다 (기획안 v1.1 기준 v0 수치).
// 코드 곳곳에 숫자를 박지 말고 이 객체를 주입받아 쓴다.

export const BALANCE = {
  match: {
    seconds: 600,            // 10분 버티기
    doorRevealLeft: 30,      // 남은 30초에 탈출 문 예고
    oneMinuteLeft: 60,
    reviveWaitSec: 60,       // 사망 후 60초 뒤부터 부활 가능
    reviveHoldSec: 2,        // 부활 버튼 2초 누르기
    reviveRange: 2.2,        // 시체와 이 거리 안에서만 부활 가능 (m)
    reviveMoveCancel: 0.6,   // 부활 중 이만큼 움직이면 취소 (m)
    reviveHpRatio: 0.5,      // 부활 시 HP 50%
    reviveInvulnSec: 2,
    soloLives: 2,            // 2인전(플레이어 1명) 목숨
    soloRespawnSec: 3,
  },

  player: {
    hp: 100,
    walk: 4,
    run: 6.5,
    jumpV: 7,
    gravity: 20,
    radius: 0.45,
    eye: 1.35,
  },

  gun: {
    mag: 30,
    reloadSec: 1,
    rps: 10,
    dmg: 10,
    range: 90,
  },

  grenade: {
    radius: 4,
    startCount: 1,
    max: 2,
    rechargeSec: 90,
    bossPct: 0.2,
    giantPct: 0.1,
    throwRange: 18,
    fuseSec: 0.8,
  },

  // 인원수 보정 (key = 플레이어 수)
  ink: {
    byPlayers: {
      1: { max: 100, regen: 0.5, bossHp: 1.0 },
      2: { max: 200, regen: 0.8, bossHp: 1.3 },
      3: { max: 200, regen: 1.1, bossHp: 1.6 },
      4: { max: 300, regen: 1.4, bossHp: 2.0 },
    },
    solo: { max: 300, regen: 3, bossHp: 1.0 }, // 혼자 테스트용 넉넉한 잉크
    minAreaPct: 3,       // 칠한 면적 3% 이상 (큰 외곽선 그림도 소환되게)
    minExtent: 0.2,      // 그림 높이나 너비가 도화지의 20% 이상
    bossCostMult: 2,
    giantMinInk: 100,
  },

  spawn: {
    delaySec: 3,
    minPlayerDist: 8,
    bossCooldownSec: 60,
    frenzyRecallCd: 3,
  },

  monster: {
    hpPerInk: 30,
    baseHeight: 2.5,     // 도화지 꽉 찬 그림 = 2.5m
    minHeight: 0.8,
    baseSpeed: 4.5,
    sizeSlow: 0.3,       // 클수록 최대 30% 느려짐
    meleeDps: 8,
    flyHeight: 3,
    dashCd: 6,
    dashMult: 3,
    dashSec: 0.6,
    dashBurst: 16,
    dashTrigger: 12,
    rangedCd: 2,
    projSpeed: 14,
    projDmg: 6,
  },

  boss: { size: 2.5, hp: 3, dmg: 2, speed: 0.9 },
  giant: { size: 4, dmg: 2.5, hpCap: 4000, speed: 0.75 },

  judge: {
    grid: 128,
    blackWeight: 0.6,    // 검정 외곽선 보정
    dualRatio: 0.55,     // 2위 색(검정은 보정 후)이 1위의 55% 이상이면 속성 2개 반반
    wingSideMin: 0.05,
    wingSymmetry: 0.45,
    wingUpperBias: 1.2,
    peakProminence: 0.18,
    limbRatio: 1.7,
    spikeCount: 5,
    limbRangeMin: 8,
    limbRangeMax: 15,
    comboRangeMult: 1.3,
  },

  net: {
    tickHz: 30,
    snapHz: 15,
    hitsPerSecMax: 13,
  },
};
