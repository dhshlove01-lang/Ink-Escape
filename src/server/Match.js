import { EV, PSTATE, STATUS_BIT } from '../shared/protocol.js';
import { createPlayer, createTagger } from './entities.js';
import { buildResultStats } from '../shared/results.js';
import { COMMANDS } from './commands.js';
import { SpawnSystem } from './systems/SpawnSystem.js';
import { NavigationSystem, MonsterSystem, ProjectileSystem, GrenadeSystem, PlayerLifeSystem } from './systems/MonsterSystem.js';
import { ClockSystem, InkSystem, StatusSystem, EscapeSystem, VictorySystem } from './systems/core.js';
import { SupplySystem } from './systems/SupplySystem.js';
import { hitsPerSec, monsterDmgMult } from '../shared/augmentMath.js';
import { msg } from '../shared/i18n/strings.js';

// 경기 한 판. 상태를 들고, 시스템들을 순서대로 돌리고, 명령을 처리기에 넘긴다.
// 방장 PC 에서만 돈다 (방장 권한 구조).

export class Match {
  constructor({ balance, map, judge, paletteLength, roster, solo, settings, rng = Math.random, out }) {
    this.b = balance;
    this.map = map;
    this.solo = solo;
    this.out = out; // { emit(msg), sendTo(id, msg) }
    this.time = 0;
    this.duration = settings.matchSeconds;
    this.flags = { oneMin: false, revealed: false };
    this.doorIndex = Math.floor(rng() * map.doors.length);
    this.doorOpen = false;
    this.result = null;
    this._id = 1;

    const n = roster.players.length;
    this.players = new Map(roster.players.map((p, i) => [p.id, createPlayer(p, map.spawn, i, balance, n)]));
    const inkProfile = solo ? balance.ink.solo : balance.ink.byPlayers[Math.min(4, n)];
    this.tagger = createTagger(roster, inkProfile);

    this.monsters = new Map();
    this.pending = [];
    this.projectiles = [];
    this.grenades = [];
    this.crates = new Map();  // 보급 상자 id → { x, z, opened:Set }
    this.offers = new Map();  // 'side:id' → { cards, until }  고르는 중인 증강 카드
    this.puddles = [];        // 끈적 잉크 웅덩이 { x, z, r, until, slow }

    this.spawner = new SpawnSystem({ judge, paletteLength });
    this.supply = new SupplySystem({ rng });
    const nav = new NavigationSystem(map);
    this.systems = [
      new ClockSystem(),
      this.supply,
      new InkSystem(),
      this.spawner,
      nav,
      new MonsterSystem({ nav }),
      new ProjectileSystem(),
      new GrenadeSystem(),
      new StatusSystem(),
      new PlayerLifeSystem(),
      new EscapeSystem(),
      new VictorySystem(),
    ];
  }

  nextId() {
    return this._id++;
  }

  emit(e, data) {
    this.out.emit({ t: 'ev', e, ...data });
  }

  sendTo(id, msg) {
    this.out.sendTo(id, msg);
  }

  // 몬스터가 노릴 수 있는 플레이어
  targets() {
    const list = [];
    for (const p of this.players.values()) if (p.state === PSTATE.ALIVE && !p.afk) list.push(p);
    return list;
  }

  tick(dt) {
    if (this.result) return;
    this.time += dt;
    for (const p of this.players.values()) {
      const rate = hitsPerSec(this.b, p.aug); // 연사·관통 증강이면 더 많이
      p.hitTokens = Math.min(rate, p.hitTokens + rate * dt);
    }
    for (const s of this.systems) {
      s.update(this, dt);
      if (this.result) return;
    }
  }

  handle(clientId, msg) {
    const fn = COMMANDS[msg.t];
    if (fn) fn(this, this.players.get(clientId) || null, msg, clientId);
  }

  damagePlayer(p, amount, { onHit, silent } = {}) {
    if (p.state !== PSTATE.ALIVE || p.afk || this.time < p.invulnUntil || amount <= 0) return;
    p.hp -= amount;
    if (onHit) this.applyOnHit(p, onHit);
    if (!silent) this.emit(EV.PDAMAGE, { id: p.id, amount: Math.round(amount) });
    if (p.hp <= 0 && p.aug.heart && !p.heartUsed) {
      // 두 번째 심장: 한 번 HP 1 로 버티고 잠깐 무적
      p.heartUsed = true;
      p.hp = 1;
      p.invulnUntil = this.time + this.b.aug.heart.invulnSec;
      Object.assign(p, { burn: null, poison: null });
      this.emit(EV.HEART, { id: p.id });
      return;
    }
    if (p.hp <= 0) this.killPlayer(p);
  }

  applyOnHit(p, h) {
    if (h.burn) p.burn = { until: this.time + h.burn.sec, dps: h.burn.dps };
    if (h.poison) p.poison = { until: this.time + h.poison.sec, dps: h.poison.dps };
    if (h.slow) p.slow = { until: this.time + h.slow.sec, amount: h.slow.amount };
  }

  killPlayer(p) {
    Object.assign(p, { hp: 0, state: PSTATE.DEAD, burn: null, poison: null, slow: null, reviving: null });
    p.deaths++;
    if (this.players.size === 1) {
      p.lives--;
      p.respawnAt = p.lives > 0 ? this.time + this.b.match.soloRespawnSec : 0;
    } else {
      p.deadAt = this.time;
      p.respawnAt = 0;
    }
    this.emit(EV.PDEATH, { id: p.id, x: p.x, z: p.z });
  }

