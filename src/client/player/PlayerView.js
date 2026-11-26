import * as THREE from 'three';
import { EV, MSG, PSTATE } from '../../shared/protocol.js';
import { el, Banner } from '../ui/dom.js';
import { buildScene } from './SceneBuilder.js';
import { FpsController } from './FpsController.js';
import { Weapon } from './Weapon.js';
import { MonsterRenderer } from './MonsterRenderer.js';
import { RemotePlayers } from './RemotePlayers.js';
import { Effects } from './Effects.js';
import { Hud } from './Hud.js';

// 플레이어 1인칭 화면. 하위 부품을 조립하고 입력·네트워크를 잇는다.

export class PlayerView {
  constructor({ parent, session, balance, palette, attributes, sfx }) {
    this.session = session;
    this.b = balance;
    this.sfx = sfx;
    this.active = true;
    this.root = el('div', { class: 'view player-view' });
    parent.append(this.root);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.root.append(this.renderer.domElement);

    this.world = buildScene(session.map);
    this.scene = this.world.scene;
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200);
    this.scene.add(this.camera);

    const animal = session.animalOf(session.me);
    this.ctrl = new FpsController({ camera: this.camera, dom: this.renderer.domElement, map: session.map, balance });
    const me0 = session.roster.players.findIndex((p) => p.id === session.me);
    const ang = (Math.max(0, me0) / Math.max(1, session.playerCount)) * Math.PI * 2;
    this.ctrl.setPosition(session.map.spawn.x + Math.cos(ang) * 2, session.map.spawn.z + Math.sin(ang) * 2);

    this.effects = new Effects(this.scene);
    this.monsters = new MonsterRenderer({ scene: this.scene, session, palette, attributes, sfx, effects: this.effects });
    this.remotes = new RemotePlayers({ scene: this.scene, session });
    this.weapon = new Weapon({
      balance,
      camera: this.camera,
      animal,
      sfx,
      raycast: (o, d, r) => this.raycast(o, d, r),
      onShot: (s) => this.onShot(s),
    });
    this.hud = new Hud(this.root, session, attributes);
    this.banner = new Banner(this.root);
    this.lockHint = el('div', { class: 'lock-hint' }, el('b', {}, '클릭해서 조작 시작'), el('span', {}, 'WASD 이동 · Shift 달리기 · Space 점프 · 클릭 사격 · R 재장전 · G 지우개 수류탄 · E 길게: 부활', session.solo ? ' · Tab 술래 화면' : ''));
    this.root.append(this.lockHint);

