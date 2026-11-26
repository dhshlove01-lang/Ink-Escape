import { el } from './dom.js';
import { url } from '../render/Images.js';
import { faceCanvas } from '../render/AnimalModels.js';
import { CharacterStage } from './CharacterStage.js';
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

const ROLE_LABEL = { [ROLE.TAGGER]: '👁 술래', [ROLE.PLAYER]: '🔫 플레이어', [ROLE.RANDOM]: '🎲 랜덤', [ROLE.NONE]: '—' };

const fmtDur = (sec) => `${Math.floor(sec / 60)}분 ${String(Math.floor(sec % 60)).padStart(2, '0')}초`;
const fmtNum = (n) => Math.round(n).toLocaleString('ko-KR');

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
    const faces = el('div', { class: 'title-faces' }, ...ANIMALS.map((a) => faceCanvas(a, 64)));
    this.root = el(
      'div',
      { class: 'screen title-screen' },
      el(
        'div',
        { class: 'title-card' },
        faces,
        url('ui.logo') ? el('h1', { class: 'logo' }, el('img', { src: url('ui.logo'), alt: 'INK ESCAPE' })) : el('h1', {}, 'INK ESCAPE'),
        el('p', { class: 'title-sub' }, '술래가 그린 그림이 3D 전장의 몬스터가 된다 · 비대칭 드로잉 FPS 프로토타입'),
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

// 로비: 3D 대기실(폴가이즈 스타일) + 캐릭터 선택 + READY.
// DOM 은 처음에 한 번만 만들고, 상태가 올 때마다 값만 갱신한다 (3D 화면을 다시 만들지 않기 위해).
export class LobbyView {
  constructor(parent, { conn, me, code, solo, onLeave }) {
    this.conn = conn;
    this.me = me;
    this.code = code;
    this.solo = solo;
    this.onLeave = onLeave;
    this.state = null;

    const copy = el('button', { class: 'btn small', onclick: async (e) => {
      try {
        await navigator.clipboard.writeText(this.code);
        e.target.textContent = '복사됨';
      } catch {
        e.target.textContent = this.code;
      }
    } }, '복사');

    this.readyCount = el('span', { class: 'lobby-ready-count' }, '');
    this.head = el('header', { class: 'lobby-head' },
      this.solo ? el('h2', {}, '혼자 테스트') : el('div', { class: 'room-code' }, el('span', {}, '방 코드'), el('b', {}, this.code), copy),
      el('div', { class: 'lobby-head-right' }, this.readyCount, el('button', { class: 'btn ghost small', onclick: () => this.onLeave() }, '나가기')),
    );

    this.stageMount = el('div', { class: 'lobby-stage' });
    this.stageHint = el('div', { class: 'stage-hint' }, '');
    this.memberList = el('div', { class: 'members' });
    this.animalGrid = el('div', { class: 'animal-btns' });
    this.roleRow = el('div', { class: 'role-btns' });
    this.timeRow = el('div', { class: 'role-btns' });
    this.actionRow = el('div', { class: 'lobby-actions' });
    this.note = el('p', { class: 'muted lobby-note' });

    this.root = el('div', { class: 'screen lobby-screen' },
      el('div', { class: 'lobby-card' },
        this.head,
        el('div', { class: 'lobby-main' },
          el('div', { class: 'lobby-stage-wrap' }, this.stageMount, this.stageHint),
          el('aside', { class: 'lobby-side' },
            el('h3', {}, '참가자'), this.memberList,
            el('h3', {}, '캐릭터'), this.animalGrid,
            el('h3', {}, '역할 (먼저 누른 사람 우선)'), this.roleRow,
            el('h3', {}, '경기 시간'), this.timeRow,
            this.actionRow,
            this.note,
          ),
        ),
      ),
    );
    parent.append(this.root);
    this.stage = new CharacterStage(this.stageMount, { mode: 'lobby' });
    this.stageHint.textContent = this.solo ? '혼자 테스트 — 술래와 플레이어를 오갑니다' : '캐릭터를 고르고 READY 를 누르세요';
  }

  render(state) {
    this.state = state;
    const me = state.members.find((m) => m.id === this.me);
    const owner = state.ownerId === this.me;
    const send = (msg) => this.conn.send(msg);
    const taggerTaken = state.members.some((m) => m.role === ROLE.TAGGER && m.id !== this.me);

    // 참가자 (이름 · 역할 · READY · 핑)
    this.memberList.replaceChildren(...state.members.map((m) =>
      el('div', { class: 'member' + (m.id === this.me ? ' me' : '') + (m.ready ? ' ready' : '') },
        faceCanvas(m.animal, 40),
        el('div', { class: 'm-body' },
          el('b', {}, m.name, m.id === state.ownerId ? ' 👑' : ''),
          el('span', { class: 'm-role' }, ROLE_LABEL[m.role] || m.role)),
        m.ready ? el('span', { class: 'm-ready' }, 'READY') : null,
        el('span', { class: 'm-ping' }, m.id === state.ownerId ? '방장' : `${m.ping || 0}ms`),
      ),
    ));

    // 캐릭터 5종
    this.animalGrid.replaceChildren(...ANIMALS.map((a) => {
      const taken = state.members.some((m) => m.animal === a && m.id !== this.me);
      return el('button', {
        class: 'animal' + (me?.animal === a ? ' on' : ''),
        title: ANIMAL_NAMES[a],
        disabled: taken,
        onclick: () => send({ t: MSG.PICK_ANIMAL, animal: a }),
      }, faceCanvas(a, 48), el('span', {}, ANIMAL_NAMES[a]));
    }));

    // 역할
    this.roleRow.replaceChildren(
      ...(this.solo
        ? [el('p', { class: 'muted' }, '혼자 테스트는 술래와 플레이어를 함께 맡습니다.')]
        : [
            el('button', { class: 'btn' + (me?.role === ROLE.TAGGER ? ' on' : ''), disabled: taggerTaken, onclick: () => send({ t: MSG.PICK_ROLE, role: ROLE.TAGGER }) }, '👁 술래'),
            el('button', { class: 'btn' + (me?.role === ROLE.PLAYER ? ' on' : ''), onclick: () => send({ t: MSG.PICK_ROLE, role: ROLE.PLAYER }) }, '🔫 플레이어'),
            el('button', { class: 'btn' + (me?.role === ROLE.RANDOM ? ' on' : ''), onclick: () => send({ t: MSG.PICK_ROLE, role: ROLE.RANDOM }) }, '🎲 랜덤'),
          ]),
    );

    // 경기 시간
    this.timeRow.replaceChildren(...[[180, '3분'], [300, '5분'], [600, '10분 (기본)']].map(([sec, label]) =>
      el('button', { class: 'btn small' + (state.settings.matchSeconds === sec ? ' on' : ''), disabled: !owner, onclick: () => send({ t: MSG.SETTINGS, matchSeconds: sec }) }, label)));

    // READY / 시작
    const others = state.members.filter((m) => m.id !== state.ownerId);
    const readyN = others.filter((m) => m.ready).length;
    this.readyCount.textContent = this.solo || !others.length ? '' : `${readyN}/${others.length} READY`;
    this.readyCount.classList.toggle('all', !!others.length && readyN === others.length);

    if (this.solo) {
      this.actionRow.replaceChildren(el('button', { class: 'btn primary big', onclick: () => send({ t: MSG.START }) }, '게임 시작'));
      this.note.textContent = '경기 중 Tab 으로 술래 화면 ↔ 플레이어 화면을 오갑니다.';
    } else if (owner) {
      const allReady = !!others.length && readyN === others.length;
      this.actionRow.replaceChildren(
        el('button', { class: 'btn primary big' + (allReady ? ' glow' : ''), onclick: () => send({ t: MSG.START }) }, allReady ? '게임 시작' : '게임 시작 (대기 중)'),
      );
      this.note.textContent = allReady ? '모두 READY! 바로 시작할 수 있어요.' : '다른 참가자가 READY 를 누르길 기다리는 중… (지금 눌러도 시작됩니다)';
    } else {
      this.actionRow.replaceChildren(
        el('button', { class: 'btn big ready-btn' + (me?.ready ? ' on' : ''), onclick: () => send({ t: MSG.READY, ready: !me?.ready }) }, me?.ready ? 'READY ✓' : 'READY'),
      );
      this.note.textContent = me?.ready ? '방장이 시작하길 기다리는 중…' : 'READY 를 누르면 대기실 캐릭터 머리 위에 표시됩니다.';
    }

    // 3D 대기실: 지금 로비에 있는 사람들이 각자 단상 위에 선다
    this.stage.setCharacters(
      state.members.map((m) => ({ id: m.id, kind: m.animal, name: m.name, ready: m.ready, role: m.role })),
      { me: this.me, ownerId: state.ownerId, solo: this.solo },
    );
    this.stageHint.textContent = this.solo
      ? '혼자 테스트 — 술래와 플레이어를 오갑니다'
      : `${state.members.length}명 대기 중 · 캐릭터를 고르고 READY 를 누르세요`;
  }

  // 경기 중에는 3D 를 멈추고 DOM 만 떼어 둔다 (결과 화면 뒤로 숨김)
  dispose() {
    this.pause();
    this.root.remove();
  }

  pause() {
    this.stage?.pause();
  }

  resume() {
    this.stage?.play();
    this.stage?.resize();
  }

  // 로비를 아주 버릴 때 (WebGL 자원까지 정리)
  destroy() {
    this.stage?.dispose();
    this.stage = null;
    this.root.remove();
  }
}

// 결과: 가운데 단상의 3D 캐릭터 + 왼쪽 플레이 요약 뱃지 + 오른쪽 점수 정산.
export class ResultView {
  constructor(parent, { result, me, onBack, disconnected = false }) {
    const youTagger = result.tagger.id === me;
    const draw = !result.winner;
    const won = !draw && (result.winner === 'tagger') === youTagger;
    const mine = youTagger ? result.tagger : result.players.find((p) => p.id === me) || result.players[0];
    const myAnimal = mine?.animal || 'shiba';
    const badge = draw ? { text: 'DRAW', color: '#ffb340' } : won ? { text: 'WIN', color: '#5ee39a' } : { text: 'LOSE', color: '#ff4a5e' };

    this.stageMount = el('div', { class: 'result-stage' });

    const badges = (result.badges || []).map((b) => el('div', { class: 'badge' },
      faceCanvas(b.animal, 34),
      el('div', { class: 'badge-body' }, el('b', {}, b.label), el('span', {}, b.playerName)),
      el('em', {}, b.value),
    ));

    const score = mine?.score;
    const scoreCard = el('div', { class: 'score-card' },
      ...(score?.items || []).map((it) => el('div', { class: 'score-row' },
        el('span', { class: 's-label' }, it.label),
        el('span', { class: 's-detail' }, it.detail),
        el('b', { class: 's-points' }, fmtNum(it.points)),
      )),
      el('div', { class: 'score-total' }, el('span', {}, '총점'), el('b', {}, fmtNum(score?.total || 0))),
    );

    const entries = [
      ...result.players.map((p) => ({ id: p.id, name: p.name, animal: p.animal, total: p.score?.total || 0, tagger: false })),
      { id: result.tagger.id, name: result.tagger.name, animal: result.tagger.animal || 'devil', total: result.tagger.score?.total || 0, tagger: true },
    ].sort((a, b) => b.total - a.total);

    const ranking = el('div', { class: 'rank-list' }, ...entries.map((e, i) =>
      el('div', { class: 'rank-row' + (e.id === me ? ' me' : '') },
        el('span', { class: 'rank-no' }, String(i + 1)),
        faceCanvas(e.animal, 28),
        el('span', { class: 'rank-name' }, e.name, e.tagger ? ' 👁' : ''),
        el('b', { class: 'rank-total' }, fmtNum(e.total)),
      )));

    this.root = el('div', { class: 'screen result-screen ' + (draw ? 'draw' : won ? 'win' : 'lose') },
      this.stageMount,
      el('div', { class: 'result-overlay' },
        el('div', { class: 'result-top' },
          el('div', { class: 'result-who' }, draw ? '경기 중단' : result.winner === 'tagger' ? '술래 승리' : '플레이어 승리'),
          el('h2', {}, draw ? '무승부' : won ? '이겼다!' : '졌다…'),
          el('p', { class: 'result-reason' }, result.reason, ' · ', fmtDur(result.time)),
        ),
        el('section', { class: 'result-panel result-left' },
          el('h3', {}, '플레이 요약'),
          badges.length ? el('div', { class: 'badges' }, ...badges) : el('p', { class: 'muted' }, '이번 판에는 뱃지가 없어요.'),
        ),
        el('section', { class: 'result-panel result-right' },
          el('h3', {}, youTagger ? '술래 정산' : '내 점수', el('span', { class: 'who' }, mine?.name || '')),
          scoreCard,
          el('h3', {}, '전체 점수'),
          ranking,
        ),
        el('div', { class: 'result-bottom' },
          el('button', { class: 'btn primary big', onclick: onBack }, disconnected ? '시작 화면으로' : '로비로 돌아가기'),
        ),
      ),
    );
    parent.append(this.root);

    this.stage = new CharacterStage(this.stageMount, { mode: 'result' });
    this.stage.setCharacters(
      [{ id: me || 'me', kind: myAnimal, name: mine?.name || '나', role: youTagger ? ROLE.TAGGER : ROLE.PLAYER, badge }],
      { me: me || 'me' },
    );
  }

  dispose() {
    this.stage?.dispose();
    this.root.remove();
  }
}
