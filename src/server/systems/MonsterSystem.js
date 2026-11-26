import { EV, PSTATE } from '../../shared/protocol.js';
import { CELL } from '../../shared/map/GameMap.js';
import { FlowField } from '../nav/FlowField.js';

// 몬스터 행동: 가장 가까운(갈 수 있는 길 기준) 살아 있는 플레이어를 쫓는다.
// 근접 공격 · 돌진 · 원거리 발사. 처치되기 전엔 사라지지 않는다.

export class NavigationSystem {
  constructor(map) {
    this.map = map;
    this.fields = new Map(); // playerId → FlowField
    this.timer = 0;
  }

  update(m, dt) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.4;
    const live = new Set();
    for (const p of m.targets()) {
      live.add(p.id);
      let f = this.fields.get(p.id);
      if (!f) this.fields.set(p.id, (f = new FlowField(this.map)));
      f.build(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
    }
    for (const id of this.fields.keys()) if (!live.has(id)) this.fields.delete(id);
  }

  field(id) {
    return this.fields.get(id);
  }
}

export class MonsterSystem {
  constructor({ nav }) {
    this.nav = nav;
  }

  update(m, dt) {
    const targets = m.targets();
    const mb = m.b.monster;
    const list = [...m.monsters.values()];

    for (const mon of list) {
      const s = mon.stats;
      mon.attacking = false;

      // 목표 고르기 (0.5초마다)
      if (m.time >= mon.retargetAt || !targets.includes(mon.target)) {
        mon.retargetAt = m.time + 0.5;
        mon.target = this.pickTarget(mon, targets);
      }
      const tgt = mon.target;
      let vx = 0, vz = 0;

      if (mon.dashUntil > m.time && mon.dashDir) {
        vx = mon.dashDir.x * s.speed * mb.dashMult;
        vz = mon.dashDir.z * s.speed * mb.dashMult;
      } else if (tgt) {
        const dx = tgt.x - mon.x, dz = tgt.z - mon.z;
        const dist = Math.hypot(dx, dz);
        const los = m.map.lineOfSight(mon.x, mon.z, tgt.x, tgt.z);

        // 돌진 시작
        if (s.dash && m.time >= mon.dashReadyAt && dist < mb.dashTrigger && dist > s.reach && los) {
          mon.dashUntil = m.time + mb.dashSec;
          mon.dashReadyAt = m.time + mb.dashCd;
          mon.dashDir = { x: dx / dist, z: dz / dist };
          mon.dashHit = false;
        }
        // 원거리 발사
        if (s.ranged && m.time >= mon.rangedReadyAt && dist <= s.ranged && dist > s.reach && los) {
          mon.rangedReadyAt = m.time + mb.rangedCd;
          m.fireProjectile(mon, tgt);
        }
        // 이동: 보이면 곧장, 안 보이면 길 따라
        let dir = null;
        if (los || dist < 1.5) dir = dist > 0.01 ? { x: dx / dist, z: dz / dist } : null;
        else {
          const f = this.nav.field(tgt.id);
          const step = f && f.next(Math.floor(mon.x / CELL), Math.floor(mon.z / CELL));
          if (step) {
            const sx = (step[0] + 0.5) * CELL - mon.x, sz = (step[1] + 0.5) * CELL - mon.z;
            const sl = Math.hypot(sx, sz) || 1;
            dir = { x: sx / sl, z: sz / sl };
          }
        }
        const stop = s.ranged && los ? Math.min(s.ranged * 0.6, dist) : 0; // 원거리형은 거리를 둔다
        if (dir && dist > Math.max(s.reach * 0.7, stop)) {
          vx = dir.x * s.speed;
          vz = dir.z * s.speed;
        }
      }

      // 몬스터끼리 겹치지 않게
      for (const o of list) {
        if (o === mon) continue;
        const dx = mon.x - o.x, dz = mon.z - o.z;
        const d = Math.hypot(dx, dz);
        const min = s.radius + o.stats.radius;
        if (d > 0.001 && d < min) {
          vx += (dx / d) * (min - d) * 4;
          vz += (dz / d) * (min - d) * 4;
        }
      }

      const pos = m.map.collideCircle(mon.x + vx * dt, mon.z + vz * dt, s.radius);
      mon.x = pos.x;
      mon.z = pos.z;

      // 근접 공격: 닿아 있는 모든 플레이어
      for (const p of targets) {
        const d = Math.hypot(p.x - mon.x, p.z - mon.z);
        if (d > s.reach + m.b.player.radius) continue;
        mon.attacking = true;
        m.damagePlayer(p, s.dps * dt, { onHit: s.onHit, silent: true });
        if (mon.dashUntil > m.time && !mon.dashHit) {
          mon.dashHit = true;
          m.damagePlayer(p, mb.dashBurst * (s.dps / mb.meleeDps), { onHit: s.onHit });
        }
      }
    }
  }

