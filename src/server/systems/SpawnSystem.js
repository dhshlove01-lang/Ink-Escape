import { EV, MSG, PSTATE } from '../../shared/protocol.js';
import { sanitizeStrokes } from '../../shared/judge/Judge.js';
import { createMonster } from '../entities.js';
import { msg as say } from '../../shared/i18n/strings.js';
import { minPlayerDist, spawnDelay, bossCooldown, bossSizeMult, monsterHpMult } from '../../shared/augmentMath.js';

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
    const minD = minPlayerDist(m.b, t.aug); // 그림자 소환이면 더 가까이
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
      t.bossReadyAt = m.time + bossCooldown(m.b, t.aug);
      t.bosses++;
      // 큰 붓: 보스가 더 크게 (천장 한계는 넘지 않게)
      const k = bossSizeMult(m.b, t.aug);
      if (k > 1) {
        const s = res.stats;
        const kk = Math.min(k, m.b.monster.maxHeight / Math.max(0.01, s.height));
        if (kk > 1) Object.assign(s, { height: s.height * kk, width: s.width * kk, reach: s.reach * kk });
      }
    }
    const delay = spawnDelay(m.b, t.aug);
    const id = this.queue(m, { x, z, strokes, stats: res.stats, kind: res.kind, icons: res.icons, cost: res.cost, delay });
    // 쌍둥이 붓: 일반 몬스터는 가끔 한 마리 더 (잉크는 한 번만)
    if (res.kind === 'normal' && t.aug.twin && (this.rng?.() ?? Math.random()) < m.b.aug.twin.chance) {
      const a = Math.random() * Math.PI * 2;
      const tx = x + Math.cos(a) * 1.8, tz = z + Math.sin(a) * 1.8;
      if (m.map.isFloor(tx, tz)) this.queue(m, { x: tx, z: tz, strokes, stats: { ...res.stats }, kind: 'normal', icons: res.icons, cost: 0, delay });
    }
    if (res.kind !== 'normal') m.emit(EV.BOSS, { id, kind: res.kind, icons: res.icons });
    reply(true, res.icons);
  }

  queue(m, { x, z, strokes, stats, kind, icons, cost, delay }) {
    const id = m.nextId();
    const r = Math.max(0.8, stats.width / 2);
    m.pending.push({ id, x, z, r, at: m.time + delay, strokes, stats, kind, cost });
    m.emit(EV.PENDING, { id, x, z, r, kind, delay, icons });
    return id;
  }

  update(m) {
    if (!m.pending.length) return;
    const due = m.pending.filter((p) => p.at <= m.time);
    if (!due.length) return;
    m.pending = m.pending.filter((p) => p.at > m.time);
    for (const p of due) {
      const mon = createMonster(p.id, p, m.b);
      // 두꺼운 종이: HP 배율, 재활용: 쓴 잉크 기억
      const hk = monsterHpMult(m.b, m.tagger.aug);
      mon.hp = mon.maxHp = Math.round(mon.maxHp * hk);
      mon.cost = p.cost || 0;
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
