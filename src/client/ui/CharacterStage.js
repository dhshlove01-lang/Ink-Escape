import * as THREE from 'three';
import { placeModel } from '../render/MapModels.js';
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
    this.resize();
    this.play();
  }

  // ── 무대(던전) 만들기 ─────────────────────────────────────────
  // 캐릭터 조명은 고정, 방(벽·바닥·횃불·소품)은 지금 맵의 테마로 만든다 → 맵이 바뀌면 setTheme 으로 다시 만든다.
  buildLights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xa79dd6, 0x33262a, 1.6));
    const key = new THREE.DirectionalLight(0xfff0d8, 1.5);
    key.position.set(3.5, 6, 4.5);
    s.add(key);
    const rim = new THREE.DirectionalLight(0xff4a5e, 0.9);
    rim.position.set(-4, 3, -5);
    s.add(rim);
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
    if (f.label === label && f.plate) return;
    f.label = label;
    // 결과 화면은 제목(승리/패배)과 패널이 이미 알려주므로 이름표를 달지 않는다
    if (this.mode === 'result') {
      if (f.plate) f.plate.visible = false;
      return;
    }
    if (!f.plate) {
      f.plate = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
      f.plate.scale.set(1.4, 0.46, 1);
      this.scene.add(f.plate);
    }
    f.plateTex?.dispose();
    f.plateTex = makePlateTexture({ name: c.name, badge, role: c.role, mine, owner, solo });
    f.plate.material.map = f.plateTex;
    f.plate.material.needsUpdate = true;
    f.plate.renderOrder = 20;
    // 결과 화면에서는 이름표를 머리 위로 더 높이
    f.plateY = this.mode === 'result' ? 1.95 : 1.85;
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
        f.plate.position.set(f.x, 0.2 + bob + f.plateY, f.z);
        f.plate.material.opacity = 1;
      }
    }

    for (const tc of this.torches || []) {
      const fl = 0.85 + Math.sin(t * 9 + tc.phase) * 0.1 + Math.sin(t * 23 + tc.phase * 2) * 0.06;
      tc.light.intensity = 30 * fl;
      tc.flame.scale.set(0.7 * (0.9 + fl * 0.12), 0.95 * (0.9 + fl * 0.12), 1);
      tc.glow.material.opacity = 0.35 + fl * 0.12;
    }

    // 카메라 아주 느린 흔들림 (살아 있는 느낌)
    if (this.baseCam) {
      this.camera.position.x = this.baseCam.x + Math.sin(t * 0.23) * 0.18;
      this.camera.position.y = this.baseCam.y + Math.sin(t * 0.31 + 1) * 0.03;
      this.camera.lookAt(this.cameraLook);
    }
    this.renderer.render(this.scene, this.camera);
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
    this.renderer.dispose();
    this.root.remove();
  }
}

// ── 머리 위 이름표 (캔버스 → 스프라이트) ─────────────────────────
const PLATE_W = 512;
const PLATE_H = 168;

function makePlateTexture({ name, badge, role, mine, owner, solo }) {
  const c = document.createElement('canvas');
  c.width = PLATE_W;
  c.height = PLATE_H;
  const g = c.getContext('2d');
  const accent = mine ? '#f0bd1e' : badge ? badge.color : '#3a3443';
  const r = 26;
  g.fillStyle = 'rgba(13,11,16,0.82)';
  roundRect(g, 6, 6, PLATE_W - 12, PLATE_H - 12, r);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = accent;
  roundRect(g, 6, 6, PLATE_W - 12, PLATE_H - 12, r);
  g.stroke();

  // 이름
  g.font = '58px "Jua", "Malgun Gothic", sans-serif';
  g.fillStyle = '#f3ecdd';
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  const clipped = name.length > 9 ? name.slice(0, 9) + '…' : name;
  g.fillText(`${owner ? '👑 ' : ''}${clipped}`, 34, 62);

  // 역할
  const roleText = solo ? t('role.both') : role === 'tagger' ? t('role.taggerShort') : role === 'player' ? t('role.playerShort') : t('role.randomShort');
  g.font = '34px "Jua", "Malgun Gothic", sans-serif';
  g.fillStyle = '#9a92a6';
  g.fillText(`${ROLE_ICON[role] || '🎲'} ${roleText}`, 34, 112);

  // READY / WIN 배지
  if (badge) {
    g.fillStyle = badge.color;
    roundRect(g, PLATE_W - 186, 34, 152, 62, 18);
    g.fill();
    g.fillStyle = '#0d0b10';
    g.font = '700 36px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(badge.text, PLATE_W - 110, 66);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
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

  // 벽 횃불 (게임과 같은 모양) + 실제 빛
  const flame = flameTexture(), glow = glowTexture();
  const torches = [-4.4, 4.4].map((x, i) => {
    const tor = buildTorch(kit, { flame, glow }, { x, z: BACK_Z + CELL / 2, nx: 0, nz: 1 }, i, theme.models?.torch);
    const light = new THREE.PointLight(theme.torch, 30, 16, 1.5);
    light.position.copy(tor.tip);
    room.add(tor.group, light);
    return { flame: tor.flame, glow: tor.glow, light, phase: i * 2.1 + 0.4 };
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
