import test from 'node:test';
import assert from 'node:assert/strict';
import { UpdateWatcher } from '../src/client/UpdateWatcher.js';

// 브라우저 대신: HEAD 응답의 Last-Modified, sessionStorage, location.replace 를 흉내
function stub(lastModified) {
  globalThis.fetch = async () => ({ ok: true, headers: { get: () => new Date(lastModified).toUTCString() } });
  const store = new Map();
  globalThis.sessionStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const went = [];
  globalThis.location = { href: 'https://x.io/Ink-Escape/', replace: (u) => went.push(u) };
  return went;
}

test('업데이트 감지: 같은 배포의 1초 차이는 무시, 진짜 새 배포만 / 같은 버전으로 연달아 새로고침하지 않음', async () => {
  const base = Date.UTC(2026, 10, 27, 5, 4, 14);
  stub(base - 1000); // CDN 서버마다 1초 다름 (그 버그)
  let w = new UpdateWatcher({ base, url: 'x' });
  let hit = 0;
  w.on('update', () => hit++);
  await w.check();
  await w.check();
  assert.equal(hit, 0);

  const went = stub(base + 5 * 60 * 1000); // 5분 뒤 새 배포
  w = new UpdateWatcher({ base, url: 'x' });
  w.on('update', () => hit++);
  await w.check();
  assert.equal(hit, 1);
  assert.equal(w.reload(), true);
  assert.match(went[0], /fresh=/);
  // 새로고침했는데 CDN 이 아직 옛 화면을 줬다: 같은 버전으로 또 새로고침하지 않는다
  const w2 = new UpdateWatcher({ base, url: 'x' });
  w2.on('update', () => {});
  await w2.check();
  assert.equal(w2.reload(), false);
  assert.equal(went.length, 1);
});
