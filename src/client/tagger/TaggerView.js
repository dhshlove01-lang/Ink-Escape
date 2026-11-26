import { el, fmtTime, Banner, toast, icon } from '../ui/dom.js';
import { MSG, EV, PSTATE } from '../../shared/protocol.js';
import { DrawingPad, BRUSHES } from './DrawingPad.js';
import { TopDownMap } from './TopDownMap.js';
import { TaggerCam } from './TaggerCam.js';
import { ColorPicker } from './ColorPicker.js';
import { validSpawnSpot } from './spawnSpot.js';
import { nearestPaletteIndex } from '../../shared/attributes.js';
import { buildCutout } from '../render/PaperCutout.js';
import { faceCanvas } from '../render/AnimalModels.js';
import { t, tr } from '../i18n.js';
import { augChips, augName } from '../ui/AugmentPicker.js';

// 술래 화면 (IMG_1239 스타일 2분할)
//   왼쪽 = 실시간 3D 탑뷰(플레이어 카드는 위, 미니맵은 아래, 화면 전환은 오른쪽 아래)
//   오른쪽 = DIRECTOR: PENCIL INK 게이지 / 공책 도화지 + 세로 색 팔레트 / 속성·재소환 / 큰 SPAWN

const RECALL_SLOTS = 3;
const MINI_FPS = 14;

