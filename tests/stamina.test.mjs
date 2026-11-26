import test from 'node:test';
import assert from 'node:assert/strict';
import { FpsController } from '../src/client/player/FpsController.js';
import { BALANCE } from '../src/config/balance.js';

// 화면 없이 기력 계산만 (FpsController.updateStamina)
const ctl = () => Object.assign(Object.create(FpsController.prototype), { b: BALANCE.player, stamina: 1, exhausted: false, running: false, _restAt: 0 });
const run = (c, sec, want, dt = 0.05) => { for (let t = 0; t < sec; t += dt) c.updateStamina(dt, want); };

test('달리기 기력: 4초 달리면 바닥 → 걷기만, 쉬면 회복해서 다시 달림', () => {
  const st = BALANCE.player.stamina;
  const c = ctl();
  run(c, st.sec - 0.3, true);
  assert.ok(c.running && c.stamina > 0);
  run(c, 0.6, true);
  assert.equal(c.stamina, 0);
  assert.ok(c.exhausted && !c.running, '바닥나면 못 달림');
  run(c, st.regenDelay + st.refillSec * st.restart + 0.2, false);
  c.updateStamina(0.05, true);
  assert.ok(c.running, '조금 차면 다시 달림');
  run(c, 10, false);
  assert.equal(c.stamina, 1);
});
