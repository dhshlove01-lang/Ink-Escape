import { msg } from './i18n/strings.js';

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
    { key: 'survive', label: msg('score.survive'), detail: msg('detail.sec', { n: Math.round(num(p.survivedSec)) }), points: Math.floor(num(p.survivedSec)) * sc.survivalPerSec },
    { key: 'kill', label: msg('score.kill'), detail: msg('detail.count', { n: num(p.kills) }), points: num(p.kills) * sc.kill },
    { key: 'boss', label: msg('score.boss'), detail: msg('detail.count', { n: num(p.bossKills) }), points: num(p.bossKills) * sc.boss },
    { key: 'revive', label: msg('score.revive'), detail: msg('detail.reviveDmg', { r: num(p.revives), d: Math.round(num(p.dmg)) }), points: num(p.revives) * sc.revive + Math.round(num(p.dmg) * sc.dmg) },
    { key: 'escape', label: msg('score.escape'), detail: p.escaped ? msg('detail.escaped') : '—', points: p.escaped ? sc.escape : 0 },
  ];

  const taggerItems = [
    { key: 'spawn', label: msg('score.spawn'), detail: msg('detail.times', { n: num(tagger.spawned) }), points: num(tagger.spawned) * sc.taggerSpawn },
    { key: 'boss', label: msg('score.bossSpawn'), detail: msg('detail.times', { n: num(tagger.bosses) }), points: num(tagger.bosses) * sc.taggerBoss },
    { key: 'down', label: msg('score.down'), detail: msg('detail.times', { n: downs }), points: downs * sc.taggerDown },
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
    for (const p of players) if (num(p.kills) === bestKills) add('kills', msg('badge.kills'), p, msg('detail.count', { n: bestKills }));
  }
  for (const p of players) if (num(p.bossKills) > 0) add('boss', msg('badge.boss'), p, msg('detail.times', { n: num(p.bossKills) }));
  for (const p of players) if (p.escaped) add('escape', msg('badge.escape'), p, p.survivedSec ? msg('detail.survivedFor', { n: Math.round(num(p.survivedSec)) }) : msg('detail.alive'));
  for (const p of players) if (num(p.revives) > 0) add('revive', msg('badge.revive'), p, msg('detail.people', { n: num(p.revives) }));
  for (const p of players) if (num(p.grenadeKills) > 0) add('grenade', msg('badge.grenade'), p, msg('detail.count', { n: num(p.grenadeKills) }));
  for (const p of players) if (p.alive && !p.escaped) add('survive', msg('badge.survive'), p, msg('detail.hp', { n: Math.round(num(p.hp)) }));

  return out;
}