  damageMonster(mon, amount, by, { grenade = false } = {}) {
    if (!this.monsters.has(mon.id)) return;
    mon.hp -= amount;
    if (mon.hp > 0) {
      this.emit(EV.MHIT, { id: mon.id });
      return;
    }
    this.monsters.delete(mon.id);
    const killer = this.players.get(by);
    if (killer) {
      killer.kills++;
      if (mon.stats.kind === 'boss') killer.bossKills++;
      if (grenade) killer.grenadeKills++;
      // 간식 탄: 처치하면 회복
      if (killer.aug.snack && killer.state === PSTATE.ALIVE) killer.hp = Math.min(killer.maxHp, killer.hp + killer.aug.snack * this.b.aug.snack.healOnKill);
    }
    const t = this.tagger;
    // 재활용: 쓴 잉크 일부 돌려받기
    if (t.aug.recycle && mon.cost) t.ink = Math.min(t.max, t.ink + mon.cost * this.b.aug.recycle.refund);
    // 끈적 잉크: 죽은 자리에 웅덩이
    if (t.aug.sticky) {
      const a = this.b.aug.sticky;
      this.puddles.push({ x: mon.x, z: mon.z, r: a.radius, until: this.time + a.sec, slow: a.slow });
      this.emit(EV.PUDDLE, { x: mon.x, z: mon.z, r: a.radius, sec: a.sec });
    }
    this.emit(EV.MDIE, { id: mon.id, by });
  }

  fireProjectile(mon, tgt) {
    const mb = this.b.monster;
    const s = mon.stats;
    const sx = mon.x, sy = mon.y + s.height * 0.6, sz = mon.z;
    const dx = tgt.x - sx, dy = tgt.y + 0.9 - sy, dz = tgt.z - sz;
    const d = Math.hypot(dx, dy, dz) || 1;
    const pr = {
      id: this.nextId(),
      x: sx, y: sy, z: sz,
      vx: (dx / d) * mb.projSpeed, vy: (dy / d) * mb.projSpeed, vz: (dz / d) * mb.projSpeed,
      dmg: mb.projDmg * (s.dps / mb.meleeDps) * monsterDmgMult(this.b, this.tagger.aug),
      onHit: s.onHit,
      ttl: s.ranged / mb.projSpeed + 0.6,
      color: s.attrs[0]?.key || 'black',
    };
    this.projectiles.push(pr);
    this.emit(EV.PROJ, { id: pr.id, x: sx, y: sy, z: sz, vx: pr.vx, vy: pr.vy, vz: pr.vz, ttl: pr.ttl, color: pr.color });
  }

  finish(winner, reason) {
    if (this.result) return;
    const players = [...this.players.values()].map((p) => ({
      id: p.id, name: p.name, animal: p.animal, kills: p.kills, deaths: p.deaths,
      dmg: Math.round(p.dmg), escaped: p.state === PSTATE.ESCAPED,
      alive: p.state === PSTATE.ALIVE || p.state === PSTATE.ESCAPED,
      hp: Math.max(0, Math.round(p.hp)),
      survivedSec: Math.round(p.survivedSec),
      revives: p.revives, grenadeKills: p.grenadeKills, bossKills: p.bossKills,
    }));
    const tagger = { id: this.tagger.id, name: this.tagger.name, animal: this.tagger.animal, spawned: this.tagger.spawned, bosses: this.tagger.bosses };
    const stats = buildResultStats(players, tagger, this.b.score);
    this.result = {
      winner,
      reason,
      time: this.time,
      duration: this.duration,
      players: stats.players,
      tagger: stats.tagger,
      badges: stats.badges,
    };
  }

  leave(id) {
    if (id === this.tagger.id && !this.solo) return this.finish('players', msg('reason.taggerLeft'));
    const p = this.players.get(id);
    if (!p) return;
    p.state = PSTATE.OUT;
    const anyLeft = [...this.players.values()].some((o) => o.state !== PSTATE.OUT);
    if (!anyLeft) this.finish('tagger', msg('reason.playersLeft'));
  }

  snapshot() {
    const t = this.tagger;
    const r1 = (v) => Math.round(v * 10) / 10;
    const r2 = (v) => Math.round(v * 100) / 100;
    const players = [];
    for (const p of this.players.values()) {
      let bits = 0;
      if (p.burn) bits |= STATUS_BIT.BURN;
      if (p.slow) bits |= STATUS_BIT.SLOW;
      if (p.poison) bits |= STATUS_BIT.POISON;
      if (this.time < p.invulnUntil) bits |= STATUS_BIT.INVULN;
      if (p.afk) bits |= STATUS_BIT.AFK;
      const dead = p.state === PSTATE.DEAD;
      players.push({
        id: p.id, x: r2(p.x), y: r2(p.y), z: r2(p.z), yaw: r2(p.yaw),
        hp: Math.max(0, Math.ceil(p.hp)), maxHp: p.maxHp, st: p.state,
        revIn: dead && p.respawnAt === 0 ? r1(Math.max(0, this.b.match.reviveWaitSec - (this.time - p.deadAt))) : -1,
        resIn: dead && p.respawnAt > 0 ? r1(p.respawnAt - this.time) : -1,
        revLeft: p.revivesLeft, lives: p.lives, prog: r2(p.reviveProg), bits, gren: p.grenades,
        slow: p.slow ? r2(p.slow.amount) : 0,
      });
    }
    const monsters = [];
    for (const m of this.monsters.values()) {
      monsters.push([m.id, r2(m.x), r2(m.z), Math.ceil(m.hp), m.maxHp, (m.dashUntil > this.time ? 1 : 0) | (m.attacking ? 2 : 0)]);
    }
    return {
      t: 'snap',
      time: r2(this.time),
      left: r1(Math.max(0, this.duration - this.time)),
      open: this.doorOpen,
      ink: r1(t.ink),
      inkMax: t.max,
      bossIn: r1(Math.max(0, t.bossReadyAt - this.time)),
      p: players,
      m: monsters,
    };
  }
}
