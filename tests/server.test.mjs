import test from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../src/server/GameServer.js';
import { MemoryLink } from '../src/net/Link.js';
import { createJudge } from '../src/shared/judge/Judge.js';
import { BALANCE } from '../src/config/balance.js';
import { PALETTE, ATTRIBUTES } from '../src/shared/attributes.js';
import { createMap } from '../src/shared/map/maps.js';

const judge = createJudge({ balance: BALANCE, palette: PALETTE, attributes: ATTRIBUTES });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const blob = () => {
  const s = [];
  for (let r = 120; r > 0; r -= 10) {
    const p = [];
    for (let i = 0; i <= 50; i++) {
      const a = (i / 50) * Math.PI * 2;
      p.push(Math.round(256 + Math.cos(a) * r), Math.round(256 + Math.sin(a) * r));
    }
    s.push({ c: 2, w: 14, p });
  }
  return s;
};

async function setup(n) {
  const srv = new GameServer({ balance: BALANCE, judge, paletteLength: PALETTE.length, createMap, solo: false });
  const cs = [];
  for (let i = 0; i < n; i++) {
    const [a, b] = MemoryLink.pair();
    srv.attach(a);
    const log = [];
    b.onMessage((m) => log.push(m));
    cs.push({ link: b, log });
    b.send({ t: 'hello', name: 'P' + i });
  }
  await sleep(10);
  return { srv, cs };
}

test('역할: 술래는 먼저 누른 한 명만', async () => {
  const { srv, cs } = await setup(3);
  cs[0].link.send({ t: 'role', role: 'tagger' });
  cs[1].link.send({ t: 'role', role: 'tagger' });
  await sleep(10);
  assert.ok(cs[1].log.some((m) => m.t === 'err'));
  cs[0].link.send({ t: 'start' });
  await sleep(20);
  assert.deepEqual(cs.map((c) => c.log.find((m) => m.t === 'mstart').role), ['tagger', 'player', 'player']);
  srv.close();
});

test('소환: 플레이어 8m 안은 거절, 3초 뒤 등장, 처치 가능', async () => {
  const { srv, cs } = await setup(2);
  cs[0].link.send({ t: 'role', role: 'tagger' });
  cs[0].link.send({ t: 'start' });
  await sleep(20);
  const sp = srv.match.map.spawn;
  cs[0].link.send({ t: 'spawn', strokes: blob(), x: sp.x + 3, z: sp.z });
  cs[0].link.send({ t: 'spawn', strokes: blob(), x: sp.x + 14, z: sp.z });
  await sleep(20);
  const res = cs[0].log.filter((m) => m.t === 'spres').map((m) => m.ok);
  assert.deepEqual(res, [false, true]);
  assert.equal(srv.match.monsters.size, 0);
  await sleep(3200);
  assert.equal(srv.match.monsters.size, 1);
  const mon = [...srv.match.monsters.values()][0];
  for (let i = 0; i < 80 && srv.match.monsters.size; i++) {
    cs[1].link.send({ t: 'hit', id: mon.id });
    await sleep(80);
  }
  assert.equal(srv.match?.monsters.size ?? 0, 0);
  srv.close();
});

test('술래가 나가면 플레이어 승리', async () => {
  const { srv, cs } = await setup(2);
  cs[0].link.send({ t: 'role', role: 'tagger' });
  cs[0].link.send({ t: 'start' });
  await sleep(20);
  cs[0].link.close();
  await sleep(20);
  const over = cs[1].log.find((m) => m.t === 'over');
  assert.equal(over.winner, 'players');
  srv.close();
});

test('지우개 수류탄: 일반 몬스터는 최대 HP 의 60% (한 방에 안 지워짐)', async () => {
  const { srv, cs } = await setup(2);
  cs[0].link.send({ t: 'role', role: 'tagger' });
  cs[0].link.send({ t: 'start' });
  await sleep(20);
  const sp = srv.match.map.spawn;
  cs[0].link.send({ t: 'spawn', strokes: blob(), x: sp.x + 14, z: sp.z });
  await sleep(3300);
  const mon = [...srv.match.monsters.values()][0];
  const by = [...srv.match.players.values()].find((p) => p.role !== 'tagger')?.id;
  srv.match.grenades.push({ x: mon.x, z: mon.z, at: srv.match.time, by });
  await sleep(120);
  assert.ok(srv.match.monsters.has(mon.id), '살아 있어야 함');
  assert.ok(Math.abs(mon.hp - mon.maxHp * (1 - BALANCE.grenade.normalPct)) <= 1, `hp ${mon.hp} / ${mon.maxHp}`);
  srv.close();
});

