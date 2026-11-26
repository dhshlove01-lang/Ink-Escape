// 결과 화면에 쓰는 뱃지(플레이 요약)와 점수 정산.
// 방장 서버가 한 번 계산해서 모든 참가자에게 같은 숫자를 보낸다 (화면은 표시만 한다).
// 점수 가중치는 src/config/balance.js 의 score 에만 있다.

const num = (v) => (Number.isFinite(v) ? v : 0);

/**
 * @param players finish() 가 만든 플레이어 배열 (kills·deaths·dmg·revives·grenadeKills·bossKills·survivedSec·escaped·alive)
 * @param tagger  { id, name, spawned, bosses }
 * @param sc      BALANCE.score
 */
export function buildResultStats(players, tagger, sc) {
  const downs = players.reduce((a, p) => a + num(p.deaths), 0);

  const playerItems = (p) => [
    { key: 'survive', label: '생존 시간', detail: `${Math.round(num(p.survivedSec))}초`, points: Math.floor(num(p.survivedSec)) * sc.survivalPerSec },
    { key: 'kill', label: '몬스터 처치', detail: `${num(p.kills)}마리`, points: num(p.kills) * sc.kill },
    { key: 'boss', label: '보스 처치', detail: `${num(p.bossKills)}마리`, points: num(p.bossKills) * sc.boss },
    { key: 'revive', label: '부활·기여', detail: `부활 ${num(p.revives)}회 · 피해 ${Math.round(num(p.dmg))}`, points: num(p.revives) * sc.revive + Math.round(num(p.dmg) * sc.dmg) },
    { key: 'escape', label: '탈출 보너스', detail: p.escaped ? '탈출 성공' : '—', points: p.escaped ? sc.escape : 0 },
  ];

  const taggerItems = [
    { key: 'spawn', label: '몬스터 소환', detail: `${num(tagger.spawned)}회`, points: num(tagger.spawned) * sc.taggerSpawn },
    { key: 'boss', label: '보스 소환', detail: `${num(tagger.bosses)}회`, points: num(tagger.bosses) * sc.taggerBoss },
    { key: 'down', label: '플레이어 무력화', detail: `${downs}회`, points: downs * sc.taggerDown },
  ];

  const withScore = (items) => ({ items, total: items.reduce((a, i) => a + i.points, 0) });

  const scored = players.map((p) => ({ ...p, score: withScore(playerItems(p)) }));
  const taggerScore = withScore(taggerItems);

  return {
    players: scored,
    tagger: { ...tagger, downs, score: taggerScore },
    badges: buildBadges(players),
  };
}

// 뱃지: 실제 판 기록에서만 만든다 (0 이면 안 붙인다).
function buildBadges(players) {
  const out = [];
  const add = (key, label, p, value) => out.push({ key, label, value, playerId: p.id, playerName: p.name, animal: p.animal });

  const bestKills = Math.max(0, ...players.map((p) => num(p.kills)));
  if (bestKills > 0) {
    for (const p of players) if (num(p.kills) === bestKills) add('kills', '최다 처치', p, `${bestKills}마리`);
  }
  for (const p of players) if (num(p.bossKills) > 0) add('boss', '보스 막타', p, `${num(p.bossKills)}회`);
  for (const p of players) if (p.escaped) add('escape', '탈출 성공', p, p.survivedSec ? `${Math.round(num(p.survivedSec))}초 생존 후` : '생존');
  for (const p of players) if (num(p.revives) > 0) add('revive', '팀원 부활', p, `${num(p.revives)}명`);
  for (const p of players) if (num(p.grenadeKills) > 0) add('grenade', '지우개 명중', p, `${num(p.grenadeKills)}마리`);
  for (const p of players) if (p.alive && !p.escaped) add('survive', '끝까지 생존', p, 'HP ' + Math.round(num(p.hp)));

  return out;
}
