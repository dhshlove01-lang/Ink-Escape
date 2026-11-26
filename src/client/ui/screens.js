import { el, icon } from './dom.js';
import { url } from '../render/Images.js';
import { faceCanvas } from '../render/AnimalModels.js';
import { CharacterStage } from './CharacterStage.js';
import { ANIMALS, ROLE, MSG } from '../../shared/protocol.js';
import { t, tr, LANGS, getLang, setLang, onLangChange } from '../i18n.js';
import { gfx } from '../render/GraphicsSettings.js';

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

const roleLabel = (r) => ({ [ROLE.TAGGER]: t('role.tagger'), [ROLE.PLAYER]: t('role.player'), [ROLE.RANDOM]: t('role.random') })[r] || '—';

const fmtDur = (sec) => t('common.duration', { m: Math.floor(sec / 60), s: String(Math.floor(sec % 60)).padStart(2, '0') });
const fmtNum = (n) => Math.round(n).toLocaleString(getLang() === 'ko' ? 'ko-KR' : 'en-US');

// 언어 고르기 (한국어 | English)
export function langPicker() {
  const box = el('div', { class: 'lang-picker', role: 'group', 'aria-label': t('common.language') });
  const draw = () =>
    box.replaceChildren(
      ...LANGS.map((l) => el('button', { class: 'lang-btn' + (l.code === getLang() ? ' on' : ''), 'aria-pressed': l.code === getLang() ? 'true' : 'false', onclick: () => setLang(l.code) }, l.label)),
    );
  draw();
  box._off = onLangChange(draw);
  return box;
}

// 그래픽 품질 (낮음 | 보통 | 높음) — 팬 소리가 크면 낮음
export function gfxPicker() {
  const box = el('div', { class: 'lang-picker gfx-picker', role: 'group' });
  const draw = () => {
    box.title = t('gfx.hint');
    box.setAttribute('aria-label', t('gfx.label'));
    box.replaceChildren(
      el('span', { class: 'gfx-label' }, t('gfx.label')),
      ...gfx.levels.map((lv) => el('button', { class: 'lang-btn' + (lv === gfx.level ? ' on' : ''), 'aria-pressed': lv === gfx.level ? 'true' : 'false', onclick: () => gfx.set(lv) }, t('gfx.' + lv))),
    );
  };
  draw();
  const offA = onLangChange(draw), offB = gfx.onChange(draw);
  box._off = () => (offA(), offB());
  return box;
}

const SUB_COUNT = 5; // strings.js 의 title.sub1 ~ title.sub5