test('보급: 상자를 주우면 카드 3장 → 고른 증강 적용, 술래는 자동 카드, 안 고르면 무작위', async () => {
  const { srv, cs } = await setup(2);
  cs[0].link.send({ t: 'role', role: 'tagger' });
  cs[0].link.send({ t: 'start' });
  await sleep(20);
  const m = srv.match;
  m.supply.drop(m);
  await sleep(20);
  const crate = [...m.crates.values()][0];
  assert.ok(crate, '상자가 떨어짐');
  assert.ok(cs[1].log.some((x) => x.t === 'ev' && x.e === 'supply'));
  // 술래는 바로 카드
  const tOffer = cs[0].log.find((x) => x.t === 'offer');
  assert.equal(tOffer.side, 'tagger');
  assert.equal(tOffer.cards.length, 3);
  // 플레이어가 상자로 가면 카드
  cs[1].link.send({ t: 'ps', x: crate.x, y: 0, z: crate.z, yaw: 0 });
  await sleep(120);
  const pOffer = cs[1].log.find((x) => x.t === 'offer');
  assert.equal(pOffer.side, 'player');
  assert.equal(pOffer.cards.length, 3);
  // 통통한 배를 고를 수 있게 카드를 바꿔 넣고 고르기
  const p = [...m.players.values()][0];
  m.offers.get(`player:${p.id}`).cards[0] = 'tummy';
  cs[1].link.send({ t: 'augpick', side: 'player', key: 'tummy' });
  await sleep(60);
  assert.equal(p.aug.tummy, 1);
  assert.equal(p.maxHp, BALANCE.player.hp + BALANCE.aug.tummy.maxHp);
  assert.ok(cs[0].log.some((x) => x.t === 'ev' && x.e === 'aug' && x.key === 'tummy'), '모두에게 알림');
  // 술래 카드는 시간이 지나면 무작위로
  m.offers.get(`tagger:${m.tagger.id}`).until = m.time;
  await sleep(80);
  assert.equal(Object.values(m.tagger.aug).reduce((a, b) => a + b, 0), 1);
  // 모두 열었으면 상자는 사라짐 (플레이어 1명)
  assert.equal(m.crates.size, 0);
  srv.close();
});

test('증강 효과: 두 번째 심장·간식 탄·그림자 소환', async () => {
  const { srv, cs } = await setup(2);
  cs[0].link.send({ t: 'role', role: 'tagger' });
  cs[0].link.send({ t: 'start' });
  await sleep(20);
  const m = srv.match;
  const p = [...m.players.values()][0];
  // 두 번째 심장: 죽을 피해를 한 번 버팀
  p.aug.heart = 1;
  m.damagePlayer(p, 999);
  assert.equal(p.state, 0);
  assert.equal(p.hp, 1);
  m.time = p.invulnUntil + 0.1;
  m.damagePlayer(p, 999);
  assert.equal(p.state, 1, '두 번째는 죽음');
  // 그림자 소환: 5m 까지 허용
  const sp = m.map.spawn;
  const q = [...m.players.values()][0];
  Object.assign(q, { state: 0, hp: 100, x: sp.x, z: sp.z });
  cs[0].link.send({ t: 'spawn', strokes: blob(), x: sp.x + 6.5, z: sp.z });
  await sleep(30);
  m.tagger.aug.shadow = 1;
  cs[0].link.send({ t: 'spawn', strokes: blob(), x: sp.x + 6.5, z: sp.z });
  await sleep(30);
  assert.deepEqual(cs[0].log.filter((x) => x.t === 'spres').map((x) => x.ok), [false, true]);
  srv.close();
});
