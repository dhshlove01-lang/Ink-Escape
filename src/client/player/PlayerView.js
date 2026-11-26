import * as THREE from 'three';
import { EV, MSG, PSTATE } from '../../shared/protocol.js';
import { el, Banner } from '../ui/dom.js';
import { WorldRenderer } from '../render/WorldRenderer.js';
import { CEILING_LAYER } from './SceneBuilder.js';
import { WALL_H } from '../../shared/map/GameMap.js';
import { FpsController } from './FpsController.js';
import { Weapon } from './Weapon.js';
import { Hud } from './Hud.js';
import { surfaceAt } from './surface.js';
import { t } from '../i18n.js';
import { gfx } from '../render/GraphicsSettings.js';

// 플레이어 1인칭 화면. 하위 부품을 조립하고 입력·네트워크를 잇는다.

export class PlayerView {
  constructor({ parent, session, balance, palette, attributes, sfx }) {
    this.session = session;
    this.b = balance;
    this.sfx = sfx;
    this.active = true;
    this.root = el('div', { class: 'view player-view' });
    parent.append(this.root);

    this.renderer = new THREE.WebGLRenderer({ antialias: gfx.preset.antialias });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.root.append(this.renderer.domElement);

    this.view3d = new WorldRenderer({ session, palette, attributes, balance, sfx, skipPlayerId: session.me });
    this.scene = this.view3d.scene;
    this.effects = this.view3d.effects;
    this.monsters = this.view3d.monsters;
    this.remotes = this.view3d.remotes;
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200);
    this.scene.add(this.camera);
    this.camera.layers.enable(CEILING_LAYER); // 플레이어만 천장을 본다

    const animal = session.animalOf(session.me);
    this.ctrl = new FpsController({ camera: this.camera, dom: this.renderer.domElement, map: session.map, balance });
    const me0 = session.roster.players.findIndex((p) => p.id === session.me);
    const ang = (Math.max(0, me0) / Math.max(1, session.playerCount)) * Math.PI * 2;
    this.ctrl.setPosition(session.map.spawn.x + Math.cos(ang) * 2, session.map.spawn.z + Math.sin(ang) * 2);

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
    this.lockHint = el('div', { class: 'lock-hint' }, el('b', {}, t('player.clickToStart')), el('span', {}, t('player.controls'), session.solo ? t('player.controlsSolo') : ''));
    this.root.append(this.lockHint);

