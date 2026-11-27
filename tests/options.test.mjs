import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { DEFAULTS, EDITABLE, leaves, applyRules, currentRules, validRule } from '../src/config/balanceStore.js';
import { STRINGS } from '../src/shared/i18n/strings.js';

// OptionsView.labelOf 와 같은 규칙으로 글씨 키를 만든다
const keyOf = (p) => {
  const k = p.split('.');
  if (k[0] === 'aug') return ['aug.' + k[1] + '.name', 'opt.augp.' + k[2]];
  if (k[0] === 'ink' && k[1] === 'byPlayers') return ['opt.ink.' + k[3]];
  return ['opt.' + p];
};

test('옵션 창: 바꿀 수 있는 모든 밸런스 값에 한국어·영어 이름이 있다', () => {
  const missing = [];
  for (const [p] of leaves(DEFAULTS)) {
    if (!EDITABLE(p)) continue;
    for (const key of keyOf(p)) for (const lang of ['ko', 'en']) if (!STRINGS[lang][key]) missing.push(`${lang}:${key}`);
  }
  assert.deepEqual(missing, []);
});

test('규칙 적용·되돌리기: 바꾼 값만 규칙이 되고, 잘못된 값은 버리고, 기본값으로 돌아간다', () => {
  const gun = BALANCE.gun; // 다른 코드가 들고 있는 하위 객체도 그대로 따라가야 한다
  applyRules({ 'gun.dmg': 15, 'supply.times': [60, 120], 'player.walk': -3, 'judge.grid': 1, 'nope.x': 1 });
  assert.equal(gun.dmg, 15);
  assert.deepEqual(BALANCE.supply.times, [60, 120]);
  assert.equal(BALANCE.player.walk, DEFAULTS.player.walk); // 음수 거부
  assert.equal(BALANCE.judge.grid, DEFAULTS.judge.grid); // 판정 값은 옵션 대상 아님
  assert.deepEqual(currentRules(), { 'gun.dmg': 15, 'supply.times': [60, 120] });
  assert.equal(validRule('gun.dmg', 'abc'), false);
  applyRules({});
  assert.deepEqual(currentRules(), {});
  assert.equal(gun.dmg, DEFAULTS.gun.dmg);
});

test('방장 규칙이 로비·경기 시작 메시지로 들어온 사람에게 간다', async () => {
  const { GameServer } = await import('../src/server/GameServer.js');
  const { MemoryLink } = await import('../src/net/Link.js');
  const { createJudge } = await import('../src/shared/judge/Judge.js');
  const { PALETTE, ATTRIBUTES } = await import('../src/shared/attributes.js');
  const { createMap } = await import('../src/shared/map/maps.js');
  applyRules({ 'gun.dmg': 12, 'player.hp': 150 });
  const srv = new GameServer({ balance: BALANCE, judge: createJudge({ balance: BALANCE, palette: PALETTE, attributes: ATTRIBUTES }), paletteLength: PALETTE.length, createMap, solo: false });
  const logs = [];
  for (let i = 0; i < 2; i++) {
    const [a, b] = MemoryLink.pair();
    srv.attach(a);
    const log = [];
    b.onMessage((m) => log.push(m));
    logs.push({ b, log });
    b.send({ t: 'hello', name: 'P' + i });
  }
  await new Promise((r) => setTimeout(r, 20));
  logs[0].b.send({ t: 'role', role: 'tagger' });
  logs[0].b.send({ t: 'start' });
  await new Promise((r) => setTimeout(r, 30));
  const lobby = logs[1].log.filter((m) => m.t === 'lobby').pop();
  const start = logs[1].log.find((m) => m.t === 'mstart');
  assert.deepEqual(lobby.rules, { 'gun.dmg': 12, 'player.hp': 150 });
  assert.deepEqual(start.rules, { 'gun.dmg': 12, 'player.hp': 150 });
  srv.close();
  applyRules({});
});
