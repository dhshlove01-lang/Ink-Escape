import test from 'node:test';
import assert from 'node:assert/strict';
import { createMap } from '../src/shared/map/maps.js';

test('궁전 맵: 둥근 벽 밖으로 못 나가고, 소품에 부딪히고, 문 입구는 열려 있다', () => {
  const m = createMap('palace');
  const b = m.bounds;
  // 둥근 벽: 동남쪽(문 없음)으로 밀면 반지름 안으로 돌아온다
  const out = m.collideCircle(b.x + 30, b.z + 30, 0.4);
  assert.ok(Math.hypot(out.x - b.x, out.z - b.z) <= b.r - 0.4 + 1e-6);
  // 왕좌(상자)·통(원) 안으로 들어가면 밖으로 밀린다
  for (const p of m.solids) {
    const q = m.collideCircle(p.x + 0.05, p.z + 0.05, 0.4);
    assert.ok(Math.hypot(q.x - p.x, q.z - p.z) > 0.3, `${p.kind} 통과`);
    assert.equal(m.isFloor(p.x, p.z), false, `${p.kind} 위가 바닥으로 잡힘`);
  }
  // 키 큰 소품(왕좌)은 총알·시야를 막는다
  const th = m.props.find((p) => p.kind === 'throne');
  assert.ok(m.raycast(th.x, th.z - 8, 0, 1, 20) < 8);
  // 북쪽 문 입구: 둥근 벽이 막지 않는다 (문 칸까지 걸어갈 수 있음)
  const n = m.doors.find((d) => d.name === 'door.north');
  const front = m.collideCircle(n.center.x, n.center.z + 2.5, 0.4);
  assert.ok(Math.abs(front.z - (n.center.z + 2.5)) < 1e-6);
  // 문이 열리면 그 칸에 들어가 탈출 판정
  m.setOpenDoor(m.doors.indexOf(n));
  assert.ok(m.inOpenDoor(n.center.x, n.center.z));
  // 소환·보급 자리: 스폰·방 중심은 바닥
  assert.ok(m.isFloor(m.spawn.x, m.spawn.z));
  for (const c of m.roomCenters) assert.ok(m.isFloor(c.x, c.z));
});

test('소품 위에 올라서기: 점프로 닿는 높이(윗면 근처 이상)면 막지 않고 발판이 된다', () => {
  const m = createMap('palace');
  const crate = m.solids.find((p) => p.kind === 'crate');
  // 바닥에서는 막힘
  const q = m.collideCircle(crate.x + 0.05, crate.z, 0.45, 0);
  assert.ok(Math.hypot(q.x - crate.x, q.z - crate.z) > 0.5);
  assert.equal(m.groundAt(crate.x, crate.z, 0.2, 0.5), 0); // 윗면보다 한참 아래: 발판 아님
  // 점프해서 윗면보다 높으면 지나가고, 위에 서면 발판 높이 = 윗면
  const over = m.collideCircle(crate.x + 0.05, crate.z, 0.45, crate.h + 0.1);
  assert.ok(Math.abs(over.x - (crate.x + 0.05)) < 1e-6);
  assert.equal(m.groundAt(crate.x, crate.z, 0.2, crate.h + 0.05), crate.h);
  // 점프 최고 높이(jumpV²/2g)보다 높은 왕좌는 못 올라감 (데이터 확인)
  const th = m.solids.find((p) => p.kind === 'throne');
  assert.ok(th.h > 7 * 7 / (2 * 20));
});
