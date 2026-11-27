// 헤드리스 크로뮴으로 혼자 테스트 모드를 한 바퀴 돌린다: 시작 → 소환 → 사격. pageerror·404 가 0 이어야 한다.
// 사용: python3 -m http.server 8765 & node tools/smoke.cjs
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:8765/index.html';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => r.status() >= 400 && !r.url().includes('fonts.g') && errors.push(`${r.status()} ${r.url()}`));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.btn.ghost', { timeout: 30000 });
  await page.evaluate(() => document.querySelector('.btn.ghost').click());
  await page.waitForSelector('.btn.primary.big', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelector('.btn.primary.big').click()); // 잉크 화면은 헤드리스에서 느려 마우스 클릭이 자주 빗나감
  await page.waitForTimeout(800);
  await page.keyboard.press('Tab');
  await page.evaluate(() => {
    const tv = window.__app.views.tagger;
    const sp = window.__app.session.map.spawn;
    const s = [];
    for (let r = 110; r > 0; r -= 14) {
      const p = [];
      for (let i = 0; i <= 50; i++) {
        const a = (i / 50) * Math.PI * 2;
        p.push(Math.round(256 + Math.cos(a) * r), Math.round(256 + Math.sin(a) * r));
      }
      s.push({ c: 2, w: 18, p });
    }
    tv.pad.load(s);
    tv.beginPlace(tv.pad.getStrokes(), true); // SPAWN
    tv.onPick({ x: sp.x + 12, z: sp.z }); // 지도 클릭
  });
  // 소환 3초 뒤 등장 — 느린 헤드리스를 위해 최대 15초까지 기다림
  await page.waitForFunction(() => window.__app.session.latest?.m?.length >= 1, null, { timeout: 15000 }).catch(() => {});
  const n = await page.evaluate(() => window.__app.session.latest.m.length);
  await page.keyboard.press('Tab');
  for (let i = 0; i < 5; i++) await page.evaluate(() => window.__app.views.player.weapon.fire());
  console.log(JSON.stringify({ monsters: n, errors }));
  await browser.close();
  process.exit(errors.length || n !== 1 ? 1 : 0);
})();
