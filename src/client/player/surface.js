import * as THREE from 'three';
import { CELL, WALL_H, TILE } from '../../shared/map/GameMap.js';

// 총알이 멈춘 점이 어떤 면 위인지: 벽·기둥(옆면) / 바닥 / 천장. 아니면 null (몬스터·허공).
// 내 총알·남의 총알(EV.SHOT 의 끝점, 0.01 단위로 반올림됨) 모두 같은 함수로 판단한다.
const EPS = 0.025;

export function surfaceAt(map, point, dir) {
  if (point.y <= EPS) return { kind: 'floor', normal: new THREE.Vector3(0, 1, 0) };
  if (point.y >= WALL_H - EPS) return { kind: 'ceil', normal: new THREE.Vector3(0, -1, 0) };
  const fx = point.x / CELL, fz = point.z / CELL;
  const onX = Math.abs(fx - Math.round(fx)) * CELL < EPS;
  const onZ = Math.abs(fz - Math.round(fz)) * CELL < EPS;
  const tryAxis = (axis) => {
    const s = axis === 'x' ? Math.sign(dir.x) : Math.sign(dir.z);
    if (!s) return null;
    const normal = axis === 'x' ? new THREE.Vector3(-s, 0, 0) : new THREE.Vector3(0, 0, -s);
    // 면 너머(총알이 들어간 쪽) 칸
    const cx = Math.floor((point.x - normal.x * 0.05) / CELL), cz = Math.floor((point.z - normal.z * 0.05) / CELL);
    if (!map.solid(cx, cz)) return null;
    const tile = map.tile(cx, cz);
    if (tile === TILE.DOOR) return null; // 문은 움직이니 자국을 남기지 않음
    return { kind: tile === TILE.PILLAR ? 'pillar' : 'wall', normal };
  };
  return (onX && tryAxis('x')) || (onZ && tryAxis('z')) || null;
}
