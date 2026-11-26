import { el, fmtTime, Banner, toast } from '../ui/dom.js';
import { MSG, EV, PSTATE } from '../../shared/protocol.js';
import { DrawingPad, BRUSHES } from './DrawingPad.js';
import { TopDownMap } from './TopDownMap.js';
import { CornerCam } from './CornerCam.js';
import { buildCutout } from '../render/PaperCutout.js';
import { faceCanvas } from '../render/AnimalModels.js';

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

    this.pad = new DrawingPad({ palette });
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
    this.topdown.on('pick', () => this.refreshPreview());
    this.cam.on('pick', (w) => {
      this.topdown.target = w;
      this.refreshPreview();
    });
    this._off = [
      session.on('spawnResult', (r) => this.onSpawnResult(r)),
      session.on('snap', () => this.onSnap()),
      session.on(EV.BOSS, () => this.sfx.play('siren')),
      session.on(EV.DOOR_OPEN, () => this.banner.show('최후 발악! 잉크 무제한 (올인 불가)', { kind: 'boss', ms: 3500 })),
      session.on(EV.ONE_MIN, () => this.banner.show('1분 남음', { kind: 'warn' })),
      session.on(EV.PDEATH, (e) => this.banner.show(`${session.nameOf(e.id)} 쓰러뜨림!`, { kind: 'good', ms: 1800 })),
      session.on(EV.PESCAPE, (e) => this.banner.show(`${session.nameOf(e.id)} 탈출…`, { kind: 'warn' })),
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
    const arrow = (dir, text) => el('button', { class: `view-arrow ${dir < 0 ? 'left' : 'right'}`, title: dir < 0 ? '이전 화면 (←)' : '다음 화면 (→)', onclick: () => this.setView(this.viewIdx + dir) }, text);
    const left = el(
      'section',
      { class: 'tg-left' },
      el('header', { class: 'tg-head' }, el('span', { class: 'tg-badge' }, '👁 술래'), this.timer, el('span', { class: 'tg-hint' }, '바닥을 클릭해 소환 위치를 고르세요 · ◀ ▶ 화면 전환')),
      el('div', { class: 'tg-mapwrap' }, this.topdown.canvas, this.cam.root, this.viewLabel, arrow(-1, '◀'), arrow(1, '▶')),
      this.plist,
    );

    // 오른쪽
    this.inkBar = el('div', { class: 'ink-pencils' });
    this.inkText = el('span', { class: 'ink-text' });
    this.colors = this.palette.map((p, i) =>
      p ? el('button', { class: 'swatch', style: { background: p.hex }, title: `${p.name} (${i})`, onclick: () => this.pad.setColor(i) }) : null,
    );
    this.brushBtns = BRUSHES.map((b) => el('button', { class: 'tool brush', title: b.name, onclick: () => this.pad.setWidth(b.w) }, el('i', { style: { width: `${b.w / 2.4}px`, height: `${b.w / 2.4}px` } })));
    this.eraserBtn = el('button', { class: 'tool', title: '지우개 (E)', onclick: () => this.pad.setEraser(!this.pad.eraser) }, '⌫');
    const tools = el(
      'div',
      { class: 'tg-tools' },
      ...this.colors.filter(Boolean),
      el('div', { class: 'sep' }),
      ...this.brushBtns,
      this.eraserBtn,
      el('button', { class: 'tool', title: '되돌리기 (Ctrl+Z)', onclick: () => this.pad.undo() }, '↶'),
      el('button', { class: 'tool', title: '전체 지우기', onclick: () => this.pad.clear() }, '🗑'),
    );
    this.previewEl = el('div', { class: 'tg-preview' });
    this.bossBtn = el('button', { class: 'toggle', onclick: () => this.toggle('boss') }, '보스 (잉크 2배)');
    this.allInBtn = el('button', { class: 'toggle', onclick: () => this.toggle('allIn') }, '올인 → 초대형');
    this.slots = el('div', { class: 'tg-slots' });
    this.spawnBtn = el('button', { class: 'spawn-btn', onclick: () => this.spawn(this.pad.getStrokes(), true) }, 'SPAWN');
    const right = el(
      'section',
      { class: 'tg-right' },
      el('header', { class: 'tg-ink' }, el('span', { class: 'ink-label' }, '✏ 잉크'), this.inkBar, this.inkText),
      el('div', { class: 'tg-padrow' }, el('div', { class: 'tg-padwrap' }, this.pad.canvas), tools),
      this.previewEl,
      el('div', { class: 'tg-actions' }, this.bossBtn, this.allInBtn, el('div', { class: 'grow' }), this.spawnBtn),
      el('div', { class: 'tg-slots-wrap' }, el('span', { class: 'slots-label' }, '재소환'), this.slots),
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
    const label = isMap ? '🗺 탑뷰 지도' : `🎥 ${this.session.nameOf(v)} 근처 · 방 구석 카메라`;
    this.viewLabel.textContent = `${label}  (${this.viewIdx + 1}/${n})`;
  }

  setActive(on) {
    this.active = on;
    this.root.hidden = !on;
  }

  onKey(e) {
    if (!this.active || e.target instanceof HTMLInputElement) return;
    if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5));
      if (n >= 1 && n < this.palette.length) this.pad.setColor(n);
    }
    if (e.code === 'KeyE') this.pad.setEraser(!this.pad.eraser);
    if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) this.pad.undo();
    if (e.code === 'Enter') this.spawn(this.pad.getStrokes(), true);
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
    this.colors.forEach((b, i) => b && b.classList.toggle('on', !this.pad.eraser && this.pad.color === i));
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
        parts.push(el('span', { class: 'chip', style: { '--c': A.aura } }, `${A.icon} ${A.name}${a.w < 1 ? ' 50%' : ''}`));
      }
    }
    if (r.traits?.fly) parts.push(el('span', { class: 'chip' }, '🪽 비행'));
    if (r.traits?.dash) parts.push(el('span', { class: 'chip' }, '💨 돌진'));
    if (r.stats?.ranged) parts.push(el('span', { class: 'chip' }, `🎯 원거리 ${r.stats.ranged}m`));
    const info = [];
    if (r.stats) info.push(`HP ${r.stats.hp}`, `키 ${r.stats.height}m`, `속도 ${r.stats.speed}`);
    if (strokes.length) info.push(`잉크 ${r.cost}`);
    const spotOk = this.topdown.target && this.topdown.validSpot(this.topdown.target);
    let reason = r.ok ? (spotOk ? null : this.topdown.target ? '플레이어와 너무 가깝거나 벽이에요' : '지도에서 소환 위치를 고르세요') : r.reason;
    this.previewEl.replaceChildren(
      el('div', { class: 'chips' }, parts.length ? parts : el('span', { class: 'muted' }, '그리면 판정이 여기 떠요')),
      el('div', { class: 'pv-info' }, info.join(' · ')),
      reason ? el('div', { class: 'pv-reason' }, reason) : el('div', { class: 'pv-ok' }, `${r.kind === 'giant' ? '초대형' : r.kind === 'boss' ? '보스' : '일반'} 소환 준비 완료`),
    );
    this.spawnBtn.disabled = !r.ok || !spotOk || this.waiting;
  }

  onSnap() {
    const s = this.session.latest;
    this.timer.textContent = s.open ? '문 열림!' : fmtTime(s.left);
    this.timer.classList.toggle('warn', s.left <= 60 || s.open);
    // 잉크 = 연필 자루
    const per = 100;
    const n = Math.ceil(s.inkMax / per);
    if (this.inkBar.childElementCount !== n) this.inkBar.replaceChildren(...Array.from({ length: n }, () => el('div', { class: 'pencil' }, el('i'))));
    [...this.inkBar.children].forEach((c, i) => {
      const v = Math.max(0, Math.min(per, s.ink - i * per));
      c.firstChild.style.width = `${v}%`;
    });
    this.inkText.textContent = s.open ? '∞' : `${Math.floor(s.ink)} / ${s.inkMax}`;
    this.bossBtn.title = s.bossIn > 0 ? `보스 대기 ${Math.ceil(s.bossIn)}초` : '';
    for (const [id, r] of this.prows) {
      const p = s._p.get(id);
      if (!p) continue;
      r.hp.style.width = `${(p.hp / p.maxHp) * 100}%`;
      r.row.classList.toggle('dead', p.st !== PSTATE.ALIVE);
      r.info.textContent = p.st === PSTATE.DEAD ? ' 사망' : p.st === PSTATE.ESCAPED ? ' 탈출' : p.st === PSTATE.OUT ? ' 나감' : '';
    }
    const now = performance.now();
    if (!this._lastPv || now - this._lastPv > 250) {
      this._lastPv = now;
      this.refreshPreview();
    }
  }

  spawn(strokes, fromPad) {
    if (this.waiting) return;
    const t = this.topdown.target;
    if (!t) return toast('지도에서 소환 위치를 먼저 고르세요', 'warn');
    if (!strokes.length) return;
    this.waiting = true;
    this.lastSent = { strokes, fromPad };
    this.session.send({ t: MSG.SPAWN, strokes, x: t.x, z: t.z, boss: this.boss, allIn: this.allIn });
    this.refreshPreview();
  }

  onSpawnResult(r) {
    this.waiting = false;
    if (!r.ok) {
      toast(r.reason || '소환 실패', 'warn');
      this.refreshPreview();
      return;
    }
    this.banner.show(`${r.reason} · 3초 후 소환`, { kind: 'info', ms: 1800 });
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
        nodes.push(el('div', { class: 'slot empty' }, '빈 칸'));
        continue;
      }
      const res = this.judge.judge(r.strokes, { ...this.judgeOpts(), boss: false, allIn: false });
      const thumb = r.thumb;
      thumb.className = 'slot-thumb';
      nodes.push(
        el('button', { class: 'slot', title: '같은 그림 다시 소환 (지도에서 위치 먼저)', onclick: () => this.spawn(r.strokes, false) }, thumb, el('span', { class: 'slot-cost' }, `${res.icons || ''} · 잉크 ${res.cost}`)),
      );
    }
    this.slots.replaceChildren(...nodes);
  }

  update(dt, time) {
    if (!this.active) return;
    if (this.leftViews[this.viewIdx] === 'map') this.topdown.render(time);
    else {
      const t = this.topdown.target;
      this.cam.render(dt, time, t, t && this.topdown.validSpot(t));
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
