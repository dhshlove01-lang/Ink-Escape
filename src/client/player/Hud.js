import { el, fmtTime } from '../ui/dom.js';
import { faceCanvas } from '../render/AnimalModels.js';
import { PSTATE, STATUS_BIT } from '../../shared/protocol.js';

// 플레이어 HUD: 타이머, 보스 HP, 팀원, 내 HP·상태이상·하트, 탄약·지우개, 조준점, 부활 게이지, 안내.

export class Hud {
  constructor(parent, session, attributes) {
    this.session = session;
    this.attributes = attributes;
    this.root = el('div', { class: 'hud' });
    parent.append(this.root);

    this.timer = el('div', { class: 'hud-timer' }, '10:00');
    this.timerSub = el('div', { class: 'hud-timer-sub' });
    this.bossName = el('div', { class: 'hud-boss-label' });
    this.bossFill = el('div', { class: 'hud-boss-fill' });
    this.boss = el('div', { class: 'hud-boss', hidden: true }, this.bossName, el('div', { class: 'hud-boss-bar' }, this.bossFill));
    this.root.append(el('div', { class: 'hud-top' }, this.timer, this.timerSub, this.boss));

    this.team = el('div', { class: 'hud-team' });
    this.teamRows = new Map();
    for (const p of session.roster.players) {
      if (p.id === session.me) continue;
      const face = faceCanvas(p.animal, 44);
      const faceDead = faceCanvas(p.animal, 44, { dead: true });
      const hp = el('div', { class: 'mini-fill' });
      const info = el('div', { class: 'team-info' });
      const row = el('div', { class: 'team-row' }, el('div', { class: 'team-face' }, face, faceDead), el('div', { class: 'team-body' }, el('div', { class: 'team-name' }, p.name), el('div', { class: 'mini-bar' }, hp), info));
      faceDead.hidden = true;
      this.team.append(row);
      this.teamRows.set(p.id, { row, hp, info, face, faceDead });
    }
    this.root.append(this.team);

    this.hpFill = el('div', { class: 'hp-fill' });
    this.hpText = el('div', { class: 'hp-text' });
    this.hearts = el('div', { class: 'hearts' });
    this.status = el('div', { class: 'status-icons' });
    this.root.append(el('div', { class: 'hud-bl' }, this.status, this.hearts, el('div', { class: 'hp-row' }, el('span', { class: 'hp-label' }, 'HP'), this.hpText), el('div', { class: 'hp-bar' }, this.hpFill)));

    this.ammo = el('div', { class: 'ammo' });
    this.gren = el('div', { class: 'gren' });
    this.root.append(el('div', { class: 'hud-br' }, this.ammo, this.gren));

    this.cross = el('div', { class: 'crosshair' }, el('i'), el('i'), el('i'), el('i'));
    this.hitmark = el('div', { class: 'hitmark' });
    this.ring = el('div', { class: 'revive-ring', hidden: true });
    this.prompt = el('div', { class: 'prompt', hidden: true });
    this.center = el('div', { class: 'center-msg', hidden: true });
    this.root.append(this.cross, this.hitmark, this.ring, this.prompt, this.center);
    this.dmg = el('div', { class: 'dmg-flash' });
    this.red = el('div', { class: 'red-tint' });
    this.root.append(this.dmg, this.red);
    this.lastHp = null;
  }

  update({ weapon, me, prompt, center, revive, boss }) {
    const s = this.session.latest;
    if (s) {
      if (s.open) {
        this.timer.textContent = '탈출!';
        this.timer.classList.add('open');
        this.timerSub.textContent = '열린 문으로 나가세요 · 술래 폭주 중';
      } else {
        this.timer.textContent = fmtTime(s.left);
        this.timer.classList.toggle('warn', s.left <= 60);
        this.timerSub.textContent = this.session.doorRevealed >= 0 ? '빛기둥이 탈출 문' : '';
      }
      for (const [id, r] of this.teamRows) {
        const p = s._p.get(id);
        if (!p) continue;
        r.hp.style.width = `${(p.hp / p.maxHp) * 100}%`;
        const dead = p.st === PSTATE.DEAD;
        r.face.hidden = dead;
        r.faceDead.hidden = !dead;
        r.row.classList.toggle('dead', dead || p.st === PSTATE.OUT);
        let info = '';
        if (p.st === PSTATE.DEAD) info = p.revIn > 0 ? `부활 가능까지 ${Math.ceil(p.revIn)}초` : p.revIn === 0 ? '부활 가능!' : '사망';
        else if (p.st === PSTATE.ESCAPED) info = '탈출';
        else if (p.st === PSTATE.OUT) info = '나감';
        else if (p.bits & STATUS_BIT.AFK) info = '술래 화면 보는 중';
        r.info.textContent = info;
      }
    }
    if (me) {
      this.hpFill.style.width = `${(me.hp / me.maxHp) * 100}%`;
      this.hpText.textContent = `${me.hp} / ${me.maxHp}`;
      if (this.lastHp !== null && me.hp <= this.lastHp - 3) this.flashDamage();
      if (this.lastHp === null || me.hp > this.lastHp || me.hp <= this.lastHp - 3) this.lastHp = me.hp;
      const icons = [];
      if (me.bits & STATUS_BIT.BURN) icons.push('🔥 화상');
      if (me.bits & STATUS_BIT.SLOW) icons.push('❄ 느려짐');
      if (me.bits & STATUS_BIT.POISON) icons.push('☠ 독');
      if (me.bits & STATUS_BIT.INVULN) icons.push('✨ 무적');
      this.status.textContent = icons.join('  ');
      this.hearts.textContent = this.session.playerCount === 1 ? '❤'.repeat(Math.max(0, me.lives)) + '🖤'.repeat(Math.max(0, 2 - me.lives)) : '';
      this.gren.textContent = `지우개 ${me.gren} (G)`;
    }
    if (weapon) {
      this.ammo.innerHTML = weapon.reloading ? '<b>재장전…</b>' : `<b>${weapon.ammo}</b> / ∞`;
    }
    this.prompt.hidden = !prompt;
    if (prompt) this.prompt.textContent = prompt;
    this.center.hidden = !center;
    if (center) this.center.textContent = center;
    this.ring.hidden = !revive;
    if (revive) this.ring.style.setProperty('--p', `${Math.round(revive * 100)}%`);
    this.boss.hidden = !boss;
    if (boss) {
      this.bossName.textContent = `${boss.kind === 'giant' ? '초대형' : '보스'} ${boss.attrs.map((a) => this.attributes[a.key].icon).join('')}`;
      this.bossFill.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
    }
  }

  flashDamage() {
    this.dmg.classList.remove('on');
    void this.dmg.offsetWidth;
    this.dmg.classList.add('on');
  }

  hit(kill) {
    this.hitmark.className = 'hitmark on' + (kill ? ' kill' : '');
    clearTimeout(this._hm);
    this._hm = setTimeout(() => (this.hitmark.className = 'hitmark'), 120);
  }

  redAlert(ms = 2000) {
    this.red.classList.add('on');
    clearTimeout(this._red);
    this._red = setTimeout(() => this.red.classList.remove('on'), ms);
  }

  dispose() {
    this.root.remove();
  }
}