  pickTarget(mon, targets) {
    let best = null, bestD = Infinity;
    const cx = Math.floor(mon.x / CELL), cy = Math.floor(mon.z / CELL);
    for (const p of targets) {
      const f = this.nav.field(p.id);
      let d = f ? f.at(cx, cy) * CELL : -1;
      if (d < 0) d = Math.hypot(p.x - mon.x, p.z - mon.z) + 1000; // 길이 없으면 뒤로
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }
}

export class ProjectileSystem {
  update(m, dt) {
    if (!m.projectiles.length) return;
    const keep = [];
    for (const pr of m.projectiles) {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.z += pr.vz * dt;
      pr.ttl -= dt;
      let end = pr.ttl <= 0 || pr.y < 0 || m.map.solidAt(pr.x, pr.z);
      if (!end) {
        for (const p of m.targets()) {
          const dy = pr.y - (p.y + 0.8);
          if (Math.hypot(p.x - pr.x, p.z - pr.z) < 0.7 && Math.abs(dy) < 1.1) {
            m.damagePlayer(p, pr.dmg, { onHit: pr.onHit });
            end = true;
            break;
          }
        }
      }
      if (end) m.emit(EV.PROJ_END, { id: pr.id });
      else keep.push(pr);
    }
    m.projectiles = keep;
  }
}

export class GrenadeSystem {
  update(m) {
    if (!m.grenades.length) return;
    const g = m.b.grenade;
    const due = m.grenades.filter((x) => x.at <= m.time);
    if (!due.length) return;
    m.grenades = m.grenades.filter((x) => x.at > m.time);
    for (const gr of due) {
      m.emit(EV.GREN_BOOM, { x: gr.x, z: gr.z, r: g.radius });
      for (const mon of [...m.monsters.values()]) {
        if (Math.hypot(mon.x - gr.x, mon.z - gr.z) > g.radius + mon.stats.radius) continue;
        const k = mon.stats.kind;
        if (k === 'normal') m.damageMonster(mon, mon.hp, gr.by);
        else m.damageMonster(mon, mon.maxHp * (k === 'boss' ? g.bossPct : g.giantPct), gr.by);
      }
    }
  }
}

export class PlayerLifeSystem {
  update(m) {
    const b = m.b;
    for (const p of m.players.values()) p.reviveProg = 0;

    for (const p of m.players.values()) {
      // 2인전 목숨: 3초 뒤 안전한 곳에서 다시 시작
      if (p.state === PSTATE.DEAD && p.respawnAt > 0 && m.time >= p.respawnAt) {
        const spot = this.safeSpot(m);
        Object.assign(p, { state: PSTATE.ALIVE, respawnAt: 0, hp: p.maxHp, x: spot.x, z: spot.z, y: 0 });
        p.invulnUntil = m.time + b.match.reviveInvulnSec;
        m.emit(EV.PRESPAWN, { id: p.id, x: spot.x, z: spot.z });
      }
      // 지우개 수류탄 충전
      if (p.grenades < b.grenade.max && m.time >= p.grenadeAt) {
        p.grenades++;
        p.grenadeAt = m.time + b.grenade.rechargeSec;
      }
      // 부활 시키는 중
      const r = p.reviving;
      if (!r) continue;
      const t = m.players.get(r.target);
      const ok =
        p.state === PSTATE.ALIVE &&
        t && t.state === PSTATE.DEAD && t.respawnAt === 0 && t.lives > 0 &&
        m.time - t.deadAt >= b.match.reviveWaitSec &&
        p.revivesLeft > 0 &&
        Math.hypot(p.x - t.x, p.z - t.z) <= b.match.reviveRange &&
        Math.hypot(p.x - r.x, p.z - r.z) <= b.match.reviveMoveCancel;
      if (!ok) {
        p.reviving = null;
        continue;
      }
      const prog = (m.time - r.start) / b.match.reviveHoldSec;
      t.reviveProg = Math.min(1, prog);
      if (prog >= 1) {
        Object.assign(t, { state: PSTATE.ALIVE, hp: Math.round(t.maxHp * b.match.reviveHpRatio), deadAt: 0 });
        t.invulnUntil = m.time + b.match.reviveInvulnSec;
        p.revivesLeft--;
        p.reviving = null;
        m.emit(EV.PREVIVE, { id: t.id, by: p.id, x: t.x, z: t.z });
      }
    }
  }

  safeSpot(m) {
    let best = m.map.roomCenters[0], bestScore = -1;
    for (const c of m.map.roomCenters) {
      let near = Infinity;
      for (const mon of m.monsters.values()) near = Math.min(near, Math.hypot(mon.x - c.x, mon.z - c.z));
      if (near > bestScore) {
        bestScore = near;
        best = c;
      }
    }
    return best;
  }
}
