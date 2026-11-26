import { MSG } from '../shared/protocol.js';
import { MemoryLink } from '../net/Link.js';
import { Connection } from './Connection.js';
import { GameSession } from './state/GameSession.js';
import { TitleView, LobbyView, ResultView } from './ui/screens.js';
import { PlayerView } from './player/PlayerView.js';
import { TaggerView } from './tagger/TaggerView.js';
import { AugmentPicker } from './ui/AugmentPicker.js';
import { toast, el } from './ui/dom.js';
import { t, tr } from './i18n.js';
import { gfx } from './render/GraphicsSettings.js';

// 화면 흐름: 시작 → 로비 → 경기 → 결과 → 로비.
// 필요한 것은 모두 생성자로 주입받는다 (main.js 가 조립).

export class App {
  constructor({ root, balance, palette, attributes, judge, createMap, createServer, network, sfx, updates = null }) {
    Object.assign(this, { root, balance, palette, attributes, judge, createMap, createServer, network, sfx });
    // 새 배포가 나오면: 시작 화면이면 바로 새로고침, 방·경기 중이면 알리고 시작 화면으로 돌아갈 때 새로고침
    this.updatePending = false;
    this.updates = updates;
    updates?.on('update', () => this.onUpdate());
    this.screen = null;
    this.server = null;
    this.hosting = null;
    this.conn = null;
    this.views = null;
    this._raf = 0;
    this._last = 0;
    this.quitting = false;
    this._tab = (e) => this.onTab(e);
    window.addEventListener('keydown', this._tab);
  }

  start() {
    this.showTitle();
    this.loop();
  }

  // 화면 갱신 빈도는 그래픽 설정이 정한다 (최대 60번, 창이 다른 창 뒤면 15번 — 팬이 도는 것 방지)
  loop() {
    const frame = (t) => {
      this._raf = requestAnimationFrame(frame);
      if (this._last && t - this._last < gfx.frameInterval()) return;
      const dt = Math.min(0.05, (t - (this._last || t)) / 1000);
      this._last = t;
      if (!this.views) return;
      const time = t / 1000;
      this.views.player?.update(dt);
      this.views.tagger?.update(dt, time);
    };
    this._raf = requestAnimationFrame(frame);
  }

  setScreen(s) {
    this.screen?.dispose();
    this.screen = s;
  }

  onUpdate() {
    this.updatePending = true;
    if (this.screen instanceof TitleView) location.reload();
    else toast(t('common.updateReady'), 'warn');
  }

  // 방에 들어가기 직전에 한 번 더 확인: 새 버전이 있으면 들어가지 않고 새로고침 (옛 코드로 방에 들어가는 일 방지)
  async ensureLatest() {
    await this.updates?.check();
    if (this.updatePending) await new Promise(() => {}); // 새로고침 중 — 더 진행하지 않음
  }

  showTitle() {
    if (this.updatePending) {
      this.teardownNet();
      location.reload();
      return;
    }
    this.teardownNet();
    // 로비 3D 화면(WebGL)까지 정리한 뒤 시작 화면으로
    this.lobby?.destroy();
    this.lobby = null;
    this.lastLobby = null;
    this.setScreen(
      new TitleView(this.root, {
        onCreate: (name) => this.createRoom(name),
        onJoin: (code, name) => this.joinRoom(code, name),
        onSolo: (name) => this.startSolo(name),
      }),
    );
  }

  // 방장: 서버를 내 PC 에 만들고, 내 클라이언트는 메모리 연결로 붙인다.
  async createRoom(name) {
    await this.ensureLatest();
    const server = this.createServer({ solo: false });
    let code, hosting;
    for (let i = 0; i < 4 && !hosting; i++) {
      code = this.network.randomRoomCode();
      try {
        hosting = await this.network.hostRoom(code, (link) => server.attach(link));
      } catch (e) {
        if (i === 3 || e.message !== 'net.unavailableId') {
          server.close();
          throw e;
        }
      }
    }
    this.server = server;
    this.hosting = hosting;
    const [a, b] = MemoryLink.pair();
    this.localId = server.attach(a);
    this.connect(b, name, code, false);
  }

  async joinRoom(code, name) {
    if (!/^[A-Z0-9]{5}$/.test(code)) throw new Error('title.codeInvalid');
    await this.ensureLatest();
    const link = await this.network.joinRoom(code);
    this.connect(link, name, code, false);
  }

