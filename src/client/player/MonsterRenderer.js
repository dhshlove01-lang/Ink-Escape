import * as THREE from 'three';
import { EV } from '../../shared/protocol.js';
import { buildCutout } from '../render/PaperCutout.js';
import { texture, img } from '../render/Images.js';
import { vfxSprite } from './Effects.js';

// 몬스터 = 술래 그림 빌보드. 보는 사람 쪽으로 세로축만 돌린다 (종이 인형처럼 서 있음).
// 빨간 장판(소환 예고), 원거리 탄도 여기서 그린다.

function zoneTexture(boss) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 128);
  g.strokeStyle = boss ? 'rgba(255,40,60,0.95)' : 'rgba(230,30,45,0.9)';
  g.lineCap = 'round';
  g.lineWidth = 6;
  // 낙서 원 두 바퀴
  for (let k = 0; k < 2; k++) {
    g.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.2; a += 0.12) {
      const r = 112 - k * 10 + Math.sin(a * 7 + k) * 4;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.stroke();
  }
  if (boss) {
    g.lineWidth = 5;
    g.beginPath();
    for (let i = 0; i <= 5; i++) {
      const a = -Math.PI / 2 + i * ((Math.PI * 4) / 5);
      g.lineTo(Math.cos(a) * 96, Math.sin(a) * 96);
    }
    g.stroke();
  } else {
    g.fillStyle = 'rgba(200,20,40,0.35)';
    g.beginPath();
    g.arc(0, 0, 100, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function iconSprite(text, keys = []) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  const ims = keys.map((k) => img('icon.' + k)).filter(Boolean);
  if (ims.length && ims.length === keys.length) {
    const sz = 58;
    const x0 = 64 - (ims.length * sz) / 2;
    ims.forEach((im, i) => g.drawImage(im, x0 + i * sz, 3, sz, sz));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
    s.scale.set(0.9, 0.45, 1);
    return s;
  }
  g.font = '44px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 64, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(0.9, 0.45, 1);
  return s;
}

export class MonsterRenderer {
  constructor({ scene, session, palette, attributes, sfx, effects }) {
    this.scene = scene;
    this.session = session;
    this.palette = palette;
    this.attributes = attributes;
    this.sfx = sfx;
    this.effects = effects;
    this.items = new Map();
    this.zones = new Map();
    this.projs = new Map();
    // 소환 원: 사용자 이미지(일반은 투명 배경, 보스는 검은 배경 → 가산 합성), 없으면 코드로 그린 원
    const userBoss = texture('vfx.summon_boss');
    this.zoneTex = { normal: texture('vfx.summon') || zoneTexture(false), boss: userBoss || zoneTexture(true) };
    this.bossAdditive = !!userBoss;
    this.projGeo = new THREE.SphereGeometry(0.22, 12, 10);
    this.barBg = new THREE.SpriteMaterial({ color: 0x1a1414, depthWrite: false });

    this._off = [
      session.on(EV.MSPAWN, (e) => this.add(e)),
      session.on(EV.MDIE, (e) => this.kill(e.id)),
      session.on(EV.MHIT, (e) => this.flash(e.id)),
      session.on(EV.PENDING, (e) => this.addZone(e)),
    ];
    for (const [id, meta] of session.monsterMeta) this.add({ id, ...meta });
  }

  dispose() {
    this._off.forEach((f) => f());
  }

  add(e) {
    if (this.items.has(e.id)) return;
    const st = e.st;
    const cut = buildCutout(e.strokes, this.palette);
    const tex = new THREE.CanvasTexture(cut.canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const s = st.height / cut.bbox.h;
    const pw = cut.canvas.width * s, ph = cut.canvas.height * s;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat);
    const baseY = st.fly ? 3 : 0;
    plane.position.y = baseY - cut.pad * s + ph / 2;
    const group = new THREE.Group();
    group.add(plane);
    group.position.set(e.x, 0, e.z);

    // 그림자
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(Math.max(0.4, st.width * 0.4), 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    group.add(shadow);

    // 속성 오라
    const auraColor = new THREE.Color(this.attributes[st.attrs[0].key].aura);
    const n = 16;
    const pos = new Float32Array(n * 3);
    const aura = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
      new THREE.PointsMaterial({ color: auraColor, size: st.kind === 'normal' ? 0.14 : 0.3, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    group.add(aura);
    let aura2 = null;
    if (st.attrs[1]) {
      aura2 = aura.clone();
      aura2.material = aura.material.clone();
      aura2.material.color = new THREE.Color(this.attributes[st.attrs[1].key].aura);
      aura2.geometry = aura.geometry.clone();
      group.add(aura2);
    }

    // 머리 위: 속성 아이콘 + HP 막대
    const icons = st.attrs.map((a) => this.attributes[a.key].icon).join('');
    const icon = iconSprite(icons, st.attrs.map((a) => a.key));
    icon.position.y = baseY + st.height + 0.55;
    group.add(icon);
    const barW = Math.max(0.9, Math.min(2.4, st.width));
    const bg = new THREE.Sprite(this.barBg);
    bg.scale.set(barW + 0.06, 0.13, 1);
    bg.position.y = baseY + st.height + 0.2;
    const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xe0303f, depthWrite: false }));
    fg.center.set(0, 0.5);
    fg.scale.set(barW, 0.09, 1);
    fg.position.set(-barW / 2, baseY + st.height + 0.2, 0);
    const bar = new THREE.Group();
    bar.add(bg, fg);
    bar.visible = false;
    group.add(bar);

    this.scene.add(group);
    this.items.set(e.id, {
      id: e.id, group, plane, mat, st, baseY, planeY: plane.position.y, aura, aura2, bar, fg, barW,
      born: performance.now(), flashT: 0, dying: 0, phase: Math.random() * 10, lastX: e.x, lastZ: e.z,
    });
    this.removeZone(e.id);
    this.effects?.puff(e.x, e.z, st.kind !== 'normal');
    this.sfx.play('spawn');
  }

  kill(id) {
    const it = this.items.get(id);
    if (!it || it.dying) return;
    it.dying = performance.now();
    this.sfx.play('kill');
  }

  flash(id) {
    const it = this.items.get(id);
    if (it) it.flashT = 1;
  }

  addZone(e) {
    const tex = e.kind === 'normal' ? this.zoneTex.normal : this.zoneTex.boss;
    const r = e.kind === 'normal' ? e.r + 0.4 : e.r + 1.5;
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(r, 40),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.9, blending: e.kind !== 'normal' && this.bossAdditive ? THREE.AdditiveBlending : THREE.NormalBlending }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(e.x, 0.04, e.z);
    // 멀리서도 잘 보이게 반투명 빨간 바닥을 원 밑에 깐다
    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(r * 0.92, 40),
      new THREE.MeshBasicMaterial({ color: 0xd01828, transparent: true, opacity: 0.32, depthWrite: false }),
    );
    fill.position.z = -0.005; // 원 메시가 눕혀져 있어서 로컬 z 가 위쪽
    mesh.add(fill);
    this.scene.add(mesh);
    // 조명은 쓰지 않는다 (조명 개수가 바뀌면 화면이 끊김) — 빨간 바닥이 빛 역할
    this.zones.set(e.id, { mesh, until: performance.now() + e.delay * 1000 + 400 });
    this.sfx.play('pending');
  }

  removeZone(id) {
    const z = this.zones.get(id);
    if (!z) return;
    this.scene.remove(z.mesh);
    z.mesh.geometry.dispose();
    this.zones.delete(id);
  }

  // 총알 판정용 원기둥 목록
  targets() {
    const out = [];
    for (const it of this.items.values()) {
      if (it.dying) continue;
      out.push({ id: it.id, x: it.group.position.x, z: it.group.position.z, r: Math.max(0.35, it.st.width * 0.42), y0: it.baseY, y1: it.baseY + it.st.height });
    }
    return out;
  }

  update(dt, camera, time) {
    const now = performance.now();
    for (const it of [...this.items.values()]) {
      const g = it.group;
      if (it.dying) {
        const k = (now - it.dying) / 450;
        if (k >= 1) {
          this.scene.remove(g);
          it.mat.map.dispose();
          this.items.delete(it.id);
          continue;
        }
        it.plane.scale.set(1 + k * 0.4, Math.max(0.01, 1 - k), 1);
        it.plane.rotation.z = k * 0.8;
        it.mat.opacity = 1 - k;
        it.mat.color.setRGB(1 + k * 2, 1 + k * 2, 1 + k * 2);
        continue;
      }
      const p = this.session.monsterPos(it.id);
      if (p) {
        g.position.x = p.x;
        g.position.z = p.z;
        it.bar.visible = p.hp < p.maxHp && it.st.kind === 'normal';
        it.fg.scale.x = it.barW * Math.max(0, p.hp / p.maxHp);
        it.flags = p.flags;
      }
      // 세로축 빌보드
      g.rotation.y = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z);
      const moved = Math.hypot(g.position.x - it.lastX, g.position.z - it.lastZ) / Math.max(dt, 1e-3);
      it.lastX = g.position.x;
      it.lastZ = g.position.z;
      const t = time + it.phase;
      const born = Math.min(1, (now - it.born) / 350);
      const pop = born < 1 ? Math.sin(born * Math.PI * 0.5) * (1 + Math.sin(born * Math.PI) * 0.25) : 1;
      const dashing = it.flags & 1;
      const attacking = it.flags & 2;
      let sx = 1, sy = 1, lean = 0, bob = Math.sin(t * 3) * 0.03 * it.st.height;
      if (moved > 0.4) {
        lean = Math.sin(t * 10) * 0.09; // 뒤뚱뒤뚱
        sy = 1 + Math.abs(Math.sin(t * 10)) * 0.05;
      }
      if (attacking) sx = 1 + Math.abs(Math.sin(t * 12)) * 0.15;
      if (dashing) {
        sx = 1.25;
        sy = 0.8;
      }
      if (it.st.fly) bob += Math.sin(t * 5) * 0.25;
      it.plane.scale.set(sx * pop, sy * pop, 1);
      it.plane.rotation.z = lean;
      it.plane.position.y = it.planeY + bob;
      // 맞으면 하얗게 번쩍
      it.flashT = Math.max(0, it.flashT - dt * 8);
      const f = 1 + it.flashT * 2.5;
      it.mat.color.setRGB(f, f, f);
      // 오라 입자
      for (const a of [it.aura, it.aura2]) {
        if (!a) continue;
        const arr = a.geometry.attributes.position.array;
        const n = arr.length / 3;
        const R = Math.max(0.5, it.st.width * 0.55);
        const off = a === it.aura2 ? Math.PI / n : 0;
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2 + t * 0.8 + off;
          const rise = ((t * 0.6 + i * 0.37) % 1) * it.st.height;
          arr[i * 3] = Math.cos(ang) * R;
          arr[i * 3 + 1] = it.baseY + rise;
          arr[i * 3 + 2] = Math.sin(ang) * R;
        }
        a.geometry.attributes.position.needsUpdate = true;
      }
    }

    // 빨간 장판
    for (const [id, z] of [...this.zones]) {
      if (now > z.until) {
        this.removeZone(id);
        continue;
      }
      z.mesh.rotation.z += dt * 1.2;
      const pulse = 0.6 + Math.sin(time * 10) * 0.3;
      z.mesh.material.opacity = pulse;
    }

    // 원거리 탄
    const live = this.session.projectiles;
    for (const [id, m] of [...this.projs]) {
      if (!live.has(id)) {
        this.scene.remove(m);
        this.projs.delete(id);
      }
    }
    for (const [id, p] of live) {
      let m = this.projs.get(id);
      if (!m) {
        const color = this.attributes[p.color]?.aura || '#ffffff';
        m = vfxSprite('vfx.proj_' + p.color, 1.0) || new THREE.Mesh(this.projGeo, new THREE.MeshBasicMaterial({ color }));
        this.scene.add(m);
        this.projs.set(id, m);
      }
      const age = (now - p.born) / 1000;
      if (age > p.ttl + 0.3) {
        live.delete(id);
        continue;
      }
      m.position.set(p.x + p.vx * age, p.y + p.vy * age, p.z + p.vz * age);
      if (m.isSprite) m.material.rotation += dt * 6;
    }
  }

  bossInfo() {
    for (const it of this.items.values()) {
      if (it.st.kind !== 'normal' && !it.dying) {
        const p = this.session.monsterPos(it.id);
        if (p) return { hp: p.hp, maxHp: p.maxHp, kind: it.st.kind, attrs: it.st.attrs };
      }
    }
    return null;
  }
}