export class TaggerView {
  constructor({ parent, session, balance, palette, attributes, judge, sfx }) {
    this.session = session;
    this.b = balance;
    this.palette = palette;
    this.attributes = attributes;
    this.judge = judge;
    this.sfx = sfx;
    this.active = true;
    this.recall = [];
    this.boss = false;
    this.allIn = false;
    this.preview = null;
    this.waiting = false;

    this.pad = new DrawingPad({ palette, classify: nearestPaletteIndex });
    this.picker = new ColorPicker(this.pad.rgb);
    this.placing = null; // SPAWN 을 누른 뒤 화면 클릭을 기다리는 그림
    this.attr = null; // 고른 속성 (null = 기본). 색과 무관 — 사용자 C안
    this.topdown = new TopDownMap({ session, palette, balance, mini: true }); // 미니맵
    this.cam = new TaggerCam({ session, palette, attributes, balance });
    // 왼쪽 화면 목록: 3D 탑뷰 + 플레이어별 따라가기 카메라
    this.leftViews = ['top', ...session.roster.players.map((p) => p.id)];
    this.viewIdx = 0;
    this.root = el('div', { class: 'view tagger-view' });
    parent.append(this.root);
    this.build();
    this.banner = new Banner(this.root);

    this.pad.on('change', () => this.schedulePreview());
    this.pad.on('tool', () => this.refreshTools());
    this.picker.on('change', (rgb) => this.pad.setRgb(rgb));
    this.cam.on('pick', (w) => this.onPick(w));
    this.cam.root.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.cancelPlace();
    });
    this._off = [
      session.on('spawnResult', (r) => this.onSpawnResult(r)),
      session.on('snap', () => this.onSnap()),
      session.on(EV.BOSS, () => this.sfx.play('siren')),
      session.on(EV.DOOR_OPEN, () => this.banner.show(t('tagger.frenzy'), { kind: 'boss', ms: 3500 })),
      session.on(EV.ONE_MIN, () => this.banner.show(t('game.oneMin'), { kind: 'warn' })),
      session.on(EV.PDEATH, (e) => this.banner.show(t('tagger.downed', { name: session.nameOf(e.id) }), { kind: 'good', ms: 1800 })),
      session.on(EV.PESCAPE, (e) => this.banner.show(t('tagger.escapedBanner', { name: session.nameOf(e.id) }), { kind: 'warn' })),
      // 보급: 상자 위치 알림, 내 카드, 누가 무엇을 얻었나 (플레이어 카드·내 증강 줄)
      session.on(EV.SUPPLY, () => this.banner.show(t('supply.dropTagger'), { kind: 'warn', ms: 3500 })),
      session.on('offer', (o) => o.side === 'tagger' && this.banner.show(t('supply.cards'), { kind: 'good', ms: 2200 })),
      session.on(EV.AUG, (e) => {
        if (e.side === 'tagger') this.myAugs.replaceChildren(...augChips(session.taggerAugs, this.b, { small: true }));
        else {
          const r = this.prows.get(e.id);
          if (r) r.augs.replaceChildren(...augChips(session.augOf(e.id), this.b, { small: true }));
          if (!(session.role === 'both')) this.banner.show(t('supply.got', { name: session.nameOf(e.id), aug: augName(e.key) }), { kind: 'warn', ms: 1800 });
        }
      }),
    ];
    this._key = (e) => this.onKey(e);
    window.addEventListener('keydown', this._key);
    this.refreshTools();
    this.refreshPreview();
  }

  build() {
    const S = this.session;
    // ── 왼쪽: 3D 무대 ─────────────────────────────────────────
    this.timer = el('div', { class: 'tg-timer' }, '10:00');
    this.viewLabel = el('span', { class: 'view-name' });
    const arrow = (dir) => el('button', { class: `view-arrow ${dir < 0 ? 'left' : 'right'}`, title: dir < 0 ? t('tagger.prevView') : t('tagger.nextView'), onclick: () => this.setView(this.viewIdx + dir) }, dir < 0 ? '◀' : '▶');

    // 플레이어 카드 (무대 위 왼쪽 위에 겹쳐 놓는다)
    this.cards = el('div', { class: 'tg-cards' });
    this.prows = new Map();
    for (const p of S.roster.players) {
      const hp = el('div', { class: 'mini-fill' });
      const hpText = el('span', { class: 'tg-hpnum' });
      const info = el('span', { class: 'tg-pinfo' });
      const augs = el('span', { class: 'tg-paugs' }); // 그 플레이어가 가진 보급 증강
      const face = faceCanvas(p.animal, 40);
      const row = el('button', { class: 'tg-prow', title: t('tagger.followTitle', { name: p.name }), onclick: () => this.setView(this.leftViews.indexOf(p.id)) },
        el('span', { class: 'tg-pface' }, face),
        el('span', { class: 'tg-pbody' }, el('span', { class: 'tg-pname' }, p.name, info, augs), el('span', { class: 'mini-bar' }, hp), hpText));
      this.cards.append(row);
      this.prows.set(p.id, { row, hp, hpText, info, augs });
    }

    // 미니맵 (왼쪽 아래)
    this.miniWrap = el('div', { class: 'tg-mini' },
      this.topdown.canvas,
      el('span', { class: 'tg-mini-tag' }, t('tagger.minimap')));

    // 화면 전환 (오른쪽 아래): ◀ 3D 탑뷰 / 플레이어 이름 ▶
    this.viewSwitch = el('div', { class: 'view-switch' }, arrow(-1), this.viewLabel, arrow(1));
    this.placeHint = el('div', { class: 'place-hint', hidden: true }, t('tagger.placeHint'));

    this.stage = el('div', { class: 'tg-stage' },
      this.cam.root,
      this.cards,
      this.miniWrap,
      this.viewSwitch,
      this.placeHint);

    const left = el('section', { class: 'tg-left' },
      el('header', { class: 'tg-head' },
        el('span', { class: 'tg-badge' }, t('tagger.badge')),
        this.timer,
        this.session.solo ? el('span', { class: 'tg-tab' }, t('game.soloHint')) : null,
        el('span', { class: 'tg-hint' }, t('tagger.hint'))),
      this.stage);

    // ── 오른쪽: DIRECTOR ─────────────────────────────────────
    this.bossBtn = el('button', { class: 'toggle', onclick: () => this.toggle('boss') }, t('tagger.boss'));
    this.allInBtn = el('button', { class: 'toggle', onclick: () => this.toggle('allIn') }, t('tagger.allIn'));
    const dirHead = el('header', { class: 'tg-dir' },
      el('span', { class: 'tg-dir-badge' }, t('tagger.director')),
      el('div', { class: 'tg-dir-toggles' }, this.bossBtn, this.allInBtn));

    // PENCIL INK 게이지 + %
    this.inkFill = el('i');
    this.inkPct = el('span', { class: 'ink-pct' }, '100%');
    this.inkCard = el('div', { class: 'ink-card' },
      el('span', { class: 'ink-ic' }, '✎'),
      el('div', { class: 'ink-main' },
        el('span', { class: 'ink-title' }, t('tagger.inkTitle')),
        el('div', { class: 'ink-gauge' }, this.inkFill)),
      this.inkPct,
      (this.myAugs = el('span', { class: 'tg-myaugs' }))); // 내 보급 증강

    // 공책 도화지 + 세로 색 팔레트
    this.spiral = el('div', { class: 'pad-spiral' });
    for (let i = 0; i < 12; i++) this.spiral.append(el('i'));
    this.padWrap = el('div', { class: 'tg-padwrap' }, this.spiral, this.pad.canvas);

    this.colorBtns = this.palette.slice(1).map((p) =>
      el('button', { class: 'pal', title: t('color.' + p.key), style: { '--c': p.hex }, onclick: () => this.pad.setRgb(parseInt(p.hex.slice(1), 16)) }));
    this.pickerBtn = el('button', { class: 'tool pal-tool', title: t('tagger.customColor'), onclick: () => this.togglePicker() }, '🎨');
    this.eraserBtn = el('button', { class: 'tool pal-tool', title: t('tagger.eraser'), onclick: () => this.pad.setEraser(!this.pad.eraser) }, '⌫');
    this.trashBtn = el('button', { class: 'tool pal-tool', title: t('tagger.clear'), onclick: () => this.pad.clear() }, '🗑');
    this.paletteCol = el('div', { class: 'tg-palette' }, ...this.colorBtns, el('div', { class: 'pal-sep' }), this.pickerBtn, this.eraserBtn, this.trashBtn);

    this.pickerPop = el('div', { class: 'tg-pickerpop', hidden: true }, this.picker.root);
    this.desk = el('div', { class: 'tg-desk' }, this.padWrap, this.paletteCol, this.pickerPop);

    // 속성 (색과 분리 — C안)
    this.attrKeys = [null, ...this.palette.filter(Boolean).map((p) => p.key)];
    this.attrBtns = this.attrKeys.map((k, i) =>
      el('button', { class: 'attr-btn', title: `${k ? t('attr.' + k) : t('attr.none')} (${i})`, onclick: () => this.setAttr(k) },
        k ? icon('icon.' + k, this.attributes[k].icon) : el('span', { class: 'attr-none' }, '—'),
        el('span', { class: 'attr-name' }, k ? t('attr.' + k) : t('attr.none'))),
    );
    this.attrRow = el('div', { class: 'attr-row' }, el('span', { class: 'attr-label' }, t('tagger.attrTitle')), ...this.attrBtns);

    // 도구 (굵기 · 되돌리기)
    this.brushBtns = BRUSHES.map((b) => el('button', { class: 'tool brush', title: t('brush.' + b.key), onclick: () => this.pad.setWidth(b.w) }, el('i', { style: { width: `${b.w / 2.4}px`, height: `${b.w / 2.4}px` } })));
    this.undoBtn = el('button', { class: 'tool', title: t('tagger.undo'), onclick: () => this.pad.undo() }, '↶');
    this.cpSwatch = el('span', { class: 'cp-swatch' });
    this.cpHex = el('span', { class: 'cp-hex' });
    this.toolRow = el('div', { class: 'tg-toolrow' }, ...this.brushBtns, this.undoBtn, el('span', { class: 'grow' }), this.cpSwatch, this.cpHex);

    this.previewEl = el('div', { class: 'tg-preview' });
    this.slots = el('div', { class: 'tg-slots' });
    this.spawnBtn = el('button', { class: 'spawn-btn', onclick: () => (this.placing ? this.cancelPlace() : this.beginPlace(this.pad.getStrokes(), true)) }, 'SPAWN');

    const right = el('section', { class: 'tg-right' },
      dirHead,
      this.inkCard,
      this.desk,
      this.attrRow,
      this.toolRow,
      this.previewEl,
      el('div', { class: 'tg-slots-wrap' }, el('span', { class: 'slots-label' }, t('tagger.recall')), this.slots),
      this.spawnBtn);

    this.root.append(left, right);
    this.renderSlots();
    this.setView(0);
  }

  // 왼쪽 화면 전환. 오른쪽 도화지는 그대로라 그리던 그림은 계속 그릴 수 있다.
  setView(i) {
    const n = this.leftViews.length;
    this.viewIdx = ((i % n) + n) % n;
    const v = this.leftViews[this.viewIdx];
    const isTop = v === 'top';
    this.cam.setMode(isTop ? 'top' : v);
    this.viewLabel.textContent = isTop ? t('tagger.topView') : t('tagger.camView', { name: this.session.nameOf(v) });
    this.viewSwitch.classList.toggle('following', !isTop);
    for (const [id, r] of this.prows) r.row.classList.toggle('watching', id === v);
  }

  setActive(on) {
    this.active = on;
    this.root.hidden = !on;
  }

  onKey(e) {
    if (!this.active || e.target instanceof HTMLInputElement) return;
    if (e.code.startsWith('Digit')) {
      // 0 = 기본, 1~5 = 속성 고르기
      const n = Number(e.code.slice(5));
      if (n >= 0 && n < this.attrKeys.length) this.setAttr(this.attrKeys[n]);
    }
    if (e.code === 'Escape') this.cancelPlace();
    if (e.code === 'KeyE') this.pad.setEraser(!this.pad.eraser);
    if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) this.pad.undo();
    if (e.code === 'Enter') this.beginPlace(this.pad.getStrokes(), true);
    if (e.code === 'ArrowLeft') this.setView(this.viewIdx - 1);
    if (e.code === 'ArrowRight') this.setView(this.viewIdx + 1);
  }

  togglePicker() {
    this.pickerPop.hidden = !this.pickerPop.hidden;
    this.refreshTools();
  }

  setAttr(k) {
    this.attr = k;
    this.refreshTools();
    this.refreshPreview();
  }

  toggle(k) {
    this[k] = !this[k];
    if (k === 'allIn' && this.allIn) this.boss = true;
    if (k === 'boss' && !this.boss) this.allIn = false;
    this.refreshTools();
    this.refreshPreview();
  }

  refreshTools() {
    const hex = '#' + this.pad.rgb.toString(16).padStart(6, '0');
    this.cpSwatch.style.background = hex;
    this.cpHex.textContent = hex.toUpperCase();
    this.pickerBtn.classList.toggle('on', !this.pickerPop.hidden);
    this.pickerPop.classList.toggle('dim', this.pad.eraser);
    this.attrBtns.forEach((b, i) => b.classList.toggle('on', this.attrKeys[i] === this.attr));
    this.brushBtns.forEach((b, i) => b.classList.toggle('on', this.pad.width === BRUSHES[i].w));
    this.eraserBtn.classList.toggle('on', this.pad.eraser);
    this.bossBtn.classList.toggle('on', this.boss);
    this.allInBtn.classList.toggle('on', this.allIn);
    this.colorBtns.forEach((b) => b.classList.toggle('on', b.style.getPropertyValue('--c').toLowerCase() === hex.toLowerCase()));
  }

  judgeOpts() {
    const s = this.session.latest;
    return {
      boss: this.boss,
      allIn: this.allIn,
      attr: this.attr,
      ink: s ? s.ink : 0,
      frenzy: !!s?.open,
      inkProfile: { bossHp: this.bossHpMult() },
      bossReadyIn: s ? s.bossIn : 0,
    };
  }

  bossHpMult() {
    const prof = this.session.solo ? this.b.ink.solo : this.b.ink.byPlayers[Math.min(4, this.session.playerCount)];
    return prof.bossHp;
  }

  schedulePreview() {
    clearTimeout(this._pv);
    this._pv = setTimeout(() => this.refreshPreview(), 40);
  }

  refreshPreview() {
    const strokes = this.pad.getStrokes();
    const r = this.judge.judge(strokes, this.judgeOpts());
    this.preview = r;
    const parts = [];
    if (r.attrs?.length) {
      for (const a of r.attrs) {
        const A = this.attributes[a.key];
        parts.push(el('span', { class: 'chip', style: { '--c': A.aura } }, icon('icon.' + a.key, A.icon), ` ${t('attr.' + a.key)}${a.w < 1 ? ' 50%' : ''}`));
      }
    }
    if (r.traits?.fly) parts.push(el('span', { class: 'chip' }, icon('icon.fly', '🪽'), ' ' + t('trait.fly')));
    if (r.traits?.dash) parts.push(el('span', { class: 'chip' }, icon('icon.dash', '💨'), ' ' + t('trait.dash')));
    if (r.stats?.ranged) parts.push(el('span', { class: 'chip' }, icon('icon.ranged', '🎯'), ' ' + t('trait.ranged', { m: r.stats.ranged })));
    const info = [];
    if (r.stats) info.push(t('tagger.stats', { hp: r.stats.hp, h: r.stats.height, s: r.stats.speed }));
    if (strokes.length) info.push(t('tagger.inkCost', { n: r.cost }));
    let reason = r.ok ? null : tr(r.reason);
    this.previewEl.replaceChildren(
      el('div', { class: 'chips' }, parts.length ? parts : el('span', { class: 'muted' }, t('tagger.previewEmpty'))),
      el('div', { class: 'pv-info' }, info.join(' · ')),
      reason ? el('div', { class: 'pv-reason' }, reason) : el('div', { class: 'pv-ok' }, t('tagger.ready', { kind: t('kind.' + (r.kind || 'normal')) })),
    );
    this.spawnBtn.disabled = !this.placing && (!r.ok || this.waiting);
  }

  onSnap() {
    const s = this.session.latest;
    this.timer.textContent = s.open ? t('tagger.doorOpen') : fmtTime(s.left);
    this.timer.classList.toggle('warn', s.left <= 60 || s.open);
    // PENCIL INK 게이지 (%) — 문이 열리면 무제한
    const pct = s.open ? 100 : Math.max(0, Math.min(100, (s.ink / Math.max(1, s.inkMax)) * 100));
    this.inkFill.style.width = `${pct}%`;
    this.inkFill.classList.toggle('low', pct < 25);
    this.inkPct.textContent = s.open ? '∞' : `${Math.floor(pct)}%`;
    this.inkCard.classList.toggle('frenzy', s.open);
    this.bossBtn.title = s.bossIn > 0 ? t('tagger.bossWait', { n: Math.ceil(s.bossIn) }) : '';
    for (const [id, r] of this.prows) {
      const p = s._p.get(id);
      if (!p) continue;
      const ratio = Math.max(0, Math.min(1, p.hp / Math.max(1, p.maxHp)));
      r.hp.style.width = `${ratio * 100}%`;
      r.hp.classList.toggle('low', ratio < 0.35);
      r.hpText.textContent = `${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`;
      r.row.classList.toggle('dead', p.st !== PSTATE.ALIVE);
      r.info.textContent = p.st === PSTATE.DEAD ? t('tagger.dead') : p.st === PSTATE.ESCAPED ? t('tagger.escaped') : p.st === PSTATE.OUT ? t('tagger.out') : '';
    }
    const now = performance.now();
    if (!this._lastPv || now - this._lastPv > 250) {
      this._lastPv = now;
      this.refreshPreview();
    }
  }

  // 소환 순서: 그림 → SPAWN(또는 재소환 칸) → 화면 클릭. Esc·우클릭 = 취소.
  beginPlace(strokes, fromPad) {
    if (this.waiting || !strokes.length) return;
    const r = this.judge.judge(strokes, this.judgeOpts());
    if (!r.ok) return toast(tr(r.reason), 'warn');
    this.placing = { strokes, fromPad };
    this.showPlacing(true);
  }

  cancelPlace() {
    if (!this.placing) return;
    this.placing = null;
    this.showPlacing(false);
  }

  showPlacing(on) {
    this.stage.classList.toggle('placing', on);
    this.placeHint.hidden = !on;
    this.spawnBtn.classList.toggle('placing', on);
    this.spawnBtn.textContent = on ? t('tagger.placingBtn') : 'SPAWN';
    this.refreshPreview();
  }

  validSpot(w) {
    return validSpawnSpot({ session: this.session, balance: this.b, map: this.session.map, p: w });
  }

  onPick(w) {
    this.cam.target = w;
    if (!this.placing) return;
    if (!this.validSpot(w)) return toast(t('tagger.badSpot'), 'warn');
    const { strokes, fromPad } = this.placing;
    this.placing = null;
    this.showPlacing(false);
    this.waiting = true;
    this.lastSent = { strokes, fromPad };
    this.session.send({ t: MSG.SPAWN, strokes, x: w.x, z: w.z, boss: this.boss, allIn: this.allIn, attr: this.attr });
    this.refreshPreview();
  }

  onSpawnResult(r) {
    this.waiting = false;
    if (!r.ok) {
      toast(r.reason ? tr(r.reason) : t('spawn.failed'), 'warn');
      this.refreshPreview();
      return;
    }
    this.banner.show(t('tagger.spawnSoon', { icons: r.reason }), { kind: 'info', ms: 1800 });
    const sent = this.lastSent;
    if (sent?.fromPad) {
      this.pushRecall(sent.strokes);
      this.pad.clear();
    }
    if (this.allIn) this.allIn = false;
    if (this.boss) this.boss = false;
    this.refreshTools();
    this.refreshPreview();
  }

  pushRecall(strokes) {
    const key = JSON.stringify(strokes);
    this.recall = this.recall.filter((r) => r.key !== key);
    this.recall.unshift({ key, strokes, thumb: buildCutout(strokes, this.palette, { outline: 8 }).canvas });
    this.recall = this.recall.slice(0, RECALL_SLOTS);
    this.renderSlots();
  }

  renderSlots() {
    const nodes = [];
    for (let i = 0; i < RECALL_SLOTS; i++) {
      const r = this.recall[i];
      if (!r) {
        nodes.push(el('div', { class: 'slot empty' }, t('tagger.emptySlot')));
        continue;
      }
      const res = this.judge.judge(r.strokes, { ...this.judgeOpts(), boss: false, allIn: false });
      const thumb = r.thumb;
      thumb.className = 'slot-thumb';
      nodes.push(
        el('button', { class: 'slot', title: t('tagger.slotTitle'), onclick: () => this.beginPlace(r.strokes, false) }, thumb, el('span', { class: 'slot-cost' }, `${res.icons || ''} · ${t('tagger.inkCost', { n: res.cost })}`)),
      );
    }
    this.slots.replaceChildren(...nodes);
  }

  update(dt, time) {
    if (!this.active) return;
    const spot = this.cam.target;
    this.cam.hoverValid = spot ? this.validSpot(spot) : false;
    this.cam.render(dt, time, spot, this.cam.hoverValid);
    // 미니맵은 14fps 면 충분하다
    this._miniAcc = (this._miniAcc || 0) + dt;
    if (this._miniAcc >= 1 / MINI_FPS) {
      this._miniAcc = 0;
      this.topdown.render(time);
    }
  }

  dispose() {
    this._off.forEach((f) => f());
    window.removeEventListener('keydown', this._key);
    this.topdown.dispose();
    this.cam.dispose();
    this.root.remove();
  }
}