// 가운데 팝업 (배경 클릭·Esc 로 닫힘). hidden 으로 열고 닫는다.
function modalBox({ title, body, actions, onClose, wide = false }) {
  const back = el('div', { class: 'modal-back', hidden: true, onclick: (e) => e.target === back && onClose() },
    el('div', { class: 'modal-card' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      el('h2', { class: 'modal-title' }, title),
      ...body,
      actions,
    ),
  );
  back.addEventListener('keydown', (e) => e.key === 'Escape' && onClose());
  return back;
}

export class TitleView {
  constructor(parent, { onCreate, onJoin, onSolo }) {
    this.cb = { onCreate, onJoin, onSolo };
    this.root = el('div', { class: 'screen title-screen' });
    this.nameVal = loadName();
    this.codeVal = '';
    this.statusText = '';
    this.subNo = 1 + Math.floor(Math.random() * SUB_COUNT); // 소개 문구: 들어올 때마다 5개 중 하나 (언어를 바꿔도 같은 번호)
    parent.append(this.root);
    this.build();
    this._off = onLangChange(() => this.build());
  }

  build() {
    const { onCreate, onJoin, onSolo } = this.cb;
    const name = el('input', { id: 'name', class: 'title-input', maxlength: 12, placeholder: t('title.nickname'), 'aria-label': t('title.nickname'), value: this.nameVal });
    const code = el('input', { id: 'code', class: 'title-input code-input', maxlength: 5, placeholder: t('title.roomCode'), 'aria-label': t('title.roomCode'), value: this.codeVal, autocomplete: 'off', spellcheck: 'false' });
    name.addEventListener('input', () => (this.nameVal = name.value));
    code.addEventListener('input', () => (this.codeVal = code.value));
    this.status = el('div', { class: 'title-status' }, this.statusText);
    const getName = () => {
      const n = name.value.trim() || t('common.noName');
      saveName(n);
      return n;
    };
    const busy = (b) => this.root.querySelectorAll('button:not(.lang-btn)').forEach((x) => (x.disabled = b));
    const run = async (fn) => {
      busy(true);
      this.status.textContent = this.statusText = t('common.connecting');
      try {
        await fn();
      } catch (e) {
        this.status.textContent = this.statusText = tr(e.message || String(e));
        busy(false);
      }
    };
    // 참가하기 → 가운데 팝업에서 방 코드 입력
    this.joinStatus = el('div', { class: 'title-status' });
    const closeJoin = () => {
      modal.hidden = true;
      this.joinStatus.textContent = '';
    };
    const join = async () => {
      const btns = modal.querySelectorAll('button');
      btns.forEach((b) => (b.disabled = true));
      this.joinStatus.textContent = t('common.connecting');
      try {
        await onJoin(code.value.trim().toUpperCase(), getName());
      } catch (e) {
        this.joinStatus.textContent = tr(e.message || String(e));
        btns.forEach((b) => (b.disabled = false));
      }
    };
    code.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') join();
    });
    const modal = modalBox({
      title: t('title.joinTitle'),
      onClose: closeJoin,
      body: [code, this.joinStatus],
      actions: el('div', { class: 'modal-actions' },
        el('button', { class: 'btn ghost', onclick: closeJoin }, t('common.cancel')),
        el('button', { class: 'btn primary', onclick: join }, t('title.join')),
      ),
    });
    const openJoin = () => {
      modal.hidden = false;
      code.focus();
      code.select();
    };
    // 조작법 → 가운데 팝업 (역할별 칸, ' · ' 로 나눈 줄)
    const closeHelp = () => (help.hidden = true);
    const howtoBlock = (key) => {
      const text = t(key);
      const cut = text.indexOf(':');
      const head = cut > 0 ? text.slice(0, cut) : '';
      const rest = cut > 0 ? text.slice(cut + 1) : text;
      return el('section', { class: 'howto-sec' },
        head && el('h3', {}, head.trim()),
        el('ul', {}, ...rest.split('·').map((x) => el('li', {}, x.trim()))),
      );
    };
    const help = modalBox({
      title: t('title.howto'),
      wide: true,
      onClose: closeHelp,
      body: [howtoBlock('title.howtoPlayer'), howtoBlock('title.howtoTagger'), howtoBlock('title.howtoSolo')],
      actions: el('button', { class: 'btn primary', onclick: closeHelp }, t('common.ok')),
    });
    this.picker?._off?.();
    this.picker = langPicker();
    this.gfxPick?._off?.();
    this.gfxPick = gfxPicker();
    this.root.replaceChildren(
      el(
        'div',
        { class: 'title-card' },
        el('div', { class: 'title-top' }, this.gfxPick, this.picker),
        url('ui.logo') ? el('h1', { class: 'logo' }, el('img', { src: url('ui.logo'), alt: 'INK ESCAPE' })) : el('h1', {}, 'INK ESCAPE'),
        el('p', { class: 'title-sub' }, t('title.sub' + this.subNo)),
        el('div', { class: 'title-actions' },
          name,
          el('button', { class: 'btn primary', onclick: () => run(() => onCreate(getName())) }, t('title.create')),
          el('button', { class: 'btn primary', onclick: openJoin }, t('title.joinRoom')),
          el('button', { class: 'btn ghost', onclick: () => run(() => onSolo(getName())) }, t('title.solo')),
        ),
        this.status,
        el('button', { class: 'howto-btn', onclick: () => {
          help.hidden = false;
          help.querySelector('.btn')?.focus();
        } }, '🎮 ', t('title.howto')),
      ),
      modal,
      help,
    );
  }

  dispose() {
    this._off?.();
    this.picker?._off?.();
    this.gfxPick?._off?.();
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
        e.target.textContent = t('common.copied');
      } catch {
        e.target.textContent = this.code;
      }
    } }, t('common.copy'));
    this.copyBtn = copy;

    this.readyCount = el('span', { class: 'lobby-ready-count' }, '');
    this.head = el('header', { class: 'lobby-head' },
      this.solo ? (this.titleEl = el('h2', {}, t('lobby.solo'))) : el('div', { class: 'room-code' }, (this.codeLabel = el('span', {}, t('lobby.roomCode'))), el('b', {}, this.code), copy),
      el('div', { class: 'lobby-head-right' }, this.readyCount, (this.gfxPick = gfxPicker()), (this.picker = langPicker()), (this.leaveBtn = el('button', { class: 'btn ghost small', onclick: () => this.onLeave() }, t('common.leave')))),
    );

    this.stageMount = el('div', { class: 'lobby-stage' });
    this.stageHint = el('div', { class: 'stage-hint' }, '');
    this.memberList = el('div', { class: 'members' });
    this.animalGrid = el('div', { class: 'animal-btns' });
    this.roleRow = el('div', { class: 'role-btns role-3' });
    this.timeRow = el('div', { class: 'role-btns time-btns' });
    this.actionRow = el('div', { class: 'lobby-actions' });
    this.note = el('p', { class: 'muted lobby-note' });

    this.root = el('div', { class: 'screen lobby-screen' },
      el('div', { class: 'lobby-card' },
        this.head,
        el('div', { class: 'lobby-main' },
          el('div', { class: 'lobby-stage-wrap' }, this.stageMount, this.stageHint),
          el('aside', { class: 'lobby-side' },
            (this.h3Members = el('h3', {}, t('lobby.members'))), this.memberList,
            (this.h3Char = el('h3', {}, t('lobby.character'))), this.animalGrid,
            (this.h3Role = el('h3', {}, t('lobby.role'))), this.roleRow,
            (this.h3Time = el('h3', {}, t('lobby.time'))), this.timeRow,
            this.actionRow,
            this.note,
          ),
        ),
      ),
    );
    parent.append(this.root);
    this.stage = new CharacterStage(this.stageMount, { mode: 'lobby' });
    this.stageHint.textContent = this.solo ? t('lobby.stageSolo') : t('lobby.stageHint');
    // 언어가 바뀌면 고정 글씨 + 상태 다시 그리기
    this._off = onLangChange(() => {
      this.titleEl && (this.titleEl.textContent = t('lobby.solo'));
      this.codeLabel && (this.codeLabel.textContent = t('lobby.roomCode'));
      this.copyBtn.textContent = t('common.copy');
      this.leaveBtn.textContent = t('common.leave');
      this.h3Members.textContent = t('lobby.members');
      this.h3Char.textContent = t('lobby.character');
      this.h3Role.textContent = t('lobby.role');
      this.h3Time.textContent = t('lobby.time');
      if (this.state) this.render(this.state);
    });
  }

  render(state) {
    this.state = state;
    const me = state.members.find((m) => m.id === this.me);
    const owner = state.ownerId === this.me;
    const send = (msg) => this.conn.send(msg);
    const taggerTaken = state.members.some((m) => m.role === ROLE.TAGGER && m.id !== this.me);

    // 참가자: 한 줄에 [얼굴] 이름 👑 [역할] … READY · 방장/핑
    this.memberList.replaceChildren(...state.members.map((m) =>
      el('div', { class: 'member' + (m.id === this.me ? ' me' : '') + (m.ready ? ' ready' : '') },
        faceCanvas(m.animal, 34),
        el('div', { class: 'm-body' },
          el('b', { class: 'm-name' }, m.name),
          m.id === state.ownerId ? el('span', { class: 'm-crown', title: t('lobby.host') }, icon('kit.badge_crown', '👑')) : null,
          el('span', { class: 'm-role' }, this.solo ? t('role.both') : roleLabel(m.role))),
        m.ready ? el('span', { class: 'm-ready' }, icon('kit.badge_check', ''), 'READY') : null,
        el('span', { class: 'm-ping' }, m.id === state.ownerId ? t('lobby.host') : `${m.ping || 0}ms`),
      ),
    ));

    // 캐릭터 5종
    this.animalGrid.replaceChildren(...ANIMALS.map((a) => {
      const taken = state.members.some((m) => m.animal === a && m.id !== this.me);
      return el('button', {
        class: 'animal' + (me?.animal === a ? ' on' : ''),
        title: t('animal.' + a),
        disabled: taken,
        onclick: () => send({ t: MSG.PICK_ANIMAL, animal: a }),
      }, faceCanvas(a, 48), el('span', {}, t('animal.' + a)));
    }));

    // 역할
    this.roleRow.replaceChildren(
      ...(this.solo
        ? [el('p', { class: 'muted' }, t('lobby.soloRole'))]
        : [
            el('button', { class: 'btn' + (me?.role === ROLE.TAGGER ? ' on' : ''), disabled: taggerTaken, onclick: () => send({ t: MSG.PICK_ROLE, role: ROLE.TAGGER }) }, t('role.tagger')),
            el('button', { class: 'btn' + (me?.role === ROLE.PLAYER ? ' on' : ''), onclick: () => send({ t: MSG.PICK_ROLE, role: ROLE.PLAYER }) }, t('role.player')),
            el('button', { class: 'btn' + (me?.role === ROLE.RANDOM ? ' on' : ''), onclick: () => send({ t: MSG.PICK_ROLE, role: ROLE.RANDOM }) }, t('role.random')),
          ]),
    );

    // 경기 시간
    this.timeRow.replaceChildren(...[[180, t('lobby.min3')], [300, t('lobby.min5')], [600, t('lobby.min10')]].map(([sec, label]) =>
      el('button', { class: 'btn small' + (state.settings.matchSeconds === sec ? ' on' : ''), disabled: !owner, onclick: () => send({ t: MSG.SETTINGS, matchSeconds: sec }) }, label)));

    // READY / 시작
    const others = state.members.filter((m) => m.id !== state.ownerId);
    const readyN = others.filter((m) => m.ready).length;
    this.readyCount.textContent = this.solo || !others.length ? '' : t('lobby.readyCount', { n: readyN, total: others.length });
    this.readyCount.classList.toggle('all', !!others.length && readyN === others.length);

    if (this.solo) {
      this.actionRow.replaceChildren(el('button', { class: 'btn primary big', onclick: () => send({ t: MSG.START }) }, t('lobby.start')));
      this.note.textContent = t('lobby.soloNote');
    } else if (owner) {
      const allReady = !!others.length && readyN === others.length;
      this.actionRow.replaceChildren(
        el('button', { class: 'btn primary big' + (allReady ? ' glow' : ''), onclick: () => send({ t: MSG.START }) }, allReady ? t('lobby.start') : t('lobby.startWaiting')),
      );
      this.note.textContent = allReady ? t('lobby.allReady') : t('lobby.waitReady');
    } else {
      this.actionRow.replaceChildren(
        el('button', { class: 'btn big ready-btn' + (me?.ready ? ' on' : ''), onclick: () => send({ t: MSG.READY, ready: !me?.ready }) }, me?.ready ? 'READY ✓' : 'READY'),
      );
      this.note.textContent = me?.ready ? t('lobby.waitHost') : t('lobby.readyHint');
    }

    // 3D 대기실: 배경은 이번 판 맵의 테마, 로비에 있는 사람들이 각자 단상 위에 선다
    this.stage.setTheme(state.settings.mapId || 'dungeon');
    this.stage.setCharacters(
      state.members.map((m) => ({ id: m.id, kind: m.animal, name: m.name, ready: m.ready, role: m.role })),
      { me: this.me, ownerId: state.ownerId, solo: this.solo },
    );
    this.stageHint.textContent = this.solo
      ? t('lobby.stageSolo')
      : t('lobby.stageWaiting', { n: state.members.length });
  }

  // 경기 중에는 3D 를 멈추고 DOM 만 떼어 둔다 (결과 화면 뒤로 숨김)
  dispose() {
    this.pause();
    this.root.remove();
  }

  // 로비 화면을 완전히 버릴 때 언어 구독도 끊는다
  _unsub() {
    this._off?.();
    this.picker?._off?.();
    this.gfxPick?._off?.();
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
    this._unsub();
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
      el('div', { class: 'badge-body' }, el('b', {}, tr(b.label)), el('span', {}, b.playerName)),
      el('em', {}, tr(b.value)),
    ));

    const score = mine?.score;
    const scoreCard = el('div', { class: 'score-card' },
      ...(score?.items || []).map((it) => el('div', { class: 'score-row' },
        el('span', { class: 's-label' }, tr(it.label)),
        el('span', { class: 's-detail' }, tr(it.detail)),
        el('b', { class: 's-points' }, fmtNum(it.points)),
      )),
      el('div', { class: 'score-total' }, el('span', {}, t('result.total')), el('b', {}, fmtNum(score?.total || 0))),
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
          el('div', { class: 'result-who' }, draw ? t('result.stopped') : result.winner === 'tagger' ? t('result.taggerWin') : t('result.playersWin')),
          el('h2', {}, draw ? t('result.draw') : won ? t('result.won') : t('result.lost')),
          el('p', { class: 'result-reason' }, tr(result.reason), ' · ', fmtDur(result.time)),
        ),
        el('section', { class: 'result-panel result-left' },
          el('h3', {}, t('result.summary')),
          badges.length ? el('div', { class: 'badges' }, ...badges) : el('p', { class: 'muted' }, t('result.noBadges')),
        ),
        el('section', { class: 'result-panel result-right' },
          el('h3', {}, youTagger ? t('result.taggerScore') : t('result.myScore'), el('span', { class: 'who' }, mine?.name || '')),
          scoreCard,
          el('h3', {}, t('result.allScores')),
          ranking,
        ),
        el('div', { class: 'result-bottom' },
          el('button', { class: 'btn primary big', onclick: onBack }, disconnected ? t('result.toTitle') : t('result.toLobby')),
        ),
      ),
    );
    parent.append(this.root);

    this.stage = new CharacterStage(this.stageMount, { mode: 'result' });
    this.stage.setCharacters(
      [{ id: me || 'me', kind: myAnimal, name: mine?.name || t('common.me'), role: youTagger ? ROLE.TAGGER : ROLE.PLAYER, badge }],
      { me: me || 'me' },
    );
  }

  dispose() {
    this.stage?.dispose();
    this.root.remove();
  }
}