  async startSolo(name) {
    await this.ensureLatest();
    const server = this.createServer({ solo: true });
    this.server = server;
    const [a, b] = MemoryLink.pair();
    this.localId = server.attach(a);
    this.connect(b, name, '', true);
  }

  connect(link, name, code, solo) {
    const conn = new Connection(link);
    this.disconnected = false;
    this.quitting = false;
    this.conn = conn;
    this.roomCode = code;
    this.solo = solo;
    conn.on(MSG.WELCOME, (m) => {
      this.me = m.id;
      this.lobby = new LobbyView(this.root, { conn, me: m.id, code, solo, onLeave: () => this.showTitle() });
      this.setScreen(this.lobby);
    });
    conn.on(MSG.LOBBY, (st) => {
      this.lastLobby = st;
      if (this.screen === this.lobby) this.lobby.render(st);
    });
    conn.on(MSG.MATCH_START, (m) => this.startMatch(m));
    conn.on(MSG.GAME_OVER, (r) => {
      if (this.quitting) return; // 방을 나가는 중에 도착한 결과는 버린다 (시작 화면으로 가는 중)
      this.endMatch(r);
    });
    conn.on(MSG.ERROR, (e) => toast(tr(e.message), 'warn'));
    conn.on('close', () => {
      if (this.conn !== conn) return;
      toast(t('common.disconnected'), 'warn');
      // 결과 화면은 남겨 두고, '로비로' 를 누르면 시작 화면으로
      if (this.screen instanceof ResultView) this.disconnected = true;
      else this.showTitle();
    });
    conn.send({ t: MSG.HELLO, name });
  }

  startMatch(m) {
    this.setScreen(null);
    const map = this.createMap(m.mapId);
    const session = new GameSession({ start: m, map, conn: this.conn });
    this.session = session;
    const holder = el('div', { class: 'game' });
    this.root.append(holder);
    const common = { parent: holder, session, balance: this.balance, palette: this.palette, attributes: this.attributes, sfx: this.sfx };
    this.views = { holder };
    if (session.isTagger) this.views.tagger = new TaggerView({ ...common, judge: this.judge });
    if (session.isPlayer) this.views.player = new PlayerView(common);
    if (session.role !== 'spectator') this.views.picker = new AugmentPicker({ parent: holder, session, balance: this.balance, sfx: this.sfx });
    if (session.role === 'both') {
      this.views.tagger.setActive(false);
      this.views.player.setActive(true);
      holder.append(el('div', { class: 'solo-hint' }, t('game.soloHint')));
    }
  }

  onTab(e) {
    if (e.code !== 'Tab' || !this.views?.player || !this.views?.tagger) return;
    e.preventDefault();
    const toTagger = this.views.player.active;
    this.views.player.setActive(!toTagger);
    this.views.tagger.setActive(toTagger);
    this.conn.send({ t: MSG.VIEW, tagger: toTagger });
  }

  disposeMatch() {
    if (!this.views) return;
    this.views.player?.dispose();
    this.views.tagger?.dispose();
    this.views.picker?.dispose();
    this.views.holder.remove();
    this.views = null;
    this.session?.dispose();
    this.session = null;
  }

  endMatch(result) {
    this.disposeMatch();
    this.setScreen(
      new ResultView(this.root, {
        result,
        me: this.me,
        disconnected: this.disconnected,
        onBack: () => {
          if (this.disconnected || !this.lobby) return this.showTitle();
          this.setScreen(this.lobby);
          this.root.append(this.lobby.root);
          if (this.lastLobby) this.lobby.render(this.lastLobby);
          this.lobby.resume();
        },
      }),
    );
    // 로비 화면 객체는 살려 둔다
    this.lobby?.root.remove();
  }

  teardownNet() {
    this.quitting = true;
    this.disposeMatch();
    const conn = this.conn;
    const server = this.server;
    const hosting = this.hosting;
    this.conn = null;
    this.server = null;
    this.hosting = null;
    if (server) {
      // 손님들에게 결과를 먼저 보낸 뒤 닫는다
      server.shutdown(this.localId).then(() => {
        conn?.close();
        hosting?.close();
      });
    } else conn?.close();
  }
}
