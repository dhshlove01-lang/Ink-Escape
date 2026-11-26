// 모든 밸런스 수치는 여기 한 곳에만 둔다 (기획안 v1.1 기준 v0 수치).
// 2026-11-26 사용자 결정: 목표 승률 술래:플레이어 50:50, 플레이어는 FPS 초보·캐주얼(명중률 40~50%) 기준으로 맞춘다.
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
    // 달리기 기력: 쉬지 않고 이만큼(초) 달리면 바닥. 몬스터(4.5m/s)가 걷는 플레이어(4m/s)보다 빨라서 계속 도망만 칠 수는 없다
    stamina: {
      sec: 4,            // 가득 → 바닥까지 달릴 수 있는 시간
      refillSec: 5,      // 바닥 → 가득까지 회복 시간 (달리지 않을 때)
      regenDelay: 0.8,   // 달리기를 멈추고 이만큼 뒤부터 회복
      restart: 0.3,      // 바닥난 뒤 이만큼(비율) 차야 다시 달릴 수 있다
    },
  },

  gun: {
    mag: 30,
    reloadSec: 1,
    rps: 10,
    dmg: 10,
    range: 90,
    holeSec: 5, // 벽·바닥 총알 자국이 남는 시간(초)
    holeMax: 60, // 동시에 남는 자국 최대 개수 (넘으면 오래된 것부터 지움)
  },

  grenade: {
    radius: 4,
    startCount: 1,
    max: 2,
    rechargeSec: 90,
    normalPct: 0.6,      // 일반 몬스터: 최대 HP 의 60% (한 방에 다 지우지 않음 — 총으로 마무리)
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
    maxHeight: 5.4,      // 몬스터 꼭대기 한계(m). 천장 7m 에서 종이 테두리·흔들림·머리 위 아이콘 여유를 뺀 값 — 보스·초대형도 넘지 않는다
    minFlyY: 0.6,        // 큰 비행 몬스터는 천장에 닿지 않게 이만큼까지 낮게 난다
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

  // 결과 화면 점수 정산 (플레이어·술래 각각)
  score: {
    survivalPerSec: 10,   // 살아 있던 초당
    kill: 60,             // 몬스터 처치 1마리
    boss: 300,            // 보스 막타 1마리
    revive: 120,          // 팀원 1명 부활
    dmg: 0.5,             // 입힌 피해 1당
    escape: 500,          // 탈출 성공
    taggerSpawn: 20,      // 술래: 소환 1회
    taggerBoss: 100,      // 술래: 보스 소환 1회
    taggerDown: 40,       // 술래: 플레이어 1명 쓰러뜨림
  },
};
