// node --test tests/  (설치할 것 없음)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createJudge } from '../src/shared/judge/Judge.js';
import { BALANCE } from '../src/config/balance.js';
import { PALETTE, ATTRIBUTES } from '../src/shared/attributes.js';

const judge = createJudge({ balance: BALANCE, palette: PALETTE, attributes: ATTRIBUTES });
const opt = { boss: false, allIn: false, ink: 300, frenzy: false, inkProfile: { bossHp: 1 }, bossReadyIn: 0 };
const circle = (cx, cy, r, c, w = 14, n = 60) => {
  const p = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    p.push(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r));
  }
  return { c, w, p };
};
const fill = (cx, cy, r, c) => {
  const s = [];
  for (let rr = r; rr > 0; rr -= 10) s.push(circle(cx, cy, rr, c));
  return s;
};
const star = (cx, cy, r1, r2, k, c) => {
  const p = [];
  for (let i = 0; i <= k * 2; i++) {
    const a = (i / (k * 2)) * Math.PI * 2;
    const r = i % 2 ? r2 : r1;
    p.push(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r));
  }
  return { c, w: 12, p };
};

test('빈 그림과 너무 작은 그림은 소환 불가', () => {
  assert.equal(judge.judge([], opt).ok, false);
  assert.equal(judge.judge([circle(256, 256, 30, 1)], opt).ok, false);
});

test('빨강으로 채우면 화염 속성', () => {
  const r = judge.judge(fill(256, 256, 120, 2), opt);
  assert.ok(r.ok);
  assert.deepEqual(r.attrs.map((a) => a.key), ['red']);
});

test('검정 반 + 빨강 반 = 속성 2개 반반 (검정 외곽선 보정 포함)', () => {
  const r = judge.judge([...fill(150, 256, 90, 1), ...fill(360, 256, 90, 2)], opt);
  assert.equal(r.attrs.length, 2);
  assert.ok(r.attrs.every((a) => a.w === 0.5));
});

test('날개 → 비행, 날개 끝은 촉수로 치지 않음', () => {
  const s = [circle(256, 300, 80, 1), { c: 1, w: 14, p: [200, 250, 60, 90, 120, 240, 200, 280] }, { c: 1, w: 14, p: [312, 250, 452, 90, 392, 240, 312, 280] }, ...fill(256, 300, 60, 2)];
  const r = judge.judge(s, opt);
  assert.equal(r.traits.fly, true);
  assert.equal(r.traits.limbs, 0);
});

test('가시 별 → 돌진', () => {
  assert.equal(judge.judge([star(256, 256, 200, 110, 8, 1)], opt).traits.dash, true);
});

test('긴 촉수 + 보라 → 원거리', () => {
  const s = [circle(256, 200, 70, 5), { c: 5, w: 16, p: [256, 270, 250, 350, 270, 420, 250, 500] }, { c: 5, w: 16, p: [200, 240, 120, 330, 60, 420] }];
  const r = judge.judge(s, opt);
  assert.ok(r.stats.ranged > 0);
});

test('보스는 잉크 2배, HP 3배', () => {
  const s = fill(256, 256, 120, 2);
  const n = judge.judge(s, opt);
  const b = judge.judge(s, { ...opt, boss: true });
  assert.equal(b.cost, n.cost * 2);
  assert.equal(b.stats.hp, n.stats.hp * 3);
});

test('잉크 부족·보스 대기·최후 발악 올인 금지', () => {
  const s = fill(256, 256, 120, 2);
  assert.equal(judge.judge(s, { ...opt, ink: 3 }).ok, false);
  assert.equal(judge.judge(s, { ...opt, boss: true, bossReadyIn: 10 }).ok, false);
  assert.equal(judge.judge(s, { ...opt, boss: true, allIn: true, frenzy: true }).ok, false);
  assert.equal(judge.judge(s, { ...opt, frenzy: true }).cost, 0);
});

test('자유 색: 가장 가까운 기본 색이 속성, 방장은 rgb 로 다시 계산 (조작 방지)', async () => {
  const { nearestPaletteIndex, PALETTE: P } = await import('../src/shared/attributes.js');
  const { sanitizeStrokes } = await import('../src/shared/judge/Judge.js');
  const key = (hex) => P[nearestPaletteIndex(parseInt(hex.slice(1), 16))].key;
  assert.equal(key('#8b0000'), 'red');
  assert.equal(key('#4fc3f7'), 'blue');
  assert.equal(key('#663399'), 'purple');
  assert.equal(key('#111111'), 'black');
  assert.equal(key('#164cd9'), 'blue');   // 진한 파랑은 파랑
  assert.equal(key('#888888'), 'black');  // 회색 = 방어
  assert.equal(key('#ff9900'), 'yellow'); // 주황은 노랑 쪽
  // 보라색인데 빨강(2)이라고 속여 보내도 방장이 보라(5)로 고친다
  const [s] = sanitizeStrokes([{ c: 2, rgb: 0x663399, w: 18, p: [10, 10, 100, 100] }], P.length);
  assert.equal(P[s.c].key, 'purple');
});
