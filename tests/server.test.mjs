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
