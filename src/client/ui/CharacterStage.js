import * as THREE from 'three';
import { el } from './dom.js';
import { createCharacterModel } from '../render/AnimalModels.js';
import { makeTextures } from '../player/SceneBuilder.js';
import { texture, textureFromUrl } from '../render/Images.js';
import { DECALS } from '../../config/assets.js';
import { ROLE } from '../../shared/protocol.js';
import { t, getLang } from '../i18n.js';

// 로비·결과 화면 뒤에 깔리는 3D 무대. 던전 단상 위에 캐릭터들이 서서 숨쉬고 깡총거린다.
// 폴가이즈 스타일: 캐릭터마다 단상 하나, 머리 위 이름표(+READY), 내 캐릭터는 노란 링.
// 화면(screens.js)은 setCharacters 로 누가 서는지만 알려준다.

const FOV = 38;
const ROLE_ICON = { [ROLE.TAGGER]: '👁', [ROLE.PLAYER]: '🔫', [ROLE.RANDOM]: '🎲' };

export class CharacterStage {
  /** @param mode 'lobby' | 'result' */
  constructor(parent, { mode = 'lobby' } = {}) {
    this.mode = mode;
    this.root = el('div', { class: 'stage-canvas' });
    parent.append(this.root);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
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

    this.buildRoom();
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resize();
    this.play();
  }

  // ── 무대(던전) 만들기 ─────────────────────────────────────────
  buildRoom() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xa79dd6, 0x33262a, 2.0));
    const key = new THREE.DirectionalLight(0xfff0d8, 1.5);
    key.position.set(3.5, 6, 4.5);
    s.add(key);
    const rim = new THREE.DirectionalLight(0xff4a5e, 0.9);
    rim.position.set(-4, 3, -5);
    s.add(rim);

    const floorTex = texture('tex.floor') || this.tex.floor;
    const ft = floorTex.clone();
    ft.needsUpdate = true;
    ft.wrapS = ft.wrapT = THREE.RepeatWrapping;
    ft.repeat.set(10, 10);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshLambertMaterial({ map: ft }));
    floor.rotation.x = -Math.PI / 2;
    s.add(floor);

    const wallTex = texture('tex.wall') || this.tex.wall;
    const wt = wallTex.clone();
    wt.needsUpdate = true;
    wt.wrapS = wt.wrapT = THREE.RepeatWrapping;
    wt.repeat.set(6, 2);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(60, 10, 0.8), new THREE.MeshLambertMaterial({ map: wt }));
    wall.position.set(0, 5, -8.5);
    s.add(wall);
    // 옆 벽은 어둡게 물러나게
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.8, 10, 24), new THREE.MeshLambertMaterial({ map: wt, color: 0x8f8a9c }));
      side.position.set(sx * 12, 5, -4);
      s.add(side);
    }

    // 벽에 붙은 분필·빨간 낙서 (같은 자리 — 고정 순서)
    const decals = [...DECALS.chalk.slice(0, 4), ...DECALS.red.slice(0, 2)];
    const geo = new THREE.PlaneGeometry(1, 1);
    decals.forEach((u, i) => {
      textureFromUrl(u).then((tex) => {
        if (!tex) return;
        const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85 }));
        const size = 1.5 + (i % 3) * 0.5;
        m.scale.set(size, size, 1);
        m.position.set(-5.2 + i * 2.1, 3.1 + (i % 2) * 0.9, -8.05);
        m.rotation.z = (i % 2 ? 1 : -1) * 0.08;
        this.scene.add(m);
      });
    });

    // 횃불 두 개 (따뜻한 점광 + 흔들림)
    this.torches = [-4.6, 4.6].map((x, i) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 2.6, 8), new THREE.MeshLambertMaterial({ color: 0x2b2229 }));
      post.position.set(x, 1.3, -6.2);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.18, 0.3, 12), new THREE.MeshLambertMaterial({ color: 0x3a2a26 }));
      bowl.position.set(x, 2.72, -6.2);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffa03c }));
      flame.position.set(x, 3.02, -6.2);
      const light = new THREE.PointLight(0xff9a4a, 26, 16, 1.6);
      light.position.set(x, 3.2, -5.6);
      this.scene.add(post, bowl, flame, light);
      return { flame, light, phase: i * 2.1 + 0.4 };
    });

    // 결과 화면용: 중앙 단상 위 스포트라이트 + 바닥 광채
    this.spot = new THREE.SpotLight(0xfff2d0, 0, 16, 0.5, 0.55, 1.2);
    this.spot.position.set(0, 7.5, 2.2);
    this.spot.target.position.set(0, 0.6, 0);
    this.scene.add(this.spot, this.spot.target);
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
      hopPhase: Math.random() * Math.PI * 2,
      x: 0,
      z: 0,
      yaw: 0,
    };
  }

  removeFigure(f) {
    this.scene.remove(f.pad, f.sway);
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
      // 숨쉬기
      const breath = 1 + Math.sin(t * 2.0 + ph) * 0.016;
      // 가끔 깡총 (sin^9 = 대부분 0, 주기적으로 한 번)
      const hopT = Math.sin(t * 0.72 + f.hopPhase);
      const hop = Math.pow(Math.max(0, hopT), 9) * (result ? 0.5 : 0.3);
      const bob = Math.sin(t * 1.5 + ph) * 0.03 + hop;
      f.sway.position.y = bob;
      f.sway.scale.set(1 + (1 - breath) * 0.7, breath, 1 + (1 - breath) * 0.7);
      // 아이들 좌우 흔들기 + 결과 화면에서는 몸을 보여주듯 천천히 돌기
      f.sway.rotation.y = result
        ? f.yaw + Math.sin(t * 0.55 + ph) * 0.7
        : f.yaw + Math.sin(t * 0.6 + ph) * 0.22;
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
      tc.light.intensity = 26 * fl;
      tc.flame.scale.setScalar(0.9 + fl * 0.12);
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
    this.renderer.setSize(w, h, false);
    this.aspect = w / Math.max(1, h);
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    this.frame(Math.max(1, this.figures.length));
  }

  dispose() {
    this.pause();
    window.removeEventListener('resize', this.onResize);
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
