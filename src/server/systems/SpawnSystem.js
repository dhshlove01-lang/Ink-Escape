import { EV, MSG, PSTATE } from '../../shared/protocol.js';
import { sanitizeStrokes } from '../../shared/judge/Judge.js';
import { createMonster } from '../entities.js';
import { msg as say } from '../../shared/i18n/strings.js';

// 술래의 소환 요청 검사 → 3초 대기(빨간 장판) → 몬스터 등장.

export class SpawnSystem {
  constructor({ judge, paletteLength }) {
    this.judge = judge;
    this.paletteLength = paletteLength;
  }

  request(m, clientId, msg) {
    const reply = (ok, reason) => m.sendTo(clientId, { t: MSG.SPAWN_RESULT, ok, reason });
    const t = m.tagger;
    if (clientId !== t.id) return reply(false, say('spawn.taggerOnly'));
    const strokes = sanitizeStrokes(msg.strokes, this.paletteLength);
    if (!strokes) return reply(false, say('spawn.badData'));
    const x = Number(msg.x), z = Number(msg.z);
    if (!Number.isFinite(x) || !Number.isFinite(z) || !m.map.isFloor(x, z)) return reply(false, say('spawn.notFloor'));
    const minD = m.b.spawn.minPlayerDist;
    for (const p of m.players.values()) {
      if (p.state === PSTATE.ALIVE && !p.afk && Math.hypot(p.x - x, p.z - z) < minD) {
        return reply(false, say('spawn.tooClose', { m: minD }));
      }
    }

    const res = this.judge.judge(strokes, {
      boss: !!msg.boss,
      attr: typeof msg.attr === 'string' ? msg.attr : null,
      allIn: !!msg.allIn,
      ink: t.ink,
      frenzy: m.doorOpen,
      inkProfile: { bossHp: t.bossHp },
      bossReadyIn: Math.max(0, t.bossReadyAt - m.time),
    });
    if (!res.ok) return reply(false, res.reason);

    if (m.doorOpen) {
      const key = hashStrokes(strokes);
      const last = t.recallUsed.get(key) ?? -1e9;
      const cd = m.b.spawn.frenzyRecallCd;
      if (m.time - last < cd) return reply(false, say('spawn.sameCooldown', { n: cd }));
      t.recallUsed.set(key, m.time);
    }

    t.ink -= res.cost;
    t.spawned++;
    if (res.kind !== 'normal') {
      t.bossReadyAt = m.time + m.b.spawn.bossCooldownSec;
      t.bosses++;
    }
    const id = m.nextId();
    const r = Math.max(0.8, res.stats.width / 2);
    m.pending.push({ id, x, z, r, at: m.time + m.b.spawn.delaySec, strokes, stats: res.stats, kind: res.kind });
    m.emit(EV.PENDING, { id, x, z, r, kind: res.kind, delay: m.b.spawn.delaySec, icons: res.icons });
    if (res.kind !== 'normal') m.emit(EV.BOSS, { id, kind: res.kind, icons: res.icons });
    reply(true, res.icons);
  }

  update(m) {
    if (!m.pending.length) return;
    const due = m.pending.filter((p) => p.at <= m.time);
    if (!due.length) return;
    m.pending = m.pending.filter((p) => p.at > m.time);
    for (const p of due) {
      const mon = createMonster(p.id, p, m.b);
      const pos = m.map.collideCircle(mon.x, mon.z, mon.stats.radius);
      mon.x = pos.x;
      mon.z = pos.z;
      m.monsters.set(mon.id, mon);
      const s = p.stats;
      m.emit(EV.MSPAWN, {
        id: mon.id,
        x: mon.x,
        z: mon.z,
        strokes: p.strokes,
        st: { kind: s.kind, height: s.height, width: s.width, fly: s.fly, flyY: s.flyY, dash: s.dash, ranged: s.ranged, attrs: s.attrs, hp: s.hp },
      });
    }
  }
}

function hashStrokes(strokes) {
  let h = 5381;
  for (const s of strokes) {
    h = ((h << 5) + h + s.c * 31 + s.w) | 0;
    for (let i = 0; i < s.p.length; i += 7) h = ((h << 5) + h + s.p[i]) | 0;
  }
  return h;
}
