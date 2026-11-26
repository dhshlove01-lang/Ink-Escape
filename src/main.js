// 조립 지점 (Composition Root). 구현체를 고르고 서로 연결하는 곳은 여기 한 곳뿐이다.
// 통신 수단을 Steam 등으로 바꾸려면 network 객체만 갈아 끼우면 된다.

import { BALANCE } from './config/balance.js';
import { PALETTE, ATTRIBUTES } from './shared/attributes.js';
import { createJudge } from './shared/judge/Judge.js';
import { createMap } from './shared/map/maps.js';
import { GameServer } from './server/GameServer.js';
import * as PeerNetwork from './net/PeerNetwork.js';
import { App } from './client/App.js';
import { Sfx } from './client/render/Sfx.js';

const judge = createJudge({ balance: BALANCE, palette: PALETTE, attributes: ATTRIBUTES });

const app = new App({
  root: document.getElementById('app'),
  balance: BALANCE,
  palette: PALETTE,
  attributes: ATTRIBUTES,
  judge,
  createMap,
  createServer: ({ solo }) => new GameServer({ balance: BALANCE, judge, paletteLength: PALETTE.length, createMap, solo }),
  network: {
    randomRoomCode: PeerNetwork.randomRoomCode,
    hostRoom: PeerNetwork.hostRoom,
    joinRoom: PeerNetwork.joinRoom,
  },
  sfx: new Sfx(),
});

window.addEventListener('pointerdown', () => app.sfx.unlock(), { once: true });
app.start();
window.__app = app; // 디버그·자동 테스트용
