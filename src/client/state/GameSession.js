import { Emitter } from '../Emitter.js';
import { EV, MSG } from '../../shared/protocol.js';

// 클라이언트가 보는 경기 상태. 방장이 보낸 스냅샷·이벤트를 쌓고, 보간된 위치를 돌려준다.
// 술래 화면과 플레이어 화면이 같은 세션을 본다.

const INTERP_DELAY = 110; // ms

export class GameSession extends Emitter {
  constructor({ start, map, conn }) {
    super();
    this.conn = conn;
    this.map = map;
    this.me = start.you;
    this.role = start.role; // tagger | player | both | spectator
    this.roster = start.roster;
    this.duration = start.duration;
    this.solo = start.solo;
    this.playerCount = start.playerCount;
    this.snaps = [];
    this.latest = null;
    this.monsterMeta = new Map();
    this.pending = new Map();
    this.projectiles = new Map();
    this.doorRevealed = -1;
    this.doorOpen = false;
    this.crates = new Map(); // 보급 상자 id → { x, z, opened:Set, born }
    this.playerAugs = new Map(); // 플레이어 id → { 증강키: 개수 }
    this.taggerAugs = {}; // 술래 증강
    this.puddles = []; // 끈적 잉크 웅덩이 { x, z, r, until }

    this._off = [
      conn.on(MSG.SNAP, (s) => this.onSnap(s)),
      conn.on(MSG.EVENT, (ev) => this.onEvent(ev)),
      conn.on(MSG.SPAWN_RESULT, (r) => this.emit('spawnResult', r)),
      conn.on(MSG.OFFER, (o) => this.emit('offer', o)), // 나에게 온 증강 카드 (AugmentPicker 가 보여 줌)
    ];
  }

  dispose() {
    this._off.forEach((f) => f());
    this.clear();
  }

  send(msg) {
    this.conn.send(msg);
  }

  get isTagger() {
    return this.role === 'tagger' || this.role === 'both';
  }

  // 증강 개수 (augmentMath 에 넘기는 모양)
  augOf(id) {
    return this.playerAugs.get(id) || {};
  }

  pickAugment(side, key) {
    this.send({ t: MSG.AUG_PICK, side, key });
  }

  get isPlayer() {
    return this.role === 'player' || this.role === 'both';
  }

  nameOf(id) {
    const p = this.roster.players.find((x) => x.id === id);
    return p ? p.name : this.roster.taggerName;
  }

  animalOf(id) {
    return this.roster.players.find((x) => x.id === id)?.animal || 'shiba';
  }

  onSnap(s) {
    s._at = performance.now();
    s._p = new Map(s.p.map((p) => [p.id, p]));
    s._m = new Map(s.m.map((a) => [a[0], a]));
    this.snaps.push(s);
    if (this.snaps.length > 40) this.snaps.shift();
    this.latest = s;
    if (s.open && !this.doorOpen) this.setDoorOpen(this.doorRevealed);
    this.emit('snap', s);
  }

  setDoorOpen(i) {
    if (i < 0) return;
    this.doorOpen = true;
    this.map.setOpenDoor(i);
  }

  onEvent(ev) {
    const now = performance.now();
    switch (ev.e) {
      case EV.PENDING:
        this.pending.set(ev.id, { ...ev, until: now + ev.delay * 1000 });
        break;
      case EV.MSPAWN:
        this.pending.delete(ev.id);
        this.monsterMeta.set(ev.id, { strokes: ev.strokes, st: ev.st, x: ev.x, z: ev.z, born: now });
        break;
      case EV.MDIE:
        this.monsterMeta.delete(ev.id);
        break;
      case EV.DOOR_REVEAL:
        this.doorRevealed = ev.door;
        break;
      case EV.DOOR_OPEN:
        this.doorRevealed = ev.door;
        this.setDoorOpen(ev.door);
        break;
      case EV.PROJ:
        this.projectiles.set(ev.id, { ...ev, born: now });
        break;
      case EV.PROJ_END:
        this.projectiles.delete(ev.id);
        break;
      case EV.SUPPLY:
        this.crates.set(ev.id, { x: ev.x, z: ev.z, opened: new Set(), born: now });
        break;
      case EV.SUPPLY_TAKE:
        this.crates.get(ev.id)?.opened.add(ev.by);
        break;
      case EV.SUPPLY_GONE:
        this.crates.delete(ev.id);
        break;
      case EV.AUG:
        if (ev.side === 'tagger') this.taggerAugs[ev.key] = ev.n;
        else {
          const a = { ...this.augOf(ev.id) };
          a[ev.key] = ev.n;
          this.playerAugs.set(ev.id, a);
        }
        break;
      case EV.PUDDLE:
        this.puddles = this.puddles.filter((w) => w.until > now);
        this.puddles.push({ x: ev.x, z: ev.z, r: ev.r, until: now + ev.sec * 1000 });
        break;
    }
    this.emit(ev.e, ev);
  }

  myPlayer() {
    return this.latest?._p.get(this.me) || null;
  }

  players() {
    return this.latest ? this.latest.p : [];
  }

  // 보간용: 렌더 시각 앞뒤 스냅샷 두 개
  _pair() {
    const t = performance.now() - INTERP_DELAY;
    const s = this.snaps;
    if (!s.length) return null;
    for (let i = s.length - 1; i > 0; i--) {
      if (s[i - 1]._at <= t) {
        const a = s[i - 1], b = s[i];
        const k = Math.max(0, Math.min(1, (t - a._at) / Math.max(1, b._at - a._at)));
        return { a, b, k };
      }
    }
    return { a: s[0], b: s[0], k: 0 };
  }

  monsterPos(id) {
    const pr = this._pair();
    if (!pr) return null;
    const b = pr.b._m.get(id) || this.latest._m.get(id);
    if (!b) return null;
    const a = pr.a._m.get(id) || b;
    return { x: a[1] + (b[1] - a[1]) * pr.k, z: a[2] + (b[2] - a[2]) * pr.k, hp: b[3], maxHp: b[4], flags: b[5] };
  }

  playerPos(id) {
    const pr = this._pair();
    if (!pr) return null;
    const b = pr.b._p.get(id);
    if (!b) return null;
    const a = pr.a._p.get(id) || b;
    let dy = b.yaw - a.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    return { ...b, x: a.x + (b.x - a.x) * pr.k, y: a.y + (b.y - a.y) * pr.k, z: a.z + (b.z - a.z) * pr.k, yaw: a.yaw + dy * pr.k };
  }
}
