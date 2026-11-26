import { EV, MSG, PSTATE } from '../../shared/protocol.js';
import { AUGMENTS } from '../../config/augments.js';
import { CELL } from '../../shared/map/GameMap.js';

// 보급: 정해진 시각(balance.supply.times)에
//  - 플레이어: 맵에 상자가 떨어진다. 가서 닿으면 그 사람에게 증강 카드 3장 (사람마다 한 번씩)
//  - 술래: 카드 3장이 바로 온다
// 카드는 pickSec 안에 고르고(MSG.AUG_PICK), 안 고르면 무작위. 고른 증강은 그 판 끝까지 유지.
// 효과 대부분은 해당 시스템이 shared/augmentMath 로 읽고, 얻는 순간 한 번 적용할 것만 여기서(applyNow).

export class SupplySystem {
  constructor({ rng = Math.random } = {}) {
    this.rng = rng;
    this.next = 0; // 다음 보급 번호
  }

  update(m) {
    const sp = m.b.supply;
    if (this.next < sp.times.length && m.time >= sp.times[this.next] && m.time < m.duration) {
      this.next++;
      this.drop(m);
    }
    // 상자 줍기
    for (const c of m.crates.values()) {
      for (const p of m.players.values()) {
        if (p.state !== PSTATE.ALIVE || p.afk || c.opened.has(p.id)) continue;
        if (Math.hypot(p.x - c.x, p.z - c.z) > sp.pickupRadius) continue;
        if (m.offers.has(key('player', p.id))) continue; // 앞 카드를 아직 고르는 중
        c.opened.add(p.id);
        m.emit(EV.SUPPLY_TAKE, { id: c.id, by: p.id });
        this.offer(m, 'player', p.id);
      }
      const everyone = [...m.players.values()].filter((p) => p.state !== PSTATE.OUT && p.state !== PSTATE.ESCAPED);
      if (everyone.length && everyone.every((p) => c.opened.has(p.id))) {
        m.crates.delete(c.id);
        m.emit(EV.SUPPLY_GONE, { id: c.id });
      }
    }
    // 시간이 지난 카드는 무작위로
    for (const [k, o] of m.offers) {
      if (m.time >= o.until) this.choose(m, o.side, o.id, o.cards[Math.floor(this.rng() * o.cards.length)], k);
    }
  }

  // 상자 떨어뜨리기: 이전 상자는 치우고, 플레이어·문에서 떨어진 바닥에
  drop(m) {
    for (const c of m.crates.values()) m.emit(EV.SUPPLY_GONE, { id: c.id });
    m.crates.clear();
    const spot = this.pickSpot(m);
    if (spot) {
      const c = { id: m.nextId(), x: spot.x, z: spot.z, opened: new Set() };
      m.crates.set(c.id, c);
      m.emit(EV.SUPPLY, { id: c.id, x: c.x, z: c.z });
    }
    this.offer(m, 'tagger', m.tagger.id);
  }

  pickSpot(m) {
    const sp = m.b.supply;
    const map = m.map;
    const alive = [...m.players.values()].filter((p) => p.state === PSTATE.ALIVE);
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < 60; i++) {
      const room = map.rooms[Math.floor(this.rng() * map.rooms.length)];
      const x = room.x0 + CELL + this.rng() * (room.x1 - room.x0 - CELL * 2);
      const z = room.z0 + CELL + this.rng() * (room.z1 - room.z0 - CELL * 2);
      if (!map.isFloor(x, z) || map.solidAt(x + 0.8, z) || map.solidAt(x - 0.8, z) || map.solidAt(x, z + 0.8) || map.solidAt(x, z - 0.8)) continue;
      const near = alive.reduce((d, p) => Math.min(d, Math.hypot(p.x - x, p.z - z)), Infinity);
      const door = map.doors.reduce((d, dr) => Math.min(d, Math.hypot(dr.center.x - x, dr.center.z - z)), Infinity);
      if (door < sp.dropMinDoorDist) continue;
      // 너무 가깝지 않으면서(목표가 되게) 너무 멀지도 않게
      const score = near >= sp.dropMinPlayerDist ? 100 - Math.abs(near - sp.dropMinPlayerDist * 1.6) : near - 1000;
      if (score > bestScore) {
        bestScore = score;
        best = { x, z };
      }
    }
    return best;
  }

  owner(m, side, id) {
    return side === 'tagger' ? m.tagger : m.players.get(id);
  }

  // 그 쪽(side) 증강 중 아직 최대가 아닌 것에서 무작위 n 장
  offer(m, side, id) {
    const who = this.owner(m, side, id);
    if (!who) return;
    const pool = AUGMENTS[side].map((a) => a.key).filter((k) => (who.aug[k] || 0) < m.b.aug[k].max);
    const cards = [];
    while (pool.length && cards.length < m.b.supply.offer) cards.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
    if (!cards.length) return;
    const k = key(side, id);
    m.offers.set(k, { side, id, cards, until: m.time + m.b.supply.pickSec });
    m.sendTo(id, { t: MSG.OFFER, side, cards, sec: m.b.supply.pickSec });
  }

  pick(m, clientId, msg) {
    const side = msg.side === 'tagger' ? 'tagger' : 'player';
    const k = key(side, clientId);
    const o = m.offers.get(k);
    if (!o || !o.cards.includes(msg.key)) return;
    this.choose(m, side, clientId, msg.key, k);
  }

  choose(m, side, id, augKey, k) {
    m.offers.delete(k);
    const who = this.owner(m, side, id);
    if (!who) return;
    who.aug[augKey] = (who.aug[augKey] || 0) + 1;
    applyNow(m, side, who, augKey);
    m.emit(EV.AUG, { id: side === 'tagger' ? m.tagger.id : id, side, key: augKey, n: who.aug[augKey] });
  }
}

const key = (side, id) => `${side}:${id}`;

// 얻는 순간 한 번 바뀌는 것 (나머지는 각 시스템이 augmentMath 로 계산)
function applyNow(m, side, who, k) {
  const a = m.b.aug[k];
  if (side === 'player') {
    if (k === 'tummy') {
      who.maxHp += a.maxHp;
      if (who.state === PSTATE.ALIVE) who.hp = Math.min(who.maxHp, who.hp + a.maxHp);
    }
    if (k === 'rescue') who.revivesLeft += a.revives;
    return;
  }
  if (k === 'pencil') {
    who.max += a.ink;
    who.ink += a.ink;
  }
  if (k === 'sharpener') who.regen *= 1 + a.regen;
  if (k === 'thick') {
    // 이미 나와 있는 몬스터도 단단하게 (비율 유지)
    for (const mon of m.monsters.values()) {
      mon.maxHp = Math.round(mon.maxHp * (1 + a.hp));
      mon.hp = Math.round(mon.hp * (1 + a.hp));
    }
  }
}
