// 연결(Link) 인터페이스 — 게임 코드는 이것만 안다 (DIP).
//   send(msg)          메시지 보내기
//   onMessage(fn)      fn(msg)
//   onClose(fn)        fn()
//   close()
// 구현: MemoryLink(같은 브라우저 안), PeerLink(WebRTC/PeerJS). 나중에 SteamLink 를 더하면 된다.

export class BaseLink {
  constructor() {
    this._onMsg = [];
    this._onClose = [];
    this.closed = false;
  }

  onMessage(fn) {
    this._onMsg.push(fn);
  }

  onClose(fn) {
    this._onClose.push(fn);
  }

  _emitMessage(msg) {
    for (const fn of this._onMsg) {
      try {
        fn(msg);
      } catch (e) {
        console.error('[link] handler error', e);
      }
    }
  }

  _emitClose() {
    if (this.closed) return;
    this.closed = true;
    for (const fn of this._onClose) fn();
  }
}

// 같은 페이지 안 연결 한 쌍. 방장 자신의 클라이언트와 혼자 테스트에 쓴다.
export class MemoryLink extends BaseLink {
  static pair() {
    const a = new MemoryLink();
    const b = new MemoryLink();
    a.peer = b;
    b.peer = a;
    return [a, b];
  }

  send(msg) {
    if (this.closed) return;
    // 네트워크와 같은 조건이 되도록 복사하고 비동기로 전달
    const copy = JSON.parse(JSON.stringify(msg));
    queueMicrotask(() => this.peer && !this.peer.closed && this.peer._emitMessage(copy));
  }

  close() {
    const p = this.peer;
    this._emitClose();
    if (p) p._emitClose();
  }
}
