import { el } from './dom.js';
import { faceCanvas } from '../render/AnimalModels.js';
import { ANIMALS, ANIMAL_NAMES, ROLE, MSG } from '../../shared/protocol.js';

// 시작 화면 · 로비 · 결과 화면. 화면은 그리기와 버튼만 맡고, 실제 동작은 콜백으로 받는다.

const NAME_KEY = 'adfps.name';
const loadName = () => {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
};
const saveName = (n) => {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {}
};

export class TitleView {
  constructor(parent, { onCreate, onJoin, onSolo }) {
    const name = el('input', { id: 'name', maxlength: 12, placeholder: '닉네임', value: loadName() });
    const code = el('input', { id: 'code', maxlength: 5, placeholder: '방 코드', style: { textTransform: 'uppercase' } });
    this.status = el('div', { class: 'title-status' });
    const getName = () => {
      const n = name.value.trim() || '이름없음';
      saveName(n);
      return n;
    };
    const busy = (b) => this.root.querySelectorAll('button').forEach((x) => (x.disabled = b));
    const run = async (fn) => {
      busy(true);
      this.status.textContent = '연결 중…';
      try {
        await fn();
      } catch (e) {
        this.status.textContent = e.message || String(e);
        busy(false);
      }
    };
    const faces = el('div', { class: 'title-faces' }, ...ANIMALS.map((a) => faceCanvas(a, 72)));
    this.root = el(
      'div',
      { class: 'screen title-screen' },
      el(
        'div',
        { class: 'title-card' },
        faces,
        el('h1', {}, '비대칭 드로잉 FPS'),
        el('p', { class: 'title-sub' }, '술래가 그린 그림이 3D 전장의 몬스터가 된다 · 프로토타입 v0.1'),
        el('label', { class: 'field' }, el('span', {}, '닉네임'), name),
        el('div', { class: 'title-actions' },
          el('button', { class: 'btn primary', onclick: () => run(() => onCreate(getName())) }, '방 만들기'),
          el('div', { class: 'join' }, code, el('button', { class: 'btn', onclick: () => run(() => onJoin(code.value.trim().toUpperCase(), getName())) }, '참가')),
          el('button', { class: 'btn ghost', onclick: () => run(() => onSolo(getName())) }, '혼자 테스트 (술래+플레이어)'),
        ),
        this.status,
        el('details', { class: 'howto' },
          el('summary', {}, '조작법'),
          el('ul', {},
            el('li', {}, '플레이어: WASD 이동 · Shift 달리기 · Space 점프 · 클릭 사격 · R 재장전 · G 지우개 수류탄 · E 길게 부활'),
            el('li', {}, '술래: 바닥 클릭 = 소환 위치 · ◀ ▶(← →) 탑뷰 ↔ 3D 구석 카메라 · 1~5 색 · E 지우개 · Ctrl+Z 되돌리기 · Enter 소환'),
            el('li', {}, '혼자 테스트: Tab 으로 술래 화면 ↔ 플레이어 화면'),
          ),
        ),
      ),
    );
    parent.append(this.root);
    code.addEventListener('keydown', (e) => e.key === 'Enter' && run(() => onJoin(code.value.trim().toUpperCase(), getName())));
  }

  dispose() {
    this.root.remove();
  }
}

export class LobbyView {
  constructor(parent, { conn, me, code, solo, onLeave }) {
    this.conn = conn;
    this.me = me;
    this.root = el('div', { class: 'screen lobby-screen' });
    parent.append(this.root);
    this.code = code;
    this.solo = solo;
    this.onLeave = onLeave;
    this.state = null;
  }

