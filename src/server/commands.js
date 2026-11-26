import { MSG, EV, PSTATE } from '../shared/protocol.js';
import { grenadeMax, grenadeRecharge } from '../shared/augmentMath.js';

// 클라이언트 명령 처리기. 메시지 종류 하나 = 함수 하나 (새 명령은 여기 한 줄 추가 — OCP).
// 모든 처리기: (match, player | null, msg, clientId) => void

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const COMMANDS = {
  [MSG.PSTATE](m, p, msg) {
    if (!p || p.state !== PSTATE.ALIVE) return;
    p.x = Math.max(0, Math.min(m.map.worldW, num(msg.x)));
    p.y = Math.max(0, Math.min(10, num(msg.y)));
    p.z = Math.max(0, Math.min(m.map.worldH, num(msg.z)));
    p.yaw = num(msg.yaw);
  },

  [MSG.HIT](m, p, msg) {
    if (!p || p.state !== PSTATE.ALIVE || p.afk) return;
    if (p.hitTokens < 1) return; // 연사 속도보다 빠른 명중 신고는 버린다
    p.hitTokens -= 1;
    const mon = m.monsters.get(msg.id);
    if (!mon) return;
    const dmg = m.b.gun.dmg * cheerMult(m, p);
    m.damageMonster(mon, dmg, p.id);
    p.dmg += dmg;
  },

  [MSG.SHOT](m, p, msg) {
    if (!p || p.state !== PSTATE.ALIVE) return;
    if (!Array.isArray(msg.a) || !Array.isArray(msg.b)) return;
    const b = msg.b.slice(0, 3).map(num);
    m.emit(EV.SHOT, { from: p.id, a: msg.a.slice(0, 3).map(num), b });
    // 지우개 탄: N 발째마다 맞은 자리에 작은 폭발
    p.shotN++;
    const es = m.b.aug.eraserShot;
    if (p.aug.eraserShot && p.shotN % es.every === 0 && Math.hypot(b[0] - p.x, b[2] - p.z) <= m.b.gun.range + 1) {
      m.emit(EV.SPLASH, { x: b[0], z: b[2], r: es.radius });
      for (const mon of [...m.monsters.values()]) {
        if (Math.hypot(mon.x - b[0], mon.z - b[2]) <= es.radius + mon.stats.radius) m.damageMonster(mon, es.dmg, p.id);
      }
    }
  },

  [MSG.GRENADE](m, p, msg) {
    if (!p || p.state !== PSTATE.ALIVE || p.afk || p.grenades <= 0) return;
    const g = m.b.grenade;
    let x = num(msg.x), z = num(msg.z);
    const d = Math.hypot(x - p.x, z - p.z);
    if (d > g.throwRange) {
      x = p.x + ((x - p.x) / d) * g.throwRange;
      z = p.z + ((z - p.z) / d) * g.throwRange;
    }
    if (p.grenades >= grenadeMax(m.b, p.aug)) p.grenadeAt = m.time + grenadeRecharge(m.b, p.aug);
    p.grenades--;
    m.grenades.push({ x, z, at: m.time + g.fuseSec, by: p.id });
    m.emit(EV.GREN_THROW, { from: p.id, sx: p.x, sz: p.z, x, z, fuse: g.fuseSec });
  },

  [MSG.REVIVE](m, p, msg) {
    if (!p) return;
    if (!msg.target) {
      p.reviving = null;
      return;
    }
    if (p.reviving && p.reviving.target === msg.target) return;
    p.reviving = { target: String(msg.target), start: m.time, x: p.x, z: p.z };
  },

  [MSG.AUG_PICK](m, _p, msg, clientId) {
    m.supply.pick(m, clientId, msg);
  },

  [MSG.SPAWN](m, _p, msg, clientId) {
    m.spawner.request(m, clientId, msg);
  },

  [MSG.VIEW](m, p, msg) {
    if (!m.solo || !p) return; // 혼자 테스트에서만: 술래 화면을 보는 동안 내 캐릭터는 공격받지 않는다
    p.afk = !!msg.tagger;
  },
};

// 응원단: 주변에 응원단 증강을 가진 다른 팀원이 있으면 피해 증가 (한 명당)
function cheerMult(m, p) {
  const a = m.b.aug.cheer;
  let k = 1;
  for (const o of m.players.values()) {
    if (o === p || !o.aug.cheer || o.state !== PSTATE.ALIVE) continue;
    if (Math.hypot(o.x - p.x, o.z - p.z) <= a.radius) k += a.dmgBonus;
  }
  return k;
}
