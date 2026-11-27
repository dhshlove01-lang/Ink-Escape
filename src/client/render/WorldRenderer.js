import * as THREE from 'three';
import { EV } from '../../shared/protocol.js';
import { buildScene } from '../player/SceneBuilder.js';
import { MonsterRenderer } from '../player/MonsterRenderer.js';
import { RemotePlayers } from '../player/RemotePlayers.js';
import { Effects } from '../player/Effects.js';
import { surfaceAt } from '../player/surface.js';
import { SupplyCrates } from './SupplyCrates.js';

// 3D 전장 그리기 묶음: 맵 + 몬스터 + 동물 플레이어 + 연출 + 문 상태.
// 카메라는 모른다 — 플레이어 1인칭(PlayerView)과 술래 무대(TaggerCam)가 같이 쓴다.

const SILENT = { play() {}, unlock() {} };

export class WorldRenderer {
  /**
   * @param skipPlayerId 그리지 않을 플레이어 (1인칭에서 내 몸). null 이면 모두 그림
   * @param sfx 소리 (술래 카메라는 SILENT 를 넘겨 소리가 겹치지 않게)
   */
  constructor({ session, palette, attributes, balance, sfx = SILENT, skipPlayerId = null }) {
    this.session = session;
    this.sfx = sfx;
    this.skipPlayerId = skipPlayerId;
    this.world = buildScene(session.map);
    this.scene = this.world.scene;
    this.effects = new Effects(this.scene, { holeSec: balance?.gun.holeSec, holeMax: balance?.gun.holeMax });
    this.monsters = new MonsterRenderer({ scene: this.scene, session, palette, attributes, sfx, effects: this.effects });
    this.remotes = new RemotePlayers({ scene: this.scene, session, skipId: skipPlayerId });
    this.crates = new SupplyCrates({ scene: this.scene, session, sfx });

    if (session.doorRevealed >= 0) this.world.revealDoor(session.doorRevealed);
    // 이미 열린 뒤에 화면이 만들어진 경우(늦게 접속·화면 전환)는 연출 없이 열린 모습으로
    if (session.doorOpen) this.world.openDoor(session.doorRevealed, true);

    this._off = [
      session.on(EV.SHOT, (e) => {
        if (e.from === skipPlayerId) return; // 내 총알은 1인칭 쪽에서 바로 그린다
        const a = new THREE.Vector3(...e.a), b = new THREE.Vector3(...e.b);
        this.effects.muzzle(a, 0.25); // 궤적 선 없음
        const s = surfaceAt(session.map, b, new THREE.Vector3().subVectors(b, a));
        if (s) this.effects.bulletHole(b, s.normal, s.kind);
      }),
      session.on(EV.GREN_THROW, (e) => this.effects.grenade(e.sx, e.sz, e.x, e.z, e.fuse)),
      session.on(EV.GREN_BOOM, (e) => {
        this.effects.boom(e.x, e.z, e.r);
        this.sfx.play('boom');
      }),
      session.on(EV.SPLASH, (e) => this.effects.boom(e.x, e.z, e.r)), // 지우개 탄
      session.on(EV.PUDDLE, (e) => this.effects.puddle(e.x, e.z, e.r, e.sec)), // 끈적 잉크
      session.on(EV.HEART, (e) => {
        const p = session.playerPos(e.id);
        if (p) for (let i = 0; i < 4; i++) this.effects.spark(new THREE.Vector3(p.x + (Math.random() - 0.5), 1 + Math.random(), p.z + (Math.random() - 0.5)), 0xff7aa8);
      }),
      session.on(EV.DOOR_REVEAL, (e) => this.world.revealDoor(e.door)),
      session.on(EV.DOOR_OPEN, (e) => this.world.openDoor(e.door)),
    ];
  }

  update(dt, time, camera) {
    this.world.update(time);
    this.monsters.update(dt, camera, time);
    this.remotes.update(dt, time);
    this.effects.update(dt);
    this.crates.update(time);
  }

  dispose() {
    this._off.forEach((f) => f());
    this.monsters.dispose();
    this.crates.dispose();
  }
}

export { SILENT };
