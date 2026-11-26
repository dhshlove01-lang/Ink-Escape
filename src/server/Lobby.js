import { ROLE, ANIMALS } from '../shared/protocol.js';

// 로비: 참가자, 역할(먼저 누른 사람 우선), 동물, 설정. 경기 로직은 모른다 (SRP).

const MAX_MEMBERS = 5;
const MAX_PLAYERS = 4;

export class Lobby {
  constructor() {
    this.members = new Map(); // id → { id, name, role, animal, ping }
    this.ownerId = null;
    this.settings = { matchSeconds: 600 };
  }

  get full() {
    return this.members.size >= MAX_MEMBERS;
  }

  join(id, name) {
    if (this.full) return false;
    const used = new Set([...this.members.values()].map((m) => m.animal));
    const animal = ANIMALS.find((a) => !used.has(a)) || ANIMALS[0];
    this.members.set(id, { id, name: cleanName(name), role: ROLE.RANDOM, animal, ready: false, ping: 0 });
    if (!this.ownerId) this.ownerId = id;
    return true;
  }

  leave(id) {
    this.members.delete(id);
    if (this.ownerId === id) this.ownerId = this.members.keys().next().value || null;
  }

  pickRole(id, role) {
    const m = this.members.get(id);
    if (!m || !Object.values(ROLE).includes(role)) return '잘못된 역할';
    if (role === ROLE.TAGGER) {
      const taken = [...this.members.values()].some((o) => o.id !== id && o.role === ROLE.TAGGER);
      if (taken) return '술래는 이미 정해졌어요';
    }
    if (role === ROLE.PLAYER) {
      const n = [...this.members.values()].filter((o) => o.id !== id && o.role === ROLE.PLAYER).length;
      if (n >= MAX_PLAYERS) return '플레이어 자리가 다 찼어요';
    }
    m.role = role;
    return null;
  }

  pickAnimal(id, animal) {
    const m = this.members.get(id);
    if (!m || !ANIMALS.includes(animal)) return '잘못된 캐릭터';
    const taken = [...this.members.values()].some((o) => o.id !== id && o.animal === animal);
    if (taken) return '다른 사람이 고른 캐릭터예요';
    m.animal = animal;
    return null;
  }

  setReady(id, ready) {
    const m = this.members.get(id);
    if (!m) return '참가자를 찾을 수 없어요';
    m.ready = !!ready;
    return null;
  }

  // 방장을 뺀 모든 참가자가 READY 인가 (시작 버튼 안내용 — 시작은 막지 않는다)
  allReady() {
    return [...this.members.values()].every((m) => m.id === this.ownerId || m.ready);
  }

  setSettings(id, s) {
    if (id !== this.ownerId) return '방 만든 사람만 바꿀 수 있어요';
    const sec = Number(s.matchSeconds);
    if ([180, 300, 600].includes(sec)) this.settings.matchSeconds = sec;
    return null;
  }

  // 랜덤을 누른 사람들을 남은 자리에 배정한다. 결과: { taggerId, players:[...] } 또는 { error }
  resolveRoster(rng = Math.random) {
    const list = [...this.members.values()];
    if (list.length < 2) return { error: '2명 이상 필요해요 (혼자는 "혼자 테스트")' };
    let tagger = list.find((m) => m.role === ROLE.TAGGER);
    const randoms = list.filter((m) => m.role === ROLE.RANDOM || m.role === ROLE.NONE);
    if (!tagger) {
      if (!randoms.length) return { error: '술래가 없어요' };
      tagger = randoms.splice(Math.floor(rng() * randoms.length), 1)[0];
    }
    const players = list.filter((m) => m !== tagger && (m.role === ROLE.PLAYER || randoms.includes(m)));
    if (players.length < 1) return { error: '플레이어가 1명 이상 필요해요' };
    if (players.length > MAX_PLAYERS) return { error: '플레이어는 최대 4명이에요' };
    return {
      taggerId: tagger.id,
      taggerName: tagger.name,
      taggerAnimal: tagger.animal,
      players: players.map((m) => ({ id: m.id, name: m.name, animal: m.animal })),
    };
  }

  view() {
    return {
      ownerId: this.ownerId,
      settings: this.settings,
      allReady: this.allReady(),
      members: [...this.members.values()],
    };
  }
}

function cleanName(n) {
  const s = String(n || '').replace(/[<>]/g, '').trim().slice(0, 12);
  return s || '이름없음';
}
