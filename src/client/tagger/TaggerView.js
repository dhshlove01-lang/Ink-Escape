import { el, fmtTime, Banner, toast, icon } from '../ui/dom.js';
import { MSG, EV, PSTATE } from '../../shared/protocol.js';
import { DrawingPad, BRUSHES } from './DrawingPad.js';
import { TopDownMap } from './TopDownMap.js';
import { CornerCam } from './CornerCam.js';
import { ColorPicker } from './ColorPicker.js';
import { nearestPaletteIndex } from '../../shared/attributes.js';
import { buildCutout } from '../render/PaperCutout.js';
import { faceCanvas } from '../render/AnimalModels.js';
import { t, tr } from '../i18n.js';

// 술래 화면 (2분할): 왼쪽 탑뷰 관전·소환 위치, 오른쪽 도화지·팔레트·잉크·미리보기·재소환·SPAWN.

const RECALL_SLOTS = 3;

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
    this.placing = null; // SPAWN 을 누른 뒤 지도 클릭을 기다리는 그림
    this.topdown = new TopDownMap({ session, palette, balance });
    this.cam = new CornerCam({ session, palette, attributes, balance });
    // 왼쪽 화면 목록: 탑뷰 지도 + 플레이어별 3D 구석 카메라 (◀ ▶ 로 넘김)
    this.leftViews = ['map', ...session.roster.players.map((p) => p.id)];
    this.viewIdx = 0;
    this.root = el('div', { class: 'view tagger-view' });
    parent.append(this.root);
    this.build();
    this.banner = new Banner(this.root);

    this.pad.on('change', () => this.schedulePreview());
    this.pad.on('tool', () => this.refreshTools());
    this.picker.on('change', (rgb) => this.pad.setRgb(rgb));
    this.topdown.on('pick', (w) => this.onPick(w));
    this.cam.on('pick', (w) => this.onPick(w));
    for (const c of [this.topdown.canvas, this.cam.root]) {
      c.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.cancelPlace();
      });
    }
    this._off = [
      session.on('spawnResult', (r) => this.onSpawnResult(r)),
      session.on('snap', () => this.onSnap()),
      session.on(EV.BOSS, () => this.sfx.play('siren')),
      session.on(EV.DOOR_OPEN, () => this.banner.show(t('tagger.frenzy'), { kind: 'boss', ms: 3500 })),
      session.on(EV.ONE_MIN, () => this.banner.show(t('game.oneMin'), { kind: 'warn' })),
      session.on(EV.PDEATH, (e) => this.banner.show(t('tagger.downed', { name: session.nameOf(e.id) }), { kind: 'good', ms: 1800 })),
      session.on(EV.PESCAPE, (e) => this.banner.show(t('tagger.escapedBanner', { name: session.nameOf(e.id) }), { kind: 'warn' })),
    ];
    this._key = (e) => this.onKey(e);
    window.addEventListener('keydown', this._key);
    this.refreshTools();
    this.refreshPreview();
  }

  build() {
    const S = this.session;
    // 왼쪽
    this.timer = el('div', { class: 'tg-timer' }, '10:00');
    this.plist = el('div', { class: 'tg-players' });
    this.prows = new Map();
    for (const p of S.roster.players) {
      const hp = el('div', { class: 'mini-fill' });
      const info = el('span', { class: 'tg-pinfo' });
      const face = faceCanvas(p.animal, 36);
      const row = el('div', { class: 'tg-prow' }, face, el('div', { class: 'tg-pbody' }, el('div', {}, el('b', {}, p.name), info), el('div', { class: 'mini-bar' }, hp)));
      this.plist.append(row);
      this.prows.set(p.id, { row, hp, info });
    }
    this.viewLabel = el('div', { class: 'view-label' });
    const arrow = (dir, text) => el('button', { class: `view-arrow ${dir < 0 ? 'left' : 'right'}`, title: dir < 0 ? t('tagger.prevView') : t('tagger.nextView'), onclick: () => this.setView(this.viewIdx + dir) }, text);
    const left = el(
      'section',
      { class: 'tg-left' },
      el('header', { class: 'tg-head' }, el('span', { class: 'tg-badge' }, t('tagger.badge')), this.timer, el('span', { class: 'tg-hint' }, t('tagger.hint'))),
      (this.mapwrap = el('div', { class: 'tg-mapwrap' }, this.topdown.canvas, this.cam.root, this.viewLabel, arrow(-1, '◀'), arrow(1, '▶'), (this.placeHint = el('div', { class: 'place-hint', hidden: true }, t('tagger.placeHint'))))),
      this.plist,
    );

    // 오른쪽
    this.inkBar = el('div', { class: 'ink-pencils' });
    this.inkText = el('span', { class: 'ink-text' });
    // 고른 색 + 그 색이 될 속성 (가장 가까운 기본 색)
    this.cpSwatch = el('span', { class: 'cp-swatch' });
    this.cpAttr = el('span', { class: 'cp-attr' });
    this.brushBtns = BRUSHES.map((b) => el('button', { class: 'tool brush', title: t('brush.' + b.key), onclick: () => this.pad.setWidth(b.w) }, el('i', { style: { width: `${b.w / 2.4}px`, height: `${b.w / 2.4}px` } })));
    this.eraserBtn = el('button', { class: 'tool', title: t('tagger.eraser'), onclick: () => this.pad.setEraser(!this.pad.eraser) }, '⌫');
    const tools = el(
      'div',
      { class: 'tg-side' },
      this.picker.root,
      el('div', { class: 'cp-info' }, this.cpSwatch, this.cpAttr),
      el('div', { class: 'tg-tools' },
      ...this.brushBtns,
      this.eraserBtn,
      el('button', { class: 'tool', title: t('tagger.undo'), onclick: () => this.pad.undo() }, '↶'),
      el('button', { class: 'tool', title: t('tagger.clear'), onclick: () => this.pad.clear() }, '🗑'),
      ),
    );
    this.previewEl = el('div', { class: 'tg-preview' });
    this.bossBtn = el('button', { class: 'toggle', onclick: () => this.toggle('boss') }, t('tagger.boss'));
    this.allInBtn = el('button', { class: 'toggle', onclick: () => this.toggle('allIn') }, t('tagger.allIn'));
    this.slots = el('div', { class: 'tg-slots' });
    this.spawnBtn = el('button', { class: 'spawn-btn', onclick: () => (this.placing ? this.cancelPlace() : this.beginPlace(this.pad.getStrokes(), true)) }, 'SPAWN');
    const right = el(
      'section',
      { class: 'tg-right' },
      el('header', { class: 'tg-ink' }, el('span', { class: 'ink-label' }, t('tagger.ink')), this.inkBar, this.inkText),
      el('div', { class: 'tg-padrow' }, el('div', { class: 'tg-padwrap' }, this.pad.canvas), tools),
      this.previewEl,
      el('div', { class: 'tg-actions' }, this.bossBtn, this.allInBtn, el('div', { class: 'grow' }), this.spawnBtn),
      el('div', { class: 'tg-slots-wrap' }, el('span', { class: 'slots-label' }, t('tagger.recall')), this.slots),
    );
    this.root.append(left, right);
    this.renderSlots();
    this.setView(0);
  }

  // 왼쪽 화면 전환. 오른쪽 도화지는 그대로라 그리던 그림은 계속 그릴 수 있다.
  setView(i) {
    const n = this.leftViews.length;
    this.viewIdx = ((i % n) + n) % n;
    const v = this.leftViews[this.viewIdx];
    const isMap = v === 'map';
    this.topdown.canvas.hidden = !isMap;
    this.cam.root.hidden = isMap;
    if (!isMap) this.cam.setFollow(v);
    const label = isMap ? t('tagger.mapView') : t('tagger.camView', { name: this.session.nameOf(v) });
    this.viewLabel.textContent = `${label}  (${this.viewIdx + 1}/${n})`;
  }

  setActive(on) {
    this.active = on;
    this.root.hidden = !on;
  }

  onKey(e) {
    if (!this.active || e.target instanceof HTMLInputElement) return;
    if (e.code.startsWith('Digit')) {
      // 1~5: 기본 색 바로 고르기
      const n = Number(e.code.slice(5));
      if (n >= 1 && n < this.palette.length) this.picker.set(parseInt(this.palette[n].hex.slice(1), 16));
    }
    if (e.code === 'Escape') this.cancelPlace();
    if (e.code === 'KeyE') this.pad.setEraser(!this.pad.eraser);
    if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) this.pad.undo();
    if (e.code === 'Enter') this.beginPlace(this.pad.getStrokes(), true);
    if (e.code === 'ArrowLeft') this.setView(this.viewIdx - 1);
    if (e.code === 'ArrowRight') this.setView(this.viewIdx + 1);
  }

  toggle(k) {
    this[k] = !this[k];
    if (k === 'allIn' && this.allIn) this.boss = true;
    if (k === 'boss' && !this.boss) this.allIn = false;
    this.refreshTools();
    this.refreshPreview();
  }

  refreshTools() {
    const ai = nearestPaletteIndex(this.pad.rgb);
    const key = this.palette[ai].key;
    this.cpSwatch.style.background = '#' + this.pad.rgb.toString(16).padStart(6, '0');
    this.cpAttr.replaceChildren(t('picker.attr'), ' → ', icon('icon.' + key, this.attributes[key].icon), ' ' + t('attr.' + key));
    this.picker.root.classList.toggle('dim', this.pad.eraser);
    this.brushBtns.forEach((b, i) => b.classList.toggle('on', this.pad.width === BRUSHES[i].w));
    this.eraserBtn.classList.toggle('on', this.pad.eraser);
    this.bossBtn.classList.toggle('on', this.boss);
    this.allInBtn.classList.toggle('on', this.allIn);
  }

  judgeOpts() {
    const s = this.session.latest;
    return {
      boss: this.boss,
      allIn: this.allIn,
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
    // 잉크 = 연필 자루
    const per = 100;
    const n = Math.ceil(s.inkMax / per);
    if (this.inkBar.childElementCount !== n) this.inkBar.replaceChildren(...Array.from({ length: n }, () => el('div', { class: 'pencil' }, el('i'))));
    [...this.inkBar.children].forEach((c, i) => {
      const v = Math.max(0, Math.min(per, s.ink - i * per));
      c.firstChild.style.clipPath = `inset(0 ${100 - v}% 0 0)`;
    });
    this.inkText.textContent = s.open ? '∞' : `${Math.floor(s.ink)} / ${s.inkMax}`;
    this.bossBtn.title = s.bossIn > 0 ? t('tagger.bossWait', { n: Math.ceil(s.bossIn) }) : '';
    for (const [id, r] of this.prows) {
      const p = s._p.get(id);
      if (!p) continue;
      r.hp.style.width = `${(p.hp / p.maxHp) * 100}%`;
      r.row.classList.toggle('dead', p.st !== PSTATE.ALIVE);
      r.info.textContent = p.st === PSTATE.DEAD ? t('tagger.dead') : p.st === PSTATE.ESCAPED ? t('tagger.escaped') : p.st === PSTATE.OUT ? t('tagger.out') : '';
    }
    const now = performance.now();
    if (!this._lastPv || now - this._lastPv > 250) {
      this._lastPv = now;
      this.refreshPreview();
    }
  }

  // 소환 순서: 그림 → SPAWN(또는 재소환 칸) → 지도 클릭. Esc·우클릭 = 취소.
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
    this.mapwrap.classList.toggle('placing', on);
    this.placeHint.hidden = !on;
    this.spawnBtn.classList.toggle('placing', on);
    this.spawnBtn.textContent = on ? t('tagger.placingBtn') : 'SPAWN';
    this.refreshPreview();
  }

  onPick(w) {
    this.topdown.target = w;
    if (!this.placing) return;
    if (!this.topdown.validSpot(w)) return toast(t('tagger.badSpot'), 'warn');
    const { strokes, fromPad } = this.placing;
    this.placing = null;
    this.showPlacing(false);
    this.waiting = true;
    this.lastSent = { strokes, fromPad };
    this.session.send({ t: MSG.SPAWN, strokes, x: w.x, z: w.z, boss: this.boss, allIn: this.allIn });
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
    if (this.leftViews[this.viewIdx] === 'map') this.topdown.render(time);
    else {
      const spot = this.topdown.target;
      this.cam.render(dt, time, spot, spot && this.topdown.validSpot(spot));
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
