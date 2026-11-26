import { BaseLink } from './Link.js';

// PeerJS(WebRTC) 구현. 서버 없이 PC끼리 직접 연결한다.
// 방 코드 → PeerJS 아이디 "adfps1-<코드>". 방장 PC가 그 아이디로 기다린다.
// PeerJS 는 vendor/peerjs.min.js 가 window.Peer 로 올려 둔다.

const ID_PREFIX = 'adfps1-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomRoomCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

// 테스트용: ?peerHost=localhost&peerPort=9000&peerPath=/ 로 로컬 PeerJS 서버를 쓸 수 있다.
function peerOptions() {
  const q = new URLSearchParams(location.search);
  const opt = { debug: 1 };
  if (q.get('peerHost')) {
    opt.host = q.get('peerHost');
    opt.port = Number(q.get('peerPort') || 9000);
    opt.path = q.get('peerPath') || '/';
    opt.secure = q.get('peerSecure') === '1';
  }
  return opt;
}

class PeerLink extends BaseLink {
  constructor(conn) {
    super();
    this.conn = conn;
    conn.on('data', (d) => this._emitMessage(d));
    conn.on('close', () => this._emitClose());
    conn.on('error', () => this._emitClose());
  }

  send(msg) {
    if (!this.closed && this.conn.open) this.conn.send(msg);
  }

  close() {
    try {
      this.conn.close();
    } catch {}
    this._emitClose();
  }
}

function PeerCtor() {
  if (!window.Peer) throw new Error('net.noPeerjs');
  return window.Peer;
}

const ERR_KO = {
  'unavailable-id': 'net.unavailableId',
  'peer-unavailable': 'net.peerUnavailable',
  network: 'net.network',
  'server-error': 'net.serverError',
  'browser-incompatible': 'net.browser',
};
const errText = (e) => ERR_KO[e?.type] || e?.message || String(e);

/** 방장: 방 코드로 기다린다. onLink(link) 가 새 손님마다 불린다. */
export function hostRoom(code, onLink) {
  return new Promise((resolve, reject) => {
    const Peer = PeerCtor();
    const peer = new Peer(ID_PREFIX + code, peerOptions());
    let opened = false;
    peer.on('open', () => {
      opened = true;
      resolve({ code, close: () => peer.destroy() });
    });
    peer.on('connection', (conn) => {
      conn.on('open', () => onLink(new PeerLink(conn)));
    });
    peer.on('error', (e) => {
      if (!opened) {
        peer.destroy();
        reject(new Error(errText(e)));
      } else console.warn('[peer]', e);
    });
    peer.on('disconnected', () => {
      // 시그널링 서버와 끊겨도 이미 연결된 손님은 유지된다. 새 손님을 받으려면 재연결.
      if (!peer.destroyed) peer.reconnect();
    });
  });
}

/** 손님: 방 코드로 접속해서 Link 하나를 받는다. */
export function joinRoom(code) {
  return new Promise((resolve, reject) => {
    const Peer = PeerCtor();
    const peer = new Peer(undefined, peerOptions());
    let done = false;
    const fail = (e) => {
      if (done) return;
      done = true;
      peer.destroy();
      reject(new Error(errText(e)));
    };
    const timer = setTimeout(() => fail({ message: 'net.timeout' }), 15000);
    peer.on('open', () => {
      const conn = peer.connect(ID_PREFIX + code.toUpperCase(), { reliable: true, serialization: 'json' });
      conn.on('open', () => {
        done = true;
        clearTimeout(timer);
        const link = new PeerLink(conn);
        link.onClose(() => peer.destroy());
        resolve(link);
      });
      conn.on('error', fail);
    });
    peer.on('error', fail);
  });
}
