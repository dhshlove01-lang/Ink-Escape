import { Emitter } from './Emitter.js';

// 새 배포 감지: index.html 의 Last-Modified 가 지금 화면의 배포 시각(base)보다 새로워지면 'update' 를 낸다.
// (GitHub Pages 는 배포할 때마다 모든 파일의 Last-Modified 를 배포 시각으로 바꾼다 → 버전 파일이 따로 필요 없음)
// 무엇을 할지(바로 새로고침 / 판이 끝난 뒤)는 App 이 정한다 (SRP).

const POLL_MS = 60 * 1000; // 1분마다, 그리고 창으로 돌아올 때마다 확인

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
    this.check(); // 받아 둔 HTML 이 옛것이었으면 바로 잡힌다
    const check = () => this.check();
    this._timer = setInterval(check, POLL_MS);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
    window.addEventListener('focus', check);
  }

  async check() {
    if (this.found || this._busy) return;
    this._busy = true;
    const now = await this.stamp();
    this._busy = false;
    if (!now) return;
    if (!this.base) this.base = now;
    else if (now > this.base) {
      this.found = true;
      clearInterval(this._timer);
      this.emit('update');
    }
  }
}