    this.spectateIdx = 0;
    this.revTarget = null;
    this.sendAcc = 0;
    this.time = 0;
    this.bindInput();
    this.bindEvents();
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resize();
  }

  bindInput() {
    const dom = this.renderer.domElement;
    this._down = (e) => {
      if (!this.active) return;
      this.sfx.unlock();
      if (!this.ctrl.locked) {
        this.ctrl.lock();
        return;
      }
      if (e.button === 0) this.weapon.trigger = true;
      if (this.isDead()) this.spectateIdx++;
    };
    this._up = (e) => {
      if (e.button === 0) this.weapon.trigger = false;
    };
    this._key = (e) => {
      if (!this.active || e.repeat) return;
      if (e.code === 'KeyR') this.weapon.reload(this.time);
      if (e.code === 'KeyG') this.throwGrenade();
    };
    dom.addEventListener('mousedown', this._down);
    window.addEventListener('mouseup', this._up);
    window.addEventListener('keydown', this._key);
  }

  bindEvents() {
    const s = this.session;
    const name = (id) => s.nameOf(id);
    this._off = [
      s.on(EV.SHOT, (e) => {
        if (e.from === s.me) return;
        this.effects.tracer(new THREE.Vector3(...e.a), new THREE.Vector3(...e.b), 0xffc46b);
      }),
      s.on(EV.MDIE, (e) => e.by === s.me && this.hud.hit(true)),
      s.on(EV.GREN_THROW, (e) => this.effects.grenade(e.sx, e.sz, e.x, e.z, e.fuse)),
      s.on(EV.GREN_BOOM, (e) => {
        this.effects.boom(e.x, e.z, e.r);
        this.sfx.play('boom');
      }),
      s.on(EV.BOSS, (e) => {
        this.banner.show(`⚠ ${e.kind === 'giant' ? '초대형 괴물' : '보스'} 등장! ${e.icons}`, { kind: 'boss', ms: 3000 });
        this.sfx.play('siren');
        this.hud.redAlert(2200);
      }),
      s.on(EV.ONE_MIN, () => this.banner.show('1분 남음!', { kind: 'warn' })),
      s.on(EV.DOOR_REVEAL, (e) => {
        this.world.revealDoor(e.door);
        this.banner.show(`탈출 문 위치: ${s.map.doors[e.door].name} (빛기둥)`, { kind: 'info', ms: 3500 });
      }),
      s.on(EV.DOOR_OPEN, (e) => {
        this.world.openDoor(e.door);
        this.sfx.play('door');
        this.banner.show('문이 열렸다! 탈출하세요 · 술래 폭주!', { kind: 'boss', ms: 3500 });
      }),
      s.on(EV.PDEATH, (e) => {
        if (e.id === s.me) this.sfx.play('death');
        else this.banner.show(`${name(e.id)} 쓰러짐`, { kind: 'warn', ms: 1800 });
      }),
      s.on(EV.PREVIVE, (e) => {
        this.sfx.play('revive');
        this.banner.show(e.id === s.me ? `${name(e.by)}님이 살려줬어요!` : `${name(e.by)} → ${name(e.id)} 부활`, { kind: 'good', ms: 2000 });
      }),
      s.on(EV.PRESPAWN, (e) => {
        if (e.id !== s.me) return;
        this.ctrl.setPosition(e.x, e.z);
        this.sfx.play('revive');
        this.banner.show('다시 시작! (남은 목숨 1)', { kind: 'good' });
      }),
      s.on(EV.PESCAPE, (e) => this.banner.show(`${name(e.id)} 탈출!`, { kind: 'good' })),
      s.on(EV.PDAMAGE, (e) => e.id === s.me && this.sfx.play('hurt')),
    ];
  }

  setActive(on) {
    this.active = on;
    this.root.hidden = !on;
    this.ctrl.enabled = on;
    if (!on) {
      this.weapon.trigger = false;
      if (this.ctrl.locked) document.exitPointerLock?.();
    }
  }

  isDead() {
    const me = this.session.myPlayer();
    return me && me.st !== PSTATE.ALIVE;
  }

  resize() {
    const w = this.root.clientWidth || window.innerWidth;
    const h = this.root.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  raycast(origin, dir, range) {
    let best = range;
    let monsterId = null;
    const h = Math.hypot(dir.x, dir.z);
    if (h > 1e-6) best = Math.min(best, this.session.map.raycast(origin.x, origin.z, dir.x, dir.z, range * h) / h);
    if (dir.y < -1e-6) best = Math.min(best, -origin.y / dir.y);
    const a = dir.x * dir.x + dir.z * dir.z;
    if (a > 1e-8) {
      for (const t of this.monsters.targets()) {
        const ox = origin.x - t.x, oz = origin.z - t.z;
        const b = 2 * (ox * dir.x + oz * dir.z);
        const c = ox * ox + oz * oz - t.r * t.r;
        const disc = b * b - 4 * a * c;
        if (disc < 0) continue;
        const sq = Math.sqrt(disc);
        let tt = (-b - sq) / (2 * a);
        if (tt < 0) tt = (-b + sq) / (2 * a);
        if (tt < 0 || tt >= best) continue;
        const y = origin.y + dir.y * tt;
        if (y < t.y0 || y > t.y1) continue;
        best = tt;
        monsterId = t.id;
      }
    }
    return { point: origin.clone().addScaledVector(dir, best), monsterId, dist: best };
  }

  onShot({ muzzle, point, monsterId }) {
    this.effects.tracer(muzzle, point);
    this.effects.spark(point, monsterId ? 0xff5050 : 0xffe0a0);
    if (monsterId) {
      this.session.send({ t: MSG.HIT, id: monsterId });
      this.hud.hit(false);
      this.sfx.play('hit');
    }
    const r = (v) => Math.round(v * 100) / 100;
    this.session.send({ t: MSG.SHOT, a: [r(muzzle.x), r(muzzle.y), r(muzzle.z)], b: [r(point.x), r(point.y), r(point.z)] });
  }

  throwGrenade() {
    const me = this.session.myPlayer();
    if (!me || me.st !== PSTATE.ALIVE || me.gren <= 0) return;
    const o = new THREE.Vector3(), d = new THREE.Vector3();
    this.camera.getWorldPosition(o);
    this.camera.getWorldDirection(d);
    const hit = this.raycast(o, d, this.b.grenade.throwRange);
    const back = hit.dist > 0.6 ? hit.point.clone().addScaledVector(d, -0.5) : hit.point;
    this.session.send({ t: MSG.GRENADE, x: back.x, z: back.z });
  }

  // 가까운 시체 부활 (E 길게)
  updateRevive(me) {
    const holding = this.ctrl.keys.has('KeyE') && this.active;
    let prompt = null, ring = 0, target = null;
    if (me && me.st === PSTATE.ALIVE) {
      let best = null, bd = this.b.match.reviveRange;
      for (const c of this.remotes.corpses()) {
        const d = Math.hypot(c.x - this.ctrl.x, c.z - this.ctrl.z);
        if (d <= bd) {
          bd = d;
          best = c;
        }
      }
      if (best) {
        if (best.revIn > 0) prompt = `${Math.ceil(best.revIn)}초 뒤 부활시킬 수 있어요`;
        else if (me.revLeft <= 0) prompt = '부활 횟수를 다 썼어요';
        else {
          prompt = `E 길게 누르기: ${this.session.nameOf(best.id)} 부활 (남은 ${me.revLeft}회)`;
          if (holding) {
            target = best.id;
            ring = best.prog;
          }
        }
      }
    }
    if (target !== this.revTarget) {
      this.revTarget = target;
      this.session.send({ t: MSG.REVIVE, target });
    }
    return { prompt, ring: target ? Math.max(0.02, ring) : 0 };
  }

  update(dt) {
    this.time += dt;
    const me = this.session.myPlayer();
    const alive = !me || me.st === PSTATE.ALIVE;
    this.lockHint.hidden = !this.active || this.ctrl.locked;

    let center = null;
    if (alive) {
      this.ctrl.enabled = this.active;
      this.ctrl.update(dt, { slow: me?.slow || 0 });
    } else {
      this.weapon.trigger = false;
      center = this.spectate(me);
    }
    this.weapon.update(dt, this.time, { canFire: alive && this.active && this.ctrl.locked, moving: this.ctrl.moving });
    this.weapon.view.visible = alive;
    const rev = this.updateRevive(me);

    // 위치 보내기 (초당 20번)
    this.sendAcc += dt;
    if (this.sendAcc >= 0.05 && alive) {
      this.sendAcc = 0;
      const r = (v) => Math.round(v * 100) / 100;
      this.session.send({ t: MSG.PSTATE, x: r(this.ctrl.x), y: r(this.ctrl.y), z: r(this.ctrl.z), yaw: r(this.ctrl.yaw) });
    }

    this.world.update(this.time);
    this.monsters.update(dt, this.camera, this.time);
    this.remotes.update(dt, this.time);
    this.effects.update(dt);
    this.hud.update({ weapon: this.weapon, me, prompt: rev.prompt, center, revive: rev.ring, boss: this.monsters.bossInfo() });
    if (this.active) this.renderer.render(this.scene, this.camera);
  }

  // 죽었을 때: 살아 있는 팀원 시점으로 관전
  spectate(me) {
    if (me?.st === PSTATE.ESCAPED) return '탈출 성공!';
    if (me?.st === PSTATE.DEAD && me.resIn >= 0) return `다시 시작까지 ${Math.ceil(me.resIn)}초`;
    const alive = this.session.players().filter((p) => p.id !== this.session.me && p.st === PSTATE.ALIVE);
    let msg = '쓰러졌어요';
    if (me?.st === PSTATE.DEAD && me.revIn > 0) msg += ` · ${Math.ceil(me.revIn)}초 뒤부터 팀원이 살릴 수 있어요`;
    else if (me?.st === PSTATE.DEAD && me.revIn === 0) msg += ' · 팀원이 오면 살아나요';
    if (!alive.length) return msg;
    const t = alive[this.spectateIdx % alive.length];
    const p = this.session.playerPos(t.id);
    if (p) {
      const back = 4.5;
      this.camera.position.set(p.x + Math.sin(p.yaw) * back, 3.2, p.z + Math.cos(p.yaw) * back);
      this.camera.rotation.set(-0.35, p.yaw, 0);
    }
    return `${msg}\n관전: ${this.session.nameOf(t.id)} (클릭: 다른 팀원)`;
  }

  dispose() {
    this._off.forEach((f) => f());
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('mouseup', this._up);
    window.removeEventListener('keydown', this._key);
    this.ctrl.dispose();
    this.monsters.dispose();
    this.hud.dispose();
    this.renderer.dispose();
    this.root.remove();
  }
}
