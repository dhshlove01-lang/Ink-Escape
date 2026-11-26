// 네트워크 메시지 이름. 모든 메시지는 { t: MSG.X, ...payload } 모양의 평범한 객체다.
// 통신 수단(PeerJS, 메모리, 나중에 Steam)이 바뀌어도 이 규칙은 그대로다.

export const MSG = {
  // client → host
  HELLO: 'hello',          // { name }
  PICK_ROLE: 'role',       // { role: 'tagger' | 'player' | 'random' }
  PICK_ANIMAL: 'animal',   // { animal }
  READY: 'ready',          // { ready: bool }
  SETTINGS: 'settings',    // { matchSeconds }   (방 만든 사람만)
  START: 'start',          // {}                 (방 만든 사람만)
  PSTATE: 'ps',            // { x, y, z, yaw, moving }
  HIT: 'hit',              // { id, d }
  SHOT: 'shot',            // { a:[x,y,z], b:[x,y,z] }  연출용
  GRENADE: 'gren',         // { x, z }
  REVIVE: 'rev',           // { target | null }
  SPAWN: 'spawn',          // { strokes, x, z, boss, allIn }
  VIEW: 'view',            // { tagger: bool }  (혼자 테스트에서 화면 전환)
  PONG: 'pong',            // { at }

  // host → client
  WELCOME: 'welcome',      // { id, host: bool }
  LOBBY: 'lobby',          // { members, settings, ownerId }
  MATCH_START: 'mstart',   // { you, roster, settings, mapId, doorCount, solo }
  SNAP: 'snap',            // 상태 스냅샷
  EVENT: 'ev',             // { e: 이벤트 이름, ... }
  SPAWN_RESULT: 'spres',   // { ok, reason }
  GAME_OVER: 'over',       // { winner: 'players'|'tagger', reason, stats }
  PING: 'ping',            // { at }
  ERROR: 'err',            // { message }
};

export const EV = {
  PENDING: 'pending',      // { id, x, z, r, kind, at, icons }
  MSPAWN: 'mspawn',        // { id, x, z, strokes, st }
  MDIE: 'mdie',            // { id, by }
  MHIT: 'mhit',            // { id }
  SHOT: 'shot',            // { from, a, b }
  GREN_THROW: 'gthrow',    // { from, x, z, fuse }
  GREN_BOOM: 'gboom',      // { x, z, r }
  PDAMAGE: 'pdmg',         // { id, amount }
  PDEATH: 'pdeath',        // { id }
  PREVIVE: 'previve',      // { id, by, x, z }
  PRESPAWN: 'prespawn',    // { id, x, z }
  PESCAPE: 'pescape',      // { id }
  BOSS: 'boss',            // { id, kind, icons }
  ONE_MIN: 'onemin',
  DOOR_REVEAL: 'doorrev',  // { door }
  DOOR_OPEN: 'dooropen',   // { door }
  PROJ: 'proj',            // { id, x, y, z, vx, vz, color }
  PROJ_END: 'projend',     // { id }
  NOTICE: 'notice',        // { text }
};

export const ROLE = { TAGGER: 'tagger', PLAYER: 'player', RANDOM: 'random', NONE: 'none' };
export const ANIMALS = ['shiba', 'bear', 'rabbit', 'cat', 'devil'];
export const ANIMAL_NAMES = { shiba: '시바견', bear: '곰', rabbit: '토끼', cat: '삼색고양이', devil: '술래 악마' };

export const PSTATE = { ALIVE: 0, DEAD: 1, ESCAPED: 2, OUT: 3 };
export const STATUS_BIT = { BURN: 1, SLOW: 2, POISON: 4, INVULN: 8, AFK: 16 };
