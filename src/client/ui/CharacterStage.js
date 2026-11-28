import * as THREE from 'three';
import { placeModel } from '../render/MapModels.js';
import { FrameRenderer } from '../render/FrameRenderer.js';
import { el } from './dom.js';
import { createCharacterModel } from '../render/AnimalModels.js';
import { makeTextures, flameTexture } from '../player/SceneBuilder.js';
import { createDungeonKit, buildTorch, buildRuneCircle, glowTexture } from '../render/DungeonKit.js';
import { themeFor } from '../../config/themes.js';
import { CELL, WALL_H } from '../../shared/map/GameMap.js';
import { texture, textureFromUrl } from '../render/Images.js';
import { DECALS } from '../../config/assets.js';
import { ROLE } from '../../shared/protocol.js';
import { t, getLang } from '../i18n.js';
import { gfx } from '../render/GraphicsSettings.js';
import { MENU_FPS } from '../../config/graphics.js';

// 로비·결과 화면 뒤에 깔리는 3D 무대. 던전 단상 위에 캐릭터들이 서서 숨쉬고 깡총거린다.
// 폴가이즈 스타일: 캐릭터마다 단상 하나, 머리 위 이름표(+READY), 내 캐릭터는 노란 링.
// 화면(screens.js)은 setCharacters 로 누가 서는지만 알려준다.

const FOV = 38;
const ROLE_ICON = { [ROLE.TAGGER]: '👁', [ROLE.PLAYER]: '🔫', [ROLE.RANDOM]: '🎲' };

export class CharacterStage {
  /** @param mode 'lobby' | 'result' */
  constructor(parent, { mode = 'lobby', mapId = 'palace' } = {}) {
    this.mode = mode;
    this.root = el('div', { class: 'stage-canvas' });
    parent.append(this.root);

    this.renderer = new THREE.WebGLRenderer({ antialias: gfx.preset.antialias });
    this.fx = new FrameRenderer(this.renderer, { ink: { fadeNear: 30, fadeFar: 70 } }); // 선 없는 렌더 + 후처리 (기본)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.root.append(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0812);
    this.scene.fog = new THREE.Fog(0x0a0812, 12, 34);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 120);

    this.tex = makeTextures();
    this.figures = [];
    this.pads = [];
    this.time = 0;
    this.aspect = 1.5;
    this.paused = false;
    this._raf = 0;
    this._last = 0;

