import test from 'node:test';
import assert from 'node:assert/strict';
import { KickSpring, CameraRecoil, FovPunch, CrosshairBloom } from '../src/client/player/GunFeel.js';
import { GUN_FEEL } from '../src/config/gunfeel.js';
import { BALANCE } from '../src/config/balance.js';

const run = (obj, sec, ...args) => { for (let t = 0; t < sec; t += 1 / 60) obj.update(1 / 60, ...args); };

test('킥백: 즉시 밀렸다가 스프링으로 원위치, 연사로 무한히 쌓이지 않음', () => {
  const k = new KickSpring();
  k.fire();
  assert.equal(k.pos.z, GUN_FEEL.kick.back);
  for (let i = 0; i < 20; i++) k.fire();
  assert.ok(k.pos.z <= GUN_FEEL.kick.back * GUN_FEEL.kick.maxStack + 1e-9);
  run(k, 1.5);
  assert.ok(Math.abs(k.pos.z) < 1e-3 && Math.abs(k.rot.x) < 1e-3);
});

test('카메라 반동: 발마다 위로 쌓이고(최대 제한) 멈추면 돌아온다', () => {
  const r = new CameraRecoil(BALANCE.gun.recoil);
  r.fire();
  const one = r.pitch;
  assert.ok(Math.abs(one - (BALANCE.gun.recoil.pitchDeg * Math.PI) / 180) < 1e-9);
  for (let i = 0; i < 100; i++) r.fire();
  assert.ok(r.pitch <= (BALANCE.gun.recoil.maxDeg * Math.PI) / 180 + 1e-9);
  run(r, 1.5);
  assert.ok(r.pitch < one * 0.05);
});

test('FOV 펀치: +1.2° 후 0.1초 안에 거의 원래대로', () => {
  const cam = { fov: 75, updateProjectionMatrix() {} };
  const f = new FovPunch(cam);
  f.fire();
  f.update(1 / 120);
  assert.ok(cam.fov > 75.5);
  run(f, 0.12);
  assert.ok(cam.fov - 75 < 0.05);
});

test('크로스헤어: 발당 +5px, 최대 45, 멈추면 기본 10 으로, 달리면 더 벌어짐', () => {
  const c = GUN_FEEL.crosshair;
  const b = new CrosshairBloom();
  b.fire();
  assert.equal(b.px, c.base + c.perShot);
  for (let i = 0; i < 30; i++) b.fire();
  assert.equal(b.px, c.max);
  run(b, 1.2);
  assert.ok(Math.abs(b.px - c.base) < 0.5);
  run(b, 1.2, { moving: true, running: true });
  assert.ok(Math.abs(b.px - (c.base + c.run)) < 0.5);
});
