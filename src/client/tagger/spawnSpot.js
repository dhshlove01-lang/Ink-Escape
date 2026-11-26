import { PSTATE } from '../../shared/protocol.js';
import { minPlayerDist } from '../../shared/augmentMath.js';

// 소환 자리 검사 — 2D 지도(미니맵)·3D 탑뷰·화면이 같은 규칙을 본다.
// 바닥이고, 살아 있는 플레이어에게서 minPlayerDist 이상 떨어져야 한다 (술래 증강 '그림자 소환'이면 더 가까이).
export function validSpawnSpot({ session, balance, map, p }) {
  if (!p || !map.isFloor(p.x, p.z)) return false;
  const minD = minPlayerDist(balance, session.taggerAugs);
  for (const pl of session.players()) {
    if (pl.st === PSTATE.ALIVE && !(pl.bits & 16) && Math.hypot(pl.x - p.x, pl.z - p.z) < minD) return false;
  }
  return true;
}
