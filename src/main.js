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
import { MODEL_DEFS } from './config/models.js';
import { ModelLibrary } from './client/render/ModelLibrary.js';
import { setModelLibrary } from './client/render/AnimalModels.js';
import { IMAGE_DEFS } from './config/assets.js';
import { loadImages, url } from './client/render/Images.js';
import { UpdateWatcher } from './client/UpdateWatcher.js';

// 새 배포 감지 (서비스 워커 등록·배포 전용 주소는 index.html 이 한다)
const updates = new UpdateWatcher({ base: window.BUILD_STAMP });
updates.start();

// 3D 모델 파일(GLB): 기다리지 않고 불러오기 시작. 늦게 끝나면 임시 모델을 바꿔 끼운다.
const models = new ModelLibrary(MODEL_DEFS);
setModelLibrary(models);
models.loadAll();

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
  updates,
});

window.addEventListener('pointerdown', () => app.sfx.unlock(), { once: true });
// 2D 이미지를 (최대 4초) 기다린 뒤 시작. 늦거나 없으면 코드 그리기로 대체된다.
// 캔버스에 글씨를 그리기 전에 폰트도 준비 (이름표 등)
const loadFonts = () =>
  Promise.allSettled(['24px Jua', '24px "Luckiest Guy"', '16px Pretendard', '20px Gaegu'].map((f) => document.fonts.load(f, '가나다 ABC 123')));
await Promise.race([Promise.all([loadImages(IMAGE_DEFS), loadFonts()]), new Promise((r) => setTimeout(r, 4000))]);
// CSS 가 쓰는 UI 이미지: 불러온 것만 변수 + art-* 클래스로 켠다 (없으면 기존 CSS 모양)
for (const [key, name] of [['ui.title_bg', 'title-bg'], ['ui.spawn_btn', 'spawn-btn'], ['ui.bar_hp', 'bar-hp'], ['ui.bar_boss', 'bar-boss'], ['ui.pencil', 'pencil'], ['ui.crosshair', 'crosshair']]) {
  const u = url(key);
  if (!u) continue;
  document.documentElement.style.setProperty(`--img-${name}`, `url("${u}")`);
  document.body.classList.add(`art-${name}`);
}
app.start();
window.__app = app; // 디버그·자동 테스트용
