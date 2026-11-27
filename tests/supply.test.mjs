import test from 'node:test';
import assert from 'node:assert/strict';
import { SupplySystem } from '../src/server/systems/SupplySystem.js';
import { BALANCE } from '../src/config/balance.js';
import { createMap } from '../src/shared/map/maps.js';
import { PSTATE } from '../src/shared/protocol.js';

// 가짜 경기: 보급 시스템만 돌린다
function fakeMatch() {
  const map = createMap('palace');
  const events = [];
  let id = 1;
  const p = { id: 'p1', state: PSTATE.ALIVE, hp: 50, maxHp: 100, aug: {}, x: map.spawn.x, z: map.spawn.z };
  return {
    b: BALANCE, map, time: 0, duration: 600, events,
    players: new Map([['p1', p]]), crates: new Map(), offers: new Map(),
    tagger: { id: 't', aug: {} }, monsters: new Map(),
    nextId: () => id++, emit: (t, e) => events.push({ t, ...e }), sendTo: () => {},
  };
}

test('보급: 두 번째 보급은 회복 상자 — 주우면 HP 회복(최대 넘지 않음) + 카드', () => {
  const m = fakeMatch();
  const sys = new SupplySystem({ rng: () => 0.3 });
  const p = m.players.get('p1');
  for (const [i, at] of BALANCE.supply.times.entries()) {
    m.time = at;
    sys.update(m);
    const c = [...m.crates.values()][0];
    assert.ok(c, '상자가 떨어짐');
    assert.equal(c.kind, BALANCE.supply.healDrops.includes(i) ? 'heal' : 'supply');
    assert.ok(m.map.isFloor(c.x, c.z), '상자는 바닥(소품 위 아님)');
    const hp = p.hp;
    Object.assign(p, { x: c.x, z: c.z });
    m.offers.clear();
    sys.update(m);
    assert.ok(c.opened.has('p1'));
    const want = c.kind === 'heal' ? Math.min(p.maxHp, hp + BALANCE.supply.healHp) : hp;
    assert.equal(p.hp, want);
    assert.ok(m.offers.size >= 1, '카드도 받음');
  }
});
