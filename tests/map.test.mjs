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
