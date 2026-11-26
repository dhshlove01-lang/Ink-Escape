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
  await page.waitForSelector('text=혼자 테스트', { timeout: 30000 });
  await page.click('text=혼자 테스트');
  await page.waitForTimeout(300);
  await page.click('text=게임 시작');
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
    tv.topdown.target = { x: sp.x + 12, z: sp.z };
    tv.spawn(tv.pad.getStrokes(), true);
  });
  await page.waitForTimeout(3400);
  const n = await page.evaluate(() => window.__app.session.latest.m.length);
  await page.keyboard.press('Tab');
  for (let i = 0; i < 5; i++) await page.evaluate(() => window.__app.views.player.weapon.fire());
  console.log(JSON.stringify({ monsters: n, errors }));
  await browser.close();
  process.exit(errors.length || n !== 1 ? 1 : 0);
})();
