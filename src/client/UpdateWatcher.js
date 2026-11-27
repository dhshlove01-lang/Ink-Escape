import { Emitter } from './Emitter.js';

// 새 배포 감지: index.html 의 Last-Modified 가 지금 화면의 배포 시각(base)보다 새로워지면 'update' 를 낸다.
// (GitHub Pages 는 배포할 때마다 모든 파일의 Last-Modified 를 배포 시각으로 바꾼다 → 버전 파일이 따로 필요 없음)
// 무엇을 할지(바로 새로고침 / 판이 끝난 뒤)는 App 이 정한다 (SRP).

const POLL_MS = 60 * 1000; // 1분마다, 그리고 창으로 돌아올 때마다 확인
// 같은 배포라도 CDN 서버마다 Last-Modified 가 1~2초 다를 수 있다 (2026-11-27: 13초↔14초 차이로 새로고침이 끝없이 반복된 버그).
// 배포끼리는 몇 분씩 떨어져 있으므로, 이만큼 넘게 새로워야 "새 배포"로 본다.
const SAME_DEPLOY_MS = 60 * 1000;
const RELOAD_GUARD_MS = 2 * 60 * 1000; // 같은 새 버전 때문에 다시 새로고침하지 않는 시간
const RELOAD_KEY = 'ink.updateReload';

export class UpdateWatcher extends Emitter {
  constructor({ base = 0, url = new URL('index.html', location.href).href } = {}) {
    super();
    this.url = url;
    this.base = base; // 0 이면 처음 확인한 값을 기준으로
    this.found = false;
  }

  async stamp() {
    try {
      const r = await fetch(this.url, { method: 'HEAD', cache: 'no-store' });
      const lm = Date.parse(r.headers.get('last-modified') || '');
      return r.ok && lm ? lm : 0;
    } catch {
      return 0; // 오프라인 등: 이번엔 건너뜀
    }
  }

  start() {
    this._started = true;
    this.check(); // 받아 둔 HTML 이 옛것이었으면 바로 잡힌다
    const check = () => this.check();
    this._timer = setInterval(check, POLL_MS);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
    window.addEventListener('focus', check);
  }

  async check() {
    if (this.found || this._busy) return;
    if (!this._timer && this._started) this._timer = setInterval(() => this.check(), POLL_MS);
    this._busy = true;
    const now = await this.stamp();
    this._busy = false;
    if (!now) return;
    if (!this.base) this.base = now;
    else if (now > this.base + SAME_DEPLOY_MS) {
      this.found = true;
      this.latest = now;
      clearInterval(this._timer);
      this._timer = null;
      this.emit('update');
    }
  }

  // 새 버전으로 새로고침. 주소에 ?fresh=<배포시각> 을 붙여 CDN 의 옛 사본을 건너뛴다 (index.html 이 주소에서 다시 지움).
  // 같은 버전 때문에 방금(2분 안) 새로고침했는데 또 옛 화면이면 반복하지 않고 false (무한 새로고침 방지).
  reload() {
    let last = null;
    try {
      last = JSON.parse(sessionStorage.getItem(RELOAD_KEY) || 'null');
    } catch {}
    if (last && last.to === this.latest && Date.now() - last.at < RELOAD_GUARD_MS) {
      this.found = false; // 다음 확인(1분 뒤) 때 다시 판단
      return false;
    }
    try {
      sessionStorage.setItem(RELOAD_KEY, JSON.stringify({ to: this.latest, at: Date.now() }));
    } catch {}
    const u = new URL(location.href);
    u.searchParams.set('fresh', String(this.latest || Date.now()));
    location.replace(u.href);
    return true;
  }
}
