import { MSG } from '../shared/protocol.js';
import { Lobby } from './Lobby.js';
import { Match } from './Match.js';

// 방장 PC 의 서버. 연결(Link)들을 받아 로비 → 경기 → 결과 → 로비를 돈다.
// 어떤 통신 수단으로 들어온 Link 인지는 모른다 (DIP).

export class GameServer {
  constructor({ balance, judge, paletteLength, createMap, solo = false, now = () => performance.now() }) {
    this.b = balance;
    this.judge = judge;
    this.paletteLength = paletteLength;
    this.createMap = createMap;
    this.solo = solo;
    this.now = now;
    this.links = new Map();
    this.lobby = new Lobby();
    this.match = null;
    this.seq = 0;
    this._loop = null;
    this._ping = setInterval(() => this.broadcast({ t: MSG.PING, at: this.now() }), 2000);
  }

  attach(link) {
    const id = 'c' + ++this.seq;
    this.links.set(id, link);
    link.onMessage((msg) => this.onMessage(id, msg));
    link.onClose(() => this.onLeave(id));
    return id;
  }

  send(id, msg) {
    this.links.get(id)?.send(msg);
  }

  broadcast(msg) {
    for (const l of this.links.values()) l.send(msg);
  }

  broadcastLobby() {
    this.broadcast({ t: MSG.LOBBY, ...this.lobby.view(), solo: this.solo });
  }

  error(id, message) {
    this.send(id, { t: MSG.ERROR, message });
  }

  onMessage(id, msg) {
    if (!msg || typeof msg.t !== 'string') return;
    const lobbyOnly = (fn) => {
      if (this.match) return;
      const err = fn();
      if (err) this.error(id, err);
      this.broadcastLobby();
    };
    switch (msg.t) {
      case MSG.HELLO:
        if (this.match) return this.error(id, '이미 경기 중인 방이에요');
        if (!this.lobby.join(id, msg.name)) return this.error(id, '방이 가득 찼어요 (최대 5명)');
        this.send(id, { t: MSG.WELCOME, id });
        return this.broadcastLobby();
      case MSG.PONG: {
        const m = this.lobby.members.get(id);
        if (m) m.ping = Math.round(this.now() - Number(msg.at || 0));
        if (!this.match) this.broadcastLobby();
        return;
      }
      case MSG.PICK_ROLE:
        return lobbyOnly(() => this.lobby.pickRole(id, msg.role));
      case MSG.PICK_ANIMAL:
        return lobbyOnly(() => this.lobby.pickAnimal(id, msg.animal));
      case MSG.SETTINGS:
        return lobbyOnly(() => this.lobby.setSettings(id, msg));
      case MSG.START:
        if (this.match) return;
        if (id !== this.lobby.ownerId) return this.error(id, '방 만든 사람만 시작할 수 있어요');
        return this.startMatch(id);
      default:
        if (this.match) this.match.handle(id, msg);
    }
  }

  startMatch(id) {
    let roster;
    if (this.solo) {
      const me = this.lobby.members.get(id);
      roster = { taggerId: id, taggerName: me.name, players: [{ id, name: me.name, animal: me.animal }] };
    } else {
      roster = this.lobby.resolveRoster();
      if (roster.error) return this.error(id, roster.error);
    }
    const map = this.createMap('dungeon');
    this.match = new Match({
      balance: this.b,
      map,
      judge: this.judge,
      paletteLength: this.paletteLength,
      roster,
      solo: this.solo,
      settings: this.lobby.settings,
      out: { emit: (msg) => this.broadcast(msg), sendTo: (cid, msg) => this.send(cid, msg) },
    });
    for (const cid of this.links.keys()) {
      const isTagger = cid === roster.taggerId;
      const isPlayer = roster.players.some((p) => p.id === cid);
      this.send(cid, {
        t: MSG.MATCH_START,
        you: cid,
        role: this.solo ? 'both' : isTagger ? 'tagger' : isPlayer ? 'player' : 'spectator',
        roster,
        mapId: map.id,
        duration: this.lobby.settings.matchSeconds,
        solo: this.solo,
        playerCount: roster.players.length,
      });
    }
    this.startLoop();
  }

  startLoop() {
    this.stopLoop();
    let last = this.now();
    let snapAcc = 0;
    const step = 1 / this.b.net.tickHz;
    const snapStep = 1 / this.b.net.snapHz;
    this._loop = setInterval(() => {
      const t = this.now();
      let dt = Math.min(1, (t - last) / 1000); // 탭이 느려져도 시간은 맞게 (작은 단계로 나눠 계산)
      last = t;
      const m = this.match;
      if (!m) return;
      while (dt > 0 && !m.result) {
        const d = Math.min(step, dt);
        m.tick(d);
        dt -= d;
        snapAcc += d;
      }
      if (snapAcc >= snapStep || m.result) {
        snapAcc = 0;
        this.broadcast(m.snapshot());
      }
      if (m.result) this.endMatch();
    }, 1000 / this.b.net.tickHz);
  }

  stopLoop() {
    if (this._loop) clearInterval(this._loop);
    this._loop = null;
  }

  endMatch() {
    const res = this.match.result;
    this.stopLoop();
    this.match = null;
    this.broadcast({ t: MSG.GAME_OVER, ...res });
    this.broadcastLobby();
  }

  onLeave(id) {
    this.links.delete(id);
    this.lobby.leave(id);
    if (this.match) {
      this.match.leave(id);
      if (this.match.result) this.endMatch();
    }
    this.broadcastLobby();
  }

  // 방장이 나갈 때: 경기 중이면 결과를 먼저 보내고(술래였다면 플레이어 승리) 잠시 뒤 연결을 닫는다.
  shutdown(hostClientId) {
    if (this.match && !this.match.result) {
      this.match.leave(hostClientId);
      if (!this.match.result) this.match.finish(null, '방장이 나가서 경기가 끝났어요');
      this.endMatch();
    }
    this.stopLoop();
    clearInterval(this._ping);
    return new Promise((resolve) =>
      setTimeout(() => {
        for (const l of this.links.values()) l.close();
        resolve();
      }, 400),
    );
  }

  close() {
    this.stopLoop();
    clearInterval(this._ping);
    for (const l of this.links.values()) l.close();
  }
}