    this.spectateIdx = 0;
    this.revTarget = null;
    this.sendAcc = 0;
    this.time = 0;
    this.bindInput();
    this.bindEvents();
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this._offGfx = gfx.onChange(this.onResize);
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
      s.on(EV.MDIE, (e) => e.by === s.me && this.hud.hit(true)),
      s.on(EV.BOSS, (e) => {
        this.banner.show(t(e.kind === 'giant' ? 'player.giantAppear' : 'player.bossAppear', { icons: e.icons }), { kind: 'boss', ms: 3000 });
        this.sfx.play('siren');
        this.hud.redAlert(2200);
      }),
      s.on(EV.ONE_MIN, () => this.banner.show(t('player.oneMin'), { kind: 'warn' })),
      s.on(EV.DOOR_REVEAL, (e) => {
        this.banner.show(t('player.doorReveal', { door: t(s.map.doors[e.door].name) }), { kind: 'info', ms: 3500 });
      }),
      s.on(EV.DOOR_OPEN, () => {
        this.sfx.play('door');
        this.banner.show(t('player.doorOpen'), { kind: 'boss', ms: 3500 });
      }),
      s.on(EV.PDEATH, (e) => {
        if (e.id === s.me) this.sfx.play('death');
        else this.banner.show(t('player.downed', { name: name(e.id) }), { kind: 'warn', ms: 1800 });
      }),
      s.on(EV.PREVIVE, (e) => {
        this.sfx.play('revive');
        this.banner.show(e.id === s.me ? t('player.revivedMe', { name: name(e.by) }) : t('player.revivedOther', { by: name(e.by), name: name(e.id) }), { kind: 'good', ms: 2000 });
      }),
      s.on(EV.PRESPAWN, (e) => {
        if (e.id !== s.me) return;
        this.ctrl.setPosition(e.x, e.z);
        this.sfx.play('revive');
        this.banner.show(t('player.respawn'), { kind: 'good' });
      }),
      s.on(EV.PESCAPE, (e) => this.banner.show(t('player.escaped', { name: name(e.id) }), { kind: 'good' })),
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
    this.renderer.setPixelRatio(gfx.pixelRatio(w)); // 큰 화면은 덜 촘촘히 그려 늘려 보여 줌 (GPU 부담 = 픽셀 수)
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.weapon?.resize(w / h);
  }

  raycast(origin, dir, range) {
    let best = range;
    let monsterId = null;
    const h = Math.hypot(dir.x, dir.z);
    if (h > 1e-6) best = Math.min(best, this.session.map.raycast(origin.x, origin.z, dir.x, dir.z, range * h) / h);
    if (dir.y < -1e-6) best = Math.min(best, -origin.y / dir.y);
    if (dir.y > 1e-6) best = Math.min(best, (WALL_H - origin.y) / dir.y); // 천장
    const a = dir.x * dir.x + dir.z * dir.z;
    if (a > 1e-8) {
      for (const tg of this.monsters.targets()) {
        const ox = origin.x - tg.x, oz = origin.z - tg.z;
        const b = 2 * (ox * dir.x + oz * dir.z);
        const c = ox * ox + oz * oz - tg.r * tg.r;
        const disc = b * b - 4 * a * c;
        if (disc < 0) continue;
        const sq = Math.sqrt(disc);
        let tt = (-b - sq) / (2 * a);
        if (tt < 0) tt = (-b + sq) / (2 * a);
        if (tt < 0 || tt >= best) continue;
        const y = origin.y + dir.y * tt;
        if (y < tg.y0 || y > tg.y1) continue;
        best = tt;
        monsterId = tg.id;
      }
    }
    return { point: origin.clone().addScaledVector(dir, best), monsterId, dist: best };
  }

  onShot({ origin, muzzle, point, monsterId, follow }) {
    this.effects.muzzle(muzzle, 0.75);
    this.effects.tracer(muzzle, point, undefined, follow);
    if (!monsterId) {
      const s = surfaceAt(this.session.map, point, new THREE.Vector3().subVectors(point, origin));
      if (s) this.effects.bulletHole(point, s.normal, s.kind);
    }
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
        if (best.revIn > 0) prompt = t('player.reviveWait', { n: Math.ceil(best.revIn) });
        else if (me.revLeft <= 0) prompt = t('player.noRevives');
        else {
          prompt = t('player.reviveHold', { name: this.session.nameOf(best.id), n: me.revLeft });
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

    this.view3d.update(dt, this.time, this.camera);
    this.hud.update({ weapon: this.weapon, me, prompt: rev.prompt, center, revive: rev.ring, boss: this.monsters.bossInfo(), stamina: { value: this.ctrl.stamina, exhausted: this.ctrl.exhausted } });
    if (this.active) {
      // 전장 → 깊이 지우고 → 손·총 (낙서·이펙트가 손 위에 덮이지 않게)
      const r = this.renderer;
      r.autoClear = false;
      r.clear();
      r.render(this.scene, this.camera);
      if (this.weapon.view.visible) {
        r.clearDepth();
        r.render(this.weapon.vmScene, this.weapon.vmCam);
      }
    }
  }

  // 죽었을 때: 살아 있는 팀원 시점으로 관전
  spectate(me) {
    if (me?.st === PSTATE.ESCAPED) return t('player.escapedMe');
    if (me?.st === PSTATE.DEAD && me.resIn >= 0) return t('player.respawnIn', { n: Math.ceil(me.resIn) });
    const alive = this.session.players().filter((p) => p.id !== this.session.me && p.st === PSTATE.ALIVE);
    let msg = t('player.down');
    if (me?.st === PSTATE.DEAD && me.revIn > 0) msg += t('player.downRevIn', { n: Math.ceil(me.revIn) });
    else if (me?.st === PSTATE.DEAD && me.revIn === 0) msg += t('player.downRevNow');
    if (!alive.length) return msg;
    const target = alive[this.spectateIdx % alive.length];
    const p = this.session.playerPos(target.id);
    if (p) {
      const back = 4.5;
      this.camera.position.set(p.x + Math.sin(p.yaw) * back, 3.2, p.z + Math.cos(p.yaw) * back);
      this.camera.rotation.set(-0.35, p.yaw, 0);
    }
    return `${msg}\n${t('player.spectating', { name: this.session.nameOf(target.id) })}`;
  }

  dispose() {
    this._off.forEach((f) => f());
    window.removeEventListener('resize', this.onResize);
    this._offGfx?.();
    window.removeEventListener('mouseup', this._up);
    window.removeEventListener('keydown', this._key);
    this.ctrl.dispose();
    this.view3d.dispose();
    this.hud.dispose();
    this.renderer.dispose();
    this.root.remove();
  }
}
