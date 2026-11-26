import { MSG, EV, PSTATE } from '../shared/protocol.js';

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
    m.damageMonster(mon, m.b.gun.dmg, p.id);
    p.dmg += m.b.gun.dmg;
  },

  [MSG.SHOT](m, p, msg) {
    if (!p || p.state !== PSTATE.ALIVE) return;
    if (!Array.isArray(msg.a) || !Array.isArray(msg.b)) return;
    m.emit(EV.SHOT, { from: p.id, a: msg.a.slice(0, 3).map(num), b: msg.b.slice(0, 3).map(num) });
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
    if (p.grenades >= g.max) p.grenadeAt = m.time + g.rechargeSec;
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

  [MSG.SPAWN](m, _p, msg, clientId) {
    m.spawner.request(m, clientId, msg);
  },

  [MSG.VIEW](m, p, msg) {
    if (!m.solo || !p) return; // 혼자 테스트에서만: 술래 화면을 보는 동안 내 캐릭터는 공격받지 않는다
    p.afk = !!msg.tagger;
  },
};