    this.buildLights();
    this.setTheme(mapId);
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this._offGfx = gfx.onChange(this.onResize);
    // 이름표는 웹폰트·이모지 글꼴이 다 불러와진 뒤에 다시 그린다 (먼저 그리면 글자가 잘린다)
    this._onFonts = () => this.refreshPlates();
    document.fonts?.ready?.then(this._onFonts);
    document.fonts?.addEventListener?.('loadingdone', this._onFonts);
    this.resize();
    this.play();
  }

  // ── 무대(던전) 만들기 ─────────────────────────────────────────
  // 캐릭터 조명은 고정, 방(벽·바닥·횃불·소품)은 지금 맵의 테마로 만든다 → 맵이 바뀌면 setTheme 으로 다시 만든다.
  buildLights() {
    const s = this.scene;
    // 조명 2개 (+결과 화면에서만 스포트라이트). 횃불은 빛무리 그림만 (2026-11-27 최적화)
    // 2026-11-28: 전장과 같은 차가운 밤빛 + 그림자 지는 키 라이트 (테마가 바뀌면 setTheme 이 색을 다시 맞춘다)
    const th = themeFor(this.mapId || 'palace');
    this.hemi = new THREE.HemisphereLight(th.hemi.sky, th.hemi.ground, th.hemi.intensity);
    s.add(this.hemi);
    const key = new THREE.DirectionalLight(th.key?.color ?? 0xfff0d8, th.key?.intensity ?? 1.6);
    key.position.set(6, 13, 9);
    key.target.position.set(0, 0.6, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 40 });
    key.shadow.camera.updateProjectionMatrix();
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.03;
    key.shadow.radius = 3;
    this.keyLight = key;
    s.add(key, key.target);
    // 결과 화면용: 중앙 단상 위 스포트라이트 + 바닥 광채
    this.spot = new THREE.SpotLight(0xfff2d0, 0, 16, 0.5, 0.55, 1.2);
    this.spot.position.set(0, 7.5, 2.2);
    this.spot.target.position.set(0, 0.6, 0);
    s.add(this.spot, this.spot.target);
  }

  /** 맵이 바뀌면 배경(방)을 그 맵 테마로 다시 만든다 */
  setTheme(mapId) {
    if (mapId === this.mapId && this.room) return;
    this.mapId = mapId;
    if (this.room) {
      this.scene.remove(this.room);
      disposeTree(this.room);
    }
    this.room = buildThemeRoom(themeFor(mapId), this.tex);
    this.torches = this.room.userData.torches;
    const th = themeFor(mapId);
    this.scene.background = new THREE.Color(th.background);
    this.scene.fog = new THREE.Fog(th.fog.color, 12, 36);
    this.scene.add(this.room);
    // 조명 색도 테마를 따라간다 (궁전 = 차가운 밤빛)
    this.hemi?.color.set(th.hemi.sky);
    this.hemi?.groundColor.set(th.hemi.ground);
    if (this.hemi) this.hemi.intensity = th.hemi.intensity;
    this.keyLight?.color.set(th.key?.color ?? 0xfff0d8);
    if (this.keyLight) this.keyLight.intensity = th.key?.intensity ?? 1.6;
    this.room.traverse((o) => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      if (!ms.length || ms.some((m) => !m || m.transparent || m.blending === THREE.AdditiveBlending || m.depthWrite === false)) return;
      o.receiveShadow = true;
      o.castShadow = !o.userData.noCast;
    });
  }

  // ── 캐릭터 배치 ───────────────────────────────────────────────
  /**
   * @param list [{ id, kind, name, ready, role }]
   * @param opts { me, ownerId, solo }
   */
  setCharacters(list, { me = null, ownerId = null, solo = false } = {}) {
    const seen = new Set();
    for (const c of list) {
      seen.add(c.id);
      const kind = c.kind || 'shiba';
      let f = this.figures.find((x) => x.id === c.id);
      if (!f) {
        f = this.addFigure(c.id);
        this.figures.push(f);
      }
      if (f.kind !== kind) {
        f.kind = kind;
        f.bodyHolder.clear();
        f.bodyHolder.add(createCharacterModel(kind, { gun: false }));
      }
      const mine = c.id === me;
      f.mine = mine;
      // 술래(또는 악마 캐릭터)는 딴짓 대신 연필로 바닥에 낙서한다
      f.tagger = c.role === ROLE.TAGGER || kind === 'devil';
      f.pencil.visible = false;
      f.ringTarget = mine ? 1 : 0;
      f.ring.material.color.set(mine ? 0xf0bd1e : c.ready ? 0x5ee39a : 0x6f6685);
      const badge = c.badge || (c.ready ? { text: 'READY', color: '#5ee39a' } : null);
      this.setPlate(f, c, { mine, owner: c.id === ownerId, solo, badge });
    }
    for (const f of this.figures.slice()) {
      if (seen.has(f.id)) continue;
      this.removeFigure(f);
      this.figures.splice(this.figures.indexOf(f), 1);
    }
    this.layout();
    this.requestPlateFonts();
  }

  addFigure(id) {
    const bodyHolder = new THREE.Group();
    const pad = new THREE.Group();
    const padTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.74, 0.82, 0.2, 28),
      new THREE.MeshStandardMaterial({ color: 0x4b4557, roughness: 0.92, metalness: 0.05 }),
    );
    padTop.position.y = 0.1;
    const padLip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.86, 0.9, 0.06, 28),
      new THREE.MeshStandardMaterial({ color: 0x393343, roughness: 0.95 }),
    );
    padLip.position.y = 0.03;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.78, 0.95, 40),
      new THREE.MeshBasicMaterial({ color: 0xf0bd1e, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.205;
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.8, 32),
      new THREE.MeshBasicMaterial({ color: 0xf0bd1e, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.208;
    padTop.receiveShadow = padLip.receiveShadow = true; // 발밑 그림자가 단상에 떨어진다
    pad.add(padTop, padLip, ring, glow);
    this.scene.add(pad);
    bodyHolder.position.y = 0.2;
    bodyHolder.rotation.y = Math.PI; // 모델은 -Z 를 보게 만들어져 있다 → 무대 카메라(+Z) 쪽으로 돌린다
    const sway = new THREE.Group();
    sway.add(bodyHolder);
    this.scene.add(sway);
    // 술래가 낙서할 때 드는 연필 (악마 모델은 원래 연필을 들고 있어서 안 씀)
    const pencil = makePencil();
    pencil.visible = false;
    sway.add(pencil);
    // 단상 앞 바닥 낙서 (캔버스에 조금씩 그려진다)
    const doodle = makeDoodlePlane();
    this.scene.add(doodle.mesh);

    return {
      id,
      kind: null,
      height: 1.55,
      pad,
      ring,
      glow,
      sway,
      bodyHolder,
      plate: null,
      plateTex: null,
      label: '',
      phase: Math.random() * Math.PI * 2,
      pencil,
      doodle,
      act: null, // 지금 하는 딴짓 { name, t, dur }
      nextAct: 1 + Math.random() * 3, // 다음 딴짓까지 남은 초
      x: 0,
      z: 0,
      yaw: 0,
    };
  }

  removeFigure(f) {
    this.scene.remove(f.pad, f.sway, f.doodle.mesh);
    f.doodle.dispose();
    if (f.plate) this.scene.remove(f.plate);
    f.plateTex?.dispose();
    f.ring.material.dispose();
    f.glow.material.dispose();
  }

  setPlate(f, c, { mine, owner, solo, badge }) {
    const label = `${c.name}｜${badge?.text || ''}｜${c.role || ''}｜${mine ? 1 : 0}｜${owner ? 1 : 0}｜${solo ? 1 : 0}｜${getLang()}`;
    f.plateArgs = { c, mine, owner, solo, badge }; // 글꼴이 늦게 준비되면 다시 그린다 (refreshPlates)
    if (f.label === label && f.plate) return;
    f.label = label;
    // 결과 화면은 제목(승리/패배)과 패널이 이미 알려주므로 이름표를 달지 않는다
    if (this.mode === 'result') {
      if (f.plate) f.plate.visible = false;
      return;
    }
    if (!f.plate) {
      f.plate = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
      this.scene.add(f.plate);
    }
    f.plateTex?.dispose();
    const plate = makePlateTexture({ name: c.name, badge, role: c.role, mine, owner, solo });
    f.plateTex = plate.tex;
    // 높이는 고정, 폭은 내용 길이대로. 5인 로비에서 이웃과 겹치지 않게 최대 폭만 자른다 (비율 유지).
    let pw = PLATE_H_W * (plate.w / plate.h);
    let ph = PLATE_H_W;
    if (pw > PLATE_MAX_W) {
      ph *= PLATE_MAX_W / pw;
      pw = PLATE_MAX_W;
    }
    f.plate.scale.set(pw, ph, 1);
    f.plate.material.map = f.plateTex;
    f.plate.material.needsUpdate = true;
    f.plate.renderOrder = 20;
    // 이름표 아랫변 높이 (머리 위 여백은 그대로 두고 위로 자란다)
    f.plateY = this.mode === 'result' ? 1.72 : 1.62; // = 아랫변
    f.plate.material.opacity = 1; // 크기를 바꾼 뒤 한 프레임 늦게 그려도 보이게
  }

  /** 이름표 글자에 쓰이는 글꼴 조각을 미리 불러온다 → 끝나면 이름표를 다시 그린다
   *  (Jua 는 한글 음절별 조각으로 나뉘어 있어, 그 조각이 오기 전에 잰 폭은 실제 글자보다 좁다) */
  requestPlateFonts() {
    const fonts = document.fonts;
    if (!fonts?.load) return;
    const names = this.figures.map((f) => f.plateArgs?.c.name || '').join(' ');
    const key = names + '|' + getLang();
    if (key === this._plateFontsKey) return;
    this._plateFontsKey = key;
    const text = `${names} ${t('role.both')} ${t('role.taggerShort')} ${t('role.playerShort')} ${t('role.randomShort')} 👑🎲👁🔫·READY WIN 0123456789`;
    // 주의: FontFaceSet.load 의 첫 인자는 글꼴 이름만 준다 (fallback 목록을 붙이면 Jua 조각이 안 불러와진다)
    Promise.allSettled([
      fonts.load(`${PLATE_NAME_PX}px Jua`, text),
      fonts.load(`${PLATE_ROLE_PX}px Jua`, text),
      fonts.load(`${PLATE_DOT_PX}px Jua`, text),
    ]).then(() => this.refreshPlates());
  }

  /** 이름표를 모두 다시 그린다 — 웹폰트·이모지 글꼴은 늦게 불러와져서, 먼저 잰 폭으로 그린 이름표는 글자가 잘릴 수 있다 */
  refreshPlates() {
    for (const f of this.figures) {
      const a = f.plateArgs;
      if (!a || !f.plate) continue;
      f.label = '';
      this.setPlate(f, a.c, { mine: a.mine, owner: a.owner, solo: a.solo, badge: a.badge });
    }
  }

  layout() {
    const n = Math.max(1, this.figures.length);
    const gap = n <= 2 ? 2.7 : n === 3 ? 2.35 : 2.05;
    this.figures.forEach((f, i) => {
      const c = i - (n - 1) / 2;
      f.x = c * gap;
      f.z = Math.abs(c) * (this.mode === 'result' ? 0 : 0.42); // 살짝 둥근 줄
      f.yaw = -c * 0.06;
      f.pad.position.set(f.x, 0, f.z);
      f.sway.position.set(f.x, 0, f.z);
      f.doodle.mesh.position.set(f.x + 0.05, 0.214, f.z + 0.4); // 단상 윗면 앞쪽 (발 앞)
    });
    this.frame(n);
  }

  frame(n) {
    const gap = n <= 2 ? 2.7 : n === 3 ? 2.35 : 2.05;
    const width = (n - 1) * gap + 1.9;
    const vfov = (FOV * Math.PI) / 180;
    const fitW = width / 2 / (Math.tan(vfov / 2) * Math.max(0.8, this.aspect));
    const base = this.mode === 'result' ? 4.9 : 4.4;
    const dist = Math.max(base, fitW + 0.7);
    this.baseCam = { x: 0, y: this.mode === 'result' ? 2.0 : 2.1, z: dist, lookY: this.mode === 'result' ? 0.95 : 1.05 };
    this.spot.intensity = this.mode === 'result' ? 26 : 0;
    this.spot.visible = this.mode === 'result'; // 꺼 둔 빛은 계산에서 빠진다
    this.cameraLook = new THREE.Vector3(0, this.baseCam.lookY, 0);
    this.camera.position.set(this.baseCam.x, this.baseCam.y, this.baseCam.z);
    this.camera.lookAt(this.cameraLook);
  }

  // ── 애니메이션 ───────────────────────────────────────────────
  play() {
    if (this._raf) return;
    this.paused = false;
    this._last = 0;
    const tick = (t) => {
      this._raf = requestAnimationFrame(tick);
      if (this.paused) return;
      if (this._last && t - this._last < gfx.frameInterval(MENU_FPS)) return; // 로비 무대는 초당 30번이면 충분
      const dt = Math.min(0.05, ((t - (this._last || t)) / 1000) || 0.016);
      this._last = t;
      this.update(dt);
    };
    this._raf = requestAnimationFrame(tick);
  }

  pause() {
    this.paused = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    const result = this.mode === 'result';

    for (const f of this.figures) {
      const ph = f.phase;
      // 대기: 정면을 본 채 천천히 좌우로 고개(몸)만 돌린다. 몸을 늘이거나 찌그러뜨리지 않는다 (사용자 지시 2026-11-27)
      let bob = 0;
      let rx = 0, rz = 0, ry = result ? Math.sin(t * 0.55 + ph) * 0.7 : Math.sin(t * IDLE_SWAY.speed + ph) * IDLE_SWAY.angle;
      // 딴짓: 대기실에선 술래의 연필 낙서만, 결과 화면에선 인사·깡총·한 바퀴
      if (!f.act) {
        f.nextAct -= dt;
        if (f.nextAct <= 0) f.act = pickAct(f, result);
      }
      if (f.act) {
        const a = f.act;
        a.t += dt;
        const k = Math.min(1, a.t / a.dur);
        const env = Math.sin(Math.PI * k); // 0 → 1 → 0
        const o = actPose(a.name, k, env, t, ph);
        rx += o.rx || 0;
        rz += o.rz || 0;
        ry = (o.ryAbs ?? ry) + (o.ry || 0);
        bob += o.dy || 0;
        if (a.name === 'draw') {
          f.pencil.visible = f.kind !== 'devil';
          f.pencil.rotation.z = -0.9 + Math.sin(t * 14) * 0.12;
          f.pencil.position.x = 0.42 + Math.sin(t * 7) * 0.05;
          f.doodle.draw(Math.min(1, k / 0.85), a.shape);
        }
        if (k >= 1) {
          if (a.name === 'draw') {
            f.pencil.visible = false;
            f.doodle.fadeOut();
          }
          f.act = null;
          f.nextAct = 2.5 + Math.random() * 4;
        }
      }
      f.doodle.update(dt);
      f.sway.position.y = bob;
      f.sway.scale.set(1, 1, 1);
      f.sway.rotation.set(rx, f.yaw + ry, rz);
      // 단상 링: 내 캐릭터는 노랗게, READY 는 초록으로 은은히
      const on = f.ringTarget || 0;
      f.ring.material.opacity += ((on ? 0.55 + Math.sin(t * 3 + ph) * 0.15 : 0.12) - f.ring.material.opacity) * Math.min(1, dt * 6);
      f.glow.material.opacity += ((on ? 0.16 : 0.05) - f.glow.material.opacity) * Math.min(1, dt * 6);
      if (f.plate) {
        f.plate.position.set(f.x, 0.2 + bob + f.plateY + f.plate.scale.y / 2, f.z); // plateY = 아랫변
        f.plate.material.opacity = 1;
      }
    }

    for (const tc of this.torches || []) {
      const fl = 0.85 + Math.sin(t * 9 + tc.phase) * 0.1 + Math.sin(t * 23 + tc.phase * 2) * 0.06;
      tc.flame.scale.set(0.7 * (0.9 + fl * 0.12), 0.95 * (0.9 + fl * 0.12), 1);
      tc.glow.material.opacity = 0.35 + fl * 0.12;
    }

    // 카메라 아주 느린 흔들림 (살아 있는 느낌)
    if (this.baseCam) {
      this.camera.position.x = this.baseCam.x + Math.sin(t * 0.23) * 0.18;
      this.camera.position.y = this.baseCam.y + Math.sin(t * 0.31 + 1) * 0.03;
      this.camera.lookAt(this.cameraLook);
    }
    this.fx.begin(this.scene, this.camera);
    this.fx.present();
  }

  resize() {
    const w = this.root.clientWidth || 320;
    const h = this.root.clientHeight || 240;
    this.renderer.setPixelRatio(gfx.pixelRatio(w));
    this.renderer.setSize(w, h, false);
    this.aspect = w / Math.max(1, h);
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    this.frame(Math.max(1, this.figures.length));
  }

  dispose() {
    this.pause();
    window.removeEventListener('resize', this.onResize);
    document.fonts?.removeEventListener?.('loadingdone', this._onFonts);
    this._offGfx?.();
    for (const f of this.figures) this.removeFigure(f);
    this.figures = [];
    this.scene.traverse((o) => {
      if (o.isMesh || o.isSprite) {
        o.geometry?.dispose?.();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m?.dispose?.();
      }
    });
    this.fx.dispose();
    this.renderer.dispose();
    this.root.remove();
  }
}

// ── 머리 위 이름표 (캔버스 → 스프라이트) ─────────────────────────
// 한 줄: [👑 이름] · [🎲 역할] [READY] — 글자 폭을 재서 상자 폭을 내용에 맞춘다 (2026-11-28 사용자 요청).
const PLATE_NAME_PX = 48;
const PLATE_ROLE_PX = 31;
const PLATE_DOT_PX = 36; // 이름과 역할 사이 가운뎃점
const PLATE_BADGE_PX = 26;
const PLATE_PAD_X = 26;
const PLATE_PAD_Y = 15;
const PLATE_GAP = 14; // 이름 · 역할 사이
const PLATE_BADGE_GAP = 18;
const PLATE_NAME_MAX = 12; // 이름이 너무 길면 … (한글 기준)
const PLATE_DS = 2; // 캔버스를 2배로 그려 글자를 또렷하게
const PLATE_H_W = 0.27; // 이름표 높이 (m). 옛 2줄 이름표(0.46)의 이름 글자 크기와 비슷하게
const PLATE_MAX_W = 1.78; // 5인 로비 간격(2.05m)에서 이웃과 겹치지 않는 최대 폭 (m)

const plateFont = (px, weight = '') => `${weight}${px}px "Jua", "Malgun Gothic", sans-serif`;

function plateRoleText(role, solo) {
  return solo ? t('role.both') : role === 'tagger' ? t('role.taggerShort') : role === 'player' ? t('role.playerShort') : t('role.randomShort');
}

/** 이름표 텍스처와 그 캔버스 크기 { tex, w, h } (w·h 는 캔버스 px, 3D 크기 계산에 쓴다)
 *  이모지(👑·🎲)는 폭이 글꼴·렌더 단계마다 달라서 글자 폭 재기로는 상자 폭을 못 믿는다
 *  → 이모지는 정해진 자리(슬롯)에 가운데로 그리고, 상자 폭은 이모지가 없는 글자 폭으로만 계산한다. */
function makePlateTexture({ name, badge, role, mine, owner, solo }) {
  const clippedName = name.length > PLATE_NAME_MAX ? name.slice(0, PLATE_NAME_MAX) + '…' : name;
  const roleText = plateRoleText(role, solo);
  const roleIcon = solo ? '🎲' : ROLE_ICON[role] || '🎲';
  const badgeText = badge?.text || '';
  const nameIconW = Math.round(PLATE_NAME_PX * 1.38); // 👑 자리
  const roleIconW = Math.round(PLATE_ROLE_PX * 1.5); // 🎲 자리

  const m = document.createElement('canvas').getContext('2d');
  m.font = plateFont(PLATE_NAME_PX);
  const nameW = m.measureText(clippedName).width;
  m.font = plateFont(PLATE_ROLE_PX);
  const roleW = m.measureText(roleText).width;
  m.font = plateFont(PLATE_DOT_PX);
  const dotW = m.measureText('·').width;
  const badgeH = badgeText ? Math.round(PLATE_BADGE_PX * 1.65) : 0;
  let badgeW = 0;
  if (badgeText) {
    m.font = `700 ${PLATE_BADGE_PX}px "Jua", system-ui, sans-serif`;
    badgeW = Math.ceil(m.measureText(badgeText).width) + PLATE_BADGE_PX;
  }

  const textW = (owner ? nameIconW : 0) + nameW + PLATE_GAP + dotW + PLATE_GAP + roleIconW + roleW;
  const W = Math.ceil(PLATE_PAD_X + textW + (badgeText ? PLATE_BADGE_GAP + badgeW : 0) + PLATE_PAD_X + 4); // 오른쪽은 글자 여백이 좁아 살짝 더
  const H = Math.ceil(PLATE_PAD_Y * 2 + Math.max(PLATE_NAME_PX * 1.16, badgeH));

  const c = document.createElement('canvas');
  c.width = W * PLATE_DS;
  c.height = H * PLATE_DS;
  const g = c.getContext('2d');
  g.scale(PLATE_DS, PLATE_DS);

  const accent = mine ? '#f0bd1e' : badge ? badge.color : '#3a3443';
  const r = Math.min(24, H / 2 - 4);
  g.fillStyle = 'rgba(13,11,16,0.82)';
  roundRect(g, 3, 3, W - 6, H - 6, r);
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = accent;
  roundRect(g, 3, 3, W - 6, H - 6, r);
  g.stroke();

  const cy = H / 2 + 1; // 글자 시각 중심을 살짝 아래로 (Jua 는 위쪽이 비어 보인다)
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  let x = PLATE_PAD_X;

  // 👑 (자리 가운데) → 이름 (크림색)
  if (owner) {
    g.font = plateFont(PLATE_NAME_PX);
    g.fillStyle = '#f3ecdd';
    g.fillText('👑', x + nameIconW / 2, cy);
    x += nameIconW;
  }
  g.textAlign = 'left';
  g.fillStyle = '#f3ecdd';
  g.fillText(clippedName, x, cy);
  x += nameW + PLATE_GAP;

  // · 구분점
  g.font = plateFont(PLATE_DOT_PX);
  g.fillStyle = '#9a92a6';
  g.fillText('·', x, cy);
  x += dotW + PLATE_GAP;

  // 🎲 (자리 가운데) → 역할 (회색)
  g.textAlign = 'center';
  g.font = plateFont(PLATE_ROLE_PX);
  g.fillStyle = '#a49cb0';
  g.fillText(roleIcon, x + roleIconW / 2, cy);
  x += roleIconW;
  g.textAlign = 'left';
  g.fillText(roleText, x, cy);

  // READY / WIN 배지 (오른쪽 끝, 세로 가운데)
  if (badgeText) {
    const bx = W - PLATE_PAD_X - badgeW;
    g.fillStyle = badge.color;
    roundRect(g, bx, (H - badgeH) / 2, badgeW, badgeH, badgeH / 2);
    g.fill();
    g.fillStyle = '#0d0b10';
    g.font = `700 ${PLATE_BADGE_PX}px "Jua", system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText(badgeText, bx + badgeW / 2, cy);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, w: W, h: H };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ── 테마로 만드는 대기실 방 (게임 전장과 같은 재료: 돌벽·기둥·벽 횃불·천·크레용 원·낙서) ──
function buildThemeRoom(theme, fallback) {
  const room = new THREE.Group();
  const H = WALL_H + 3; // 카메라가 위를 조금 더 보므로 높게
  // 텍스처 한 장 크기(theme.tile, m)가 있으면 그 크기대로 반복 (궁전), 없으면 칸마다 한 장 (던전)
  const wallRep = theme.tile ? [CELL / theme.tile.wall[0], H / theme.tile.wall[1]] : [1, WALL_H / CELL];
  const wallTex = texture(theme.tex.wall, { repeat: wallRep }) || fallback.wall;
  const pillarTex = theme.tex.pillar ? texture(theme.tex.pillar, { repeat: [1, WALL_H / CELL] }) : null;
  const floorRep = theme.tile ? 40 / theme.tile.floor : 12;
  const floorTex = (texture(theme.tex.floor, { repeat: [floorRep, floorRep] }) || fallback.floor).clone();
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(floorRep, floorRep);
  floorTex.needsUpdate = true;
  const kit = createDungeonKit({ wallTex, floorTex, pillarTex });
  const { mats } = kit;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), mats.floor);
  floor.userData.noCast = true;
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 4;
  room.add(floor);

  // 벽: 게임처럼 칸(CELL) 크기 돌 상자를 줄지어 세운다 (뒤 벽 + 옆 벽)
  const BACK_Z = -8.5;
  const cells = [];
  for (let x = -16; x <= 16; x += CELL) cells.push([x, BACK_Z]);
  for (const sx of [-1, 1]) for (let z = BACK_Z + CELL; z <= 6; z += CELL) cells.push([sx * 15, z]);
  const box = new THREE.BoxGeometry(CELL, H, CELL);
  const walls = new THREE.InstancedMesh(box, mats.stone, cells.length);
  const skirt = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL + 0.04, 0.85, CELL + 0.04), mats.stoneDark, cells.length);
  const m4 = new THREE.Matrix4();
  cells.forEach(([x, z], i) => {
    walls.setMatrixAt(i, m4.makeTranslation(x, H / 2, z));
    skirt.setMatrixAt(i, m4.makeTranslation(x, 0.425, z));
  });
  room.add(walls, skirt);

  // 기둥 두 개 (머리·받침)
  for (const x of [-7.2, 7.2]) {
    if (theme.models?.pillar) {
      const gp = placeModel(theme.models.pillar, { fit: { x: CELL * 0.95, y: H } });
      gp.position.set(x, 0, BACK_Z + CELL * 0.95);
      room.add(gp);
      continue;
    }
    const p = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.84, H, CELL * 0.84), mats.pillar);
    p.position.set(x, H / 2, BACK_Z + CELL * 0.95);
    const base = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.98, 0.6, CELL * 0.98), mats.trim);
    base.position.set(x, 0.3, p.position.z);
    room.add(p, base);
  }

  // 벽 횃불 (게임과 같은 모양, 빛무리만)
  const flame = flameTexture(), glow = glowTexture();
  const torches = [-4.4, 4.4].map((x, i) => {
    const tor = buildTorch(kit, { flame, glow }, { x, z: BACK_Z + CELL / 2, nx: 0, nz: 1 }, i, theme.models?.torch);
    room.add(tor.group);
    return { flame: tor.flame, glow: tor.glow, phase: i * 2.1 + 0.4 };
  });
  room.userData.torches = torches;

  // 가운데 벽에 거는 천
  if (theme.banner) {
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.6), mats.cloth);
    banner.position.set(0, 4.6, BACK_Z + CELL / 2 + 0.03);
    room.add(banner);
  }

  // 뒷벽 가운데 스테인드글라스 창 (궁전)
  if (theme.lobby?.window) {
    const w = placeModel(theme.lobby.window, { decorate: (m) => m.traverse((o) => { if (o.isMesh) { o.material.emissive = new THREE.Color(0xffffff); o.material.emissiveMap = o.material.map; o.material.emissiveIntensity = 0.55; } }) });
    w.position.set(0, 1.6, BACK_Z + CELL / 2 + 0.12);
    room.add(w);
  }

  // 바닥 크레용 원 (단상 아래)
  if (theme.rune) buildRuneCircle(room, 0, 0.6, 5.2);

  // 벽 낙서 (테마가 고른 번호)
  const list = [...(theme.decals?.chalk || []).map((n) => DECALS.chalk[n]), ...(theme.decals?.red || []).map((n) => DECALS.red[n])].filter(Boolean);
  const geo = new THREE.PlaneGeometry(1, 1);
  const spots = [[-10.5, 3.2], [-2.3, 2.6], [2.4, 5.6], [10.4, 3.0], [-10.2, 5.8], [10.8, 6.1], [-2.6, 6.2], [2.2, 2.4]];
  list.forEach((u, i) => {
    const [x, y] = spots[i % spots.length];
    textureFromUrl(u).then((tex) => {
      if (!tex || !room.parent) return;
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85 }));
      const size = 1.4 + (i % 3) * 0.45;
      m.scale.set(size, size, 1);
      m.position.set(x, y, BACK_Z + CELL / 2 + 0.02);
      m.rotation.z = (i % 2 ? 1 : -1) * 0.08;
      room.add(m);
    });
  });
  return room;
}

function disposeTree(root) {
  root.traverse((o) => {
    if (!(o.isMesh || o.isSprite)) return;
    o.geometry?.dispose?.();
    const m = o.material;
    (Array.isArray(m) ? m : [m]).forEach((x) => x?.dispose?.());
  });
}

// ── 대기실 딴짓 ─────────────────────────────────────────────────
const IDLE_SWAY = { speed: 0.5, angle: 0.32 }; // 대기 좌우 돌기: 속도(rad/s 배율)·최대 각도(rad ≈ 18°)
const PLAYER_ACTS = []; // 대기실 플레이어는 딴짓 없이 좌우로만
const RESULT_ACTS = ['hop', 'spin', 'bow'];
const DOODLES = ['spiral', 'star', 'smile', 'heart', 'zigzag'];

function pickAct(f, result) {
  if (!result && f.tagger && Math.random() < 0.75) {
    return { name: 'draw', t: 0, dur: 4.2, shape: DOODLES[Math.floor(Math.random() * DOODLES.length)] };
  }
  const list = result ? RESULT_ACTS : PLAYER_ACTS;
  if (!list.length) return null;
  let name = list[Math.floor(Math.random() * list.length)];
  if (name === f.lastAct) name = list[(list.indexOf(name) + 1) % list.length];
  f.lastAct = name;
  const dur = { bow: 1.6, look: 2.6, stretch: 1.8, hop: 1.1, spin: 1.3, tilt: 1.8 }[name];
  return { name, t: 0, dur };
}

const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

// 동작별 자세 (sway 기준: rx>0 앞으로 숙임, ry 고개 돌림, rz 옆으로 기울임)
function actPose(name, k, env, t) {
  switch (name) {
    case 'bow': { // 꾸벅 인사 + 마지막에 살짝 통
      const b = Math.sin(Math.PI * Math.min(1, k / 0.7));
      return { rx: b * b * 0.45, dy: k > 0.75 ? Math.sin(((k - 0.75) / 0.25) * Math.PI) * 0.12 : 0 };
    }
    case 'look': // 두리번두리번
      return { ry: Math.sin(k * Math.PI * 2) * 0.75 * env, rz: Math.sin(k * Math.PI * 2) * 0.05 };
    case 'stretch': // 기지개: 쭉 늘었다가
      return { sy: 1 + env * 0.13, sxz: 1 - env * 0.06, rx: -env * 0.12 };
    case 'hop': { // 깡총깡총
      const h = Math.abs(Math.sin(k * Math.PI * 2));
      return { dy: h * 0.38 * (1 - k * 0.35) };
    }
    case 'spin': // 제자리 한 바퀴
      return { ry: ease(k) * Math.PI * 2, dy: env * 0.22 };
    case 'tilt': // 갸우뚱
      return { rz: env * 0.24, ry: env * 0.25 };
    case 'draw': // 숙여서 바닥에 끄적끄적
      return { rx: env * 0.3 + Math.sin(t * 9) * 0.02 * env, rz: Math.sin(t * 7) * 0.05 * env, ryAbs: Math.sin(t * 3.1) * 0.12 };
    default:
      return {};
  }
}

// 노란 연필 (지우개·나무 끝·심)
function makePencil() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.62, 6), new THREE.MeshLambertMaterial({ color: 0xf5b82e }));
  const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.09, 10), new THREE.MeshLambertMaterial({ color: 0xf08aa0 }));
  eraser.position.y = 0.35;
  const wood = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 6), new THREE.MeshLambertMaterial({ color: 0xe8c89a }));
  wood.rotation.x = Math.PI;
  wood.position.y = -0.37;
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.045, 6), new THREE.MeshLambertMaterial({ color: 0xc4182c }));
  lead.rotation.x = Math.PI;
  lead.position.y = -0.445;
  g.add(body, eraser, wood, lead);
  g.position.set(0.42, 0.62, 0.42);
  g.rotation.set(0.5, 0, -0.9);
  return g;
}

// 단상 앞 바닥 낙서: 빨간 크레용으로 모양을 조금씩 그리고, 다 그리면 천천히 사라진다
function makeDoodlePlane() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 3;
  let drawn = -1, fading = 0;
  const path = (shape) => {
    const pts = [];
    const N = 90;
    for (let i = 0; i <= N; i++) {
      const u = i / N, a = u * Math.PI * 2;
      let x = 0, y = 0;
      if (shape === 'spiral') { const r = 18 + u * 90; x = Math.cos(a * 3) * r; y = Math.sin(a * 3) * r; }
      else if (shape === 'star') { const j = Math.floor(u * 5), f = u * 5 - j; const p = (n) => [Math.cos((n * 4 * Math.PI) / 5 - Math.PI / 2) * 100, Math.sin((n * 4 * Math.PI) / 5 - Math.PI / 2) * 100]; const [ax, ay] = p(j), [bx, by] = p(j + 1); x = ax + (bx - ax) * f; y = ay + (by - ay) * f; }
      else if (shape === 'heart') { x = 6 * 16 * Math.pow(Math.sin(a), 3); y = -6 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)); }
      else if (shape === 'zigzag') { x = -100 + u * 200; y = (Math.floor(u * 8) % 2 ? 1 : -1) * (40 - Math.abs(((u * 8) % 1) - 0.5) * 80) ; }
      else { // smile: 얼굴 동그라미 → 눈 → 입
        if (u < 0.6) { const b = (u / 0.6) * Math.PI * 2; x = Math.cos(b) * 100; y = Math.sin(b) * 100; }
        else if (u < 0.7) { x = -35; y = -30 + ((u - 0.6) / 0.1) * 20; }
        else if (u < 0.8) { x = 35; y = -30 + ((u - 0.7) / 0.1) * 20; }
        else { const b = Math.PI * 0.15 + ((u - 0.8) / 0.2) * Math.PI * 0.7; x = Math.cos(b) * 55; y = Math.sin(b) * 55; }
      }
      pts.push([128 + x, 128 + y + (Math.sin(i * 1.7) * 2)]);
    }
    return pts;
  };
  let pts = null;
  return {
    mesh,
    draw(k, shape) {
      if (drawn < 0) {
        pts = path(shape);
        g.clearRect(0, 0, 256, 256);
        mat.opacity = 1;
        fading = 0;
        drawn = 0;
      }
      const upto = Math.floor(k * (pts.length - 1));
      if (upto <= drawn) return;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (const [w, col] of [[16, 'rgba(198,26,42,0.35)'], [9, 'rgba(230,40,58,1)']]) {
        g.strokeStyle = col;
        g.lineWidth = w;
        g.beginPath();
        g.moveTo(...pts[Math.max(0, drawn)]);
        for (let i = drawn + 1; i <= upto; i++) {
          if (pts[i - 1] && Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) > 60) g.moveTo(...pts[i]);
          else g.lineTo(...pts[i]);
        }
        g.stroke();
      }
      drawn = upto;
      tex.needsUpdate = true;
    },
    fadeOut() {
      fading = 1;
      drawn = -1;
    },
    update(dt) {
      if (!fading) return;
      mat.opacity = Math.max(0, mat.opacity - dt * 0.35);
      if (mat.opacity <= 0) fading = 0;
    },
    dispose() {
      tex.dispose();
      mat.dispose();
      mesh.geometry.dispose();
    },
  };
}
