import { EV, PSTATE } from '../../shared/protocol.js';
import { msg } from '../../shared/i18n/strings.js';

// 시계(타임라인), 잉크 회복, 상태이상, 탈출, 승패 — 작은 시스템들.
// 시스템 인터페이스: update(match, dt)

export class ClockSystem {
  update(m) {
    const left = m.duration - m.time;
    if (left <= m.b.match.oneMinuteLeft && !m.flags.oneMin) {
      m.flags.oneMin = true;
      m.emit(EV.ONE_MIN, {});
    }
    if (left <= m.b.match.doorRevealLeft && !m.flags.revealed) {
      m.flags.revealed = true;
      m.emit(EV.DOOR_REVEAL, { door: m.doorIndex });
    }
    if (left <= 0 && !m.doorOpen) {
      m.doorOpen = true;
      m.map.setOpenDoor(m.doorIndex);
      m.emit(EV.DOOR_OPEN, { door: m.doorIndex });
    }
  }
}

export class InkSystem {
  update(m, dt) {
    const t = m.tagger;
    if (m.doorOpen) {
      t.ink = t.max; // 최후 발악: 잉크 무제한
      return;
    }
    t.ink = Math.min(t.max, t.ink + t.regen * dt);
  }
}

export class StatusSystem {
  update(m, dt) {
    for (const p of m.players.values()) {
      if (p.state !== PSTATE.ALIVE) continue;
      for (const key of ['burn', 'poison']) {
        const s = p[key];
        if (!s) continue;
        if (m.time >= s.until) p[key] = null;
        else m.damagePlayer(p, s.dps * dt, { silent: true });
      }
      if (p.slow && m.time >= p.slow.until) p.slow = null;
    }
  }
}

export class EscapeSystem {
  update(m) {
    if (!m.doorOpen) return;
    for (const p of m.players.values()) {
      if (p.state === PSTATE.ALIVE && !p.afk && m.map.inOpenDoor(p.x, p.z)) {
        p.state = PSTATE.ESCAPED;
        p.escapedAt = m.time;
        m.emit(EV.PESCAPE, { id: p.id });
        m.finish('players', msg('reason.escaped', { name: p.name }));
        return;
      }
    }
  }
}

export class VictorySystem {
  update(m) {
    if (m.result) return;
    const list = [...m.players.values()];
    const alive = list.some((p) => p.state === PSTATE.ALIVE);
    const respawning = list.some((p) => p.state === PSTATE.DEAD && p.respawnAt > 0);
    if (!alive && !respawning) m.finish('tagger', msg('reason.wiped'));
  }
}
