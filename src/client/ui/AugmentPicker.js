import { el } from './dom.js';
import { EV } from '../../shared/protocol.js';
import { AUG_INFO } from '../../config/augments.js';
import { url } from '../render/Images.js';
import { t } from '../i18n.js';

// 보급 증강: 이름·설명·아이콘 + 카드 고르기 창 + 가진 증강 줄.
// 그림(assets 의 'aug.<key>')이 오면 그것, 없으면 임시 이모지.

export const augName = (key) => t(`aug.${key}.name`);
export const augDesc = (key, b) => t(`aug.${key}.desc`, AUG_INFO[key]?.desc(b.aug[key]) || {});

export function augIcon(key, cls = 'aug-ico') {
  const u = url('aug.' + key);
  if (u) return el('img', { class: cls, src: u, alt: augName(key), draggable: 'false' });
  return el('span', { class: cls + ' emoji' }, AUG_INFO[key]?.icon || '❔');
}

/** 가진 증강 줄 (아이콘 + 개수). aug = { 키: 개수 } */
export function augChips(aug, b, { small = false } = {}) {
  const keys = Object.keys(aug || {}).filter((k) => aug[k] > 0);
  return keys.map((k) =>
    el('span', { class: 'aug-chip' + (small ? ' small' : ''), title: `${augName(k)} — ${augDesc(k, b)}` },
      augIcon(k),
      aug[k] > 1 ? el('b', { class: 'aug-n' }, t('supply.stack', { n: aug[k] })) : null,
    ),
  );
}

// 카드 3장 고르기 창. 플레이어 카드는 1·2·3 키(마우스가 잠겨 있어도), 술래 카드는 클릭.
// 시간이 지나면 방장이 무작위로 골라 주므로 창만 닫는다.
export class AugmentPicker {
  constructor({ parent, session, balance, sfx }) {
    this.session = session;
    this.b = balance;
    this.sfx = sfx;
    this.queue = [];
    this.cur = null;
    this.root = el('div', { class: 'aug-pick', hidden: true });
    parent.append(this.root);
    this._off = [
      session.on('offer', (o) => {
        this.queue.push({ ...o, until: performance.now() + o.sec * 1000 });
        if (!this.cur) this.next();
      }),
      // 방장이 대신 골랐으면(시간 초과) 닫기
      session.on(EV.AUG, (e) => {
        const c = this.cur;
        if (c && e.side === c.side && (c.side === 'tagger' || e.id === session.me) && c.cards.includes(e.key) && !c.done) this.close();
      }),
    ];
    this._key = (e) => {
      const c = this.cur;
      if (!c || c.done || e.repeat || c.side !== 'player') return;
      const i = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code) % 3;
      if (i < 0 || !c.cards[i]) return;
      // 술래 화면을 보는 중(혼자 테스트)에는 숫자 키가 속성 고르기라 마우스가 잠긴 1인칭일 때만
      if (this.session.role === 'both' && !document.pointerLockElement) return;
      e.preventDefault();
      this.pick(c.cards[i]);
    };
    window.addEventListener('keydown', this._key);
    this._timer = setInterval(() => this.tick(), 100);
  }

  next() {
    this.cur = this.queue.shift() || null;
    if (!this.cur) {
      this.root.hidden = true;
      return;
    }
    const c = this.cur;
    const keys = c.side === 'player';
    this.fill = el('i');
    this.timeText = el('span', { class: 'aug-time' });
    this.root.className = 'aug-pick ' + c.side;
    this.root.replaceChildren(
      el('div', { class: 'aug-head' },
        el('b', {}, t(keys ? 'supply.title' : 'supply.titleTagger')),
        el('span', { class: 'aug-hint' }, t(keys ? 'supply.keys' : 'supply.click')),
        this.timeText,
      ),
      el('div', { class: 'aug-cards' },
        ...c.cards.map((k, i) =>
          el('button', { class: 'aug-card', onclick: () => this.pick(k) },
            keys ? el('span', { class: 'aug-key' }, String(i + 1)) : null,
            augIcon(k, 'aug-ico big'),
            el('b', { class: 'aug-name' }, augName(k)),
            el('span', { class: 'aug-desc' }, augDesc(k, this.b)),
          ),
        ),
      ),
      el('div', { class: 'aug-bar' }, this.fill),
    );
    this.root.hidden = false;
    this.sfx?.play?.('pickup');
    this.tick();
  }

  pick(key) {
    const c = this.cur;
    if (!c || c.done) return;
    c.done = true;
    this.session.pickAugment(c.side, key);
    const i = c.cards.indexOf(key);
    this.root.querySelectorAll('.aug-card').forEach((b, j) => b.classList.add(j === i ? 'chosen' : 'faded'));
    setTimeout(() => this.close(), 450);
  }

  close() {
    if (this.cur) this.cur.done = true;
    this.root.hidden = true;
    this.cur = null;
    setTimeout(() => !this.cur && this.next(), 150);
  }

  tick() {
    const c = this.cur;
    if (!c || this.root.hidden) return;
    const left = Math.max(0, (c.until - performance.now()) / 1000);
    this.fill.style.width = `${(left / (this.b.supply.pickSec || 10)) * 100}%`;
    this.timeText.textContent = t('supply.auto', { n: Math.ceil(left) });
    if (left <= 0 && !c.done) setTimeout(() => this.cur === c && this.close(), 1500); // 방장 응답이 늦어도 닫힘
  }

  dispose() {
    this._off.forEach((f) => f());
    window.removeEventListener('keydown', this._key);
    clearInterval(this._timer);
    this.root.remove();
  }
}