  render(state) {
    this.state = state;
    const me = state.members.find((m) => m.id === this.me);
    const owner = state.ownerId === this.me;
    const send = (msg) => this.conn.send(msg);
    const roleName = { [ROLE.TAGGER]: '👁 술래', [ROLE.PLAYER]: '🔫 플레이어', [ROLE.RANDOM]: '🎲 랜덤', [ROLE.NONE]: '—' };
    const taggerTaken = state.members.some((m) => m.role === ROLE.TAGGER && m.id !== this.me);

    const copy = el('button', { class: 'btn small', onclick: async (e) => {
      try {
        await navigator.clipboard.writeText(this.code);
        e.target.textContent = '복사됨';
      } catch {
        e.target.textContent = this.code;
      }
    } }, '복사');

    const rows = state.members.map((m) =>
      el('div', { class: 'member' + (m.id === this.me ? ' me' : '') },
        faceCanvas(m.animal, 44),
        el('div', { class: 'm-body' }, el('b', {}, m.name, m.id === state.ownerId ? ' 👑' : ''), el('span', { class: 'm-role' }, roleName[m.role] || m.role)),
        el('span', { class: 'm-ping' }, m.id === state.ownerId ? '방장' : `${m.ping || 0}ms`),
      ),
    );

    this.root.replaceChildren(
      el('div', { class: 'lobby-card' },
        el('header', { class: 'lobby-head' },
          this.solo ? el('h2', {}, '혼자 테스트') : el('div', { class: 'room-code' }, el('span', {}, '방 코드'), el('b', {}, this.code), copy),
          el('button', { class: 'btn ghost small', onclick: () => this.onLeave() }, '나가기'),
        ),
        el('div', { class: 'lobby-grid' },
          el('section', {}, el('h3', {}, `참가자 ${state.members.length}/5`), el('div', { class: 'members' }, rows),
            this.solo ? null : el('p', { class: 'muted' }, '친구에게 방 코드를 알려주세요. 계산은 방장(방 만든 사람) PC가 맡습니다.')),
          el('section', {},
            this.solo ? el('p', { class: 'muted' }, '술래와 플레이어를 혼자 오가며 시험합니다. 경기 중 Tab 으로 화면 전환.') : el('div', {},
              el('h3', {}, '역할 (먼저 누른 사람 우선)'),
              el('div', { class: 'role-btns' },
                el('button', { class: 'btn' + (me?.role === ROLE.TAGGER ? ' on' : ''), disabled: taggerTaken, onclick: () => send({ t: MSG.PICK_ROLE, role: ROLE.TAGGER }) }, '👁 술래'),
                el('button', { class: 'btn' + (me?.role === ROLE.PLAYER ? ' on' : ''), onclick: () => send({ t: MSG.PICK_ROLE, role: ROLE.PLAYER }) }, '🔫 플레이어'),
                el('button', { class: 'btn' + (me?.role === ROLE.RANDOM ? ' on' : ''), onclick: () => send({ t: MSG.PICK_ROLE, role: ROLE.RANDOM }) }, '🎲 랜덤'),
              )),
            el('h3', {}, '캐릭터'),
            el('div', { class: 'animal-btns' }, ...ANIMALS.map((a) => {
              const taken = state.members.some((m) => m.animal === a && m.id !== this.me);
              return el('button', { class: 'animal' + (me?.animal === a ? ' on' : ''), disabled: taken, onclick: () => send({ t: MSG.PICK_ANIMAL, animal: a }) }, faceCanvas(a, 56), el('span', {}, ANIMAL_NAMES[a]));
            })),
            el('h3', {}, '경기 시간'),
            el('div', { class: 'role-btns' }, ...[[180, '3분'], [300, '5분'], [600, '10분 (기본)']].map(([sec, label]) =>
              el('button', { class: 'btn small' + (state.settings.matchSeconds === sec ? ' on' : ''), disabled: !owner, onclick: () => send({ t: MSG.SETTINGS, matchSeconds: sec }) }, label))),
            owner
              ? el('button', { class: 'btn primary big', onclick: () => send({ t: MSG.START }) }, '게임 시작')
              : el('p', { class: 'muted' }, '방장이 시작하길 기다리는 중…'),
          ),
        ),
      ),
    );
  }

  dispose() {
    this.root.remove();
  }
}

export class ResultView {
  constructor(parent, { result, me, onBack }) {
    const youTagger = result.tagger.id === me;
    const draw = !result.winner;
    const won = !draw && (result.winner === 'tagger') === youTagger;
    const rows = result.players.map((p) =>
      el('tr', {}, el('td', {}, faceCanvas(p.animal, 32)), el('td', {}, p.name), el('td', {}, p.escaped ? '탈출' : ''), el('td', {}, p.kills), el('td', {}, p.deaths), el('td', {}, p.dmg)),
    );
    this.root = el('div', { class: 'screen result-screen' },
      el('div', { class: 'result-card ' + (draw ? '' : won ? 'win' : 'lose') },
        el('div', { class: 'result-who' }, draw ? '경기 중단' : result.winner === 'tagger' ? '술래 승리' : '플레이어 승리'),
        el('h2', {}, draw ? '무승부' : won ? '이겼다!' : '졌다…'),
        el('p', {}, result.reason, ` · ${Math.floor(result.time / 60)}분 ${Math.floor(result.time % 60)}초`),
        el('p', { class: 'muted' }, `술래 ${result.tagger.name}: 소환 ${result.tagger.spawned}회 · 보스 ${result.tagger.bosses}회`),
        el('div', { class: 'table-wrap' }, el('table', {}, el('thead', {}, el('tr', {}, el('th'), el('th', {}, '이름'), el('th'), el('th', {}, '처치'), el('th', {}, '사망'), el('th', {}, '피해'))), el('tbody', {}, rows))),
        el('button', { class: 'btn primary', onclick: onBack }, '로비로'),
      ),
    );
    parent.append(this.root);
  }

  dispose() {
    this.root.remove();
  }
}
