# 구조 (v0.1)

## 큰 그림

```
          ┌─────────────── 방장 PC ───────────────┐
          │  GameServer ─ Lobby                  │
          │      └ Match ─ 시스템들(매 틱)         │   PeerJS(WebRTC)
 내 화면 ◀─┤  MemoryLink ⇄ (내 클라이언트)          ├──────────────▶ 손님 PC 클라이언트
          └──────────────────────────────────────┘
```

- **방장 권한(host-authoritative)**: 경기 계산(몬스터 AI, HP, 잉크, 승패)은 방장 PC 의 `Match` 만 한다. 클라이언트는 입력(위치·명중·소환 요청)을 보내고, 스냅샷(초당 15회)과 이벤트를 받아 그린다.
- 방장 자신의 화면도 `MemoryLink` 로 똑같이 접속한다 → 방장/손님 코드가 같다.
- 플레이어 이동은 클라이언트가 계산(반응성)하고 방장이 범위만 검사한다. 명중은 클라이언트가 신고하고 방장이 연사 속도 한도로 거른다.

## 폴더

| 폴더 | 역할 |
| --- | --- |
| `src/config/` | 밸런스 수치 (한 곳) |
| `src/shared/` | 방장·클라이언트가 같이 쓰는 순수 로직: 메시지 규칙, 색·속성 표, 판정(Judge), 맵 |
| `src/server/` | 방장 전용: 로비, 경기, 시스템, 명령 처리기 |
| `src/net/` | 통신 구현 (`Link` 인터페이스 + MemoryLink·PeerNetwork) |
| `src/client/` | 화면: 시작/로비/결과, 플레이어 3D, 술래 2분할 |
| `vendor/` | three.js 0.160, PeerJS 1.5.4 |
| `tests/` | `node --test` 로 도는 판정·서버 테스트 |

## SOLID 를 어디에 적용했나

- **S (단일 책임)**: 시스템 하나 = 일 하나 (`ClockSystem`, `InkSystem`, `SpawnSystem`, `MonsterSystem`, `ProjectileSystem`, `GrenadeSystem`, `StatusSystem`, `PlayerLifeSystem`, `EscapeSystem`, `VictorySystem`). 화면도 `DrawingPad`(그리기) / `TopDownMap`(지도) / `TaggerView`(조립)처럼 나눴다.
- **O (개방-폐쇄)**: 기존 코드를 고치지 않고 더한다.
  - 형태 판정 = 감지기 목록 (`detectors/index.js`). 새 규칙은 감지기 하나 추가.
  - 색·속성 = 표 (`attributes.js`). 6번째 색은 한 줄 추가.
  - 명령 = 처리기 표 (`server/commands.js`). 새 메시지는 함수 하나 추가.
  - 맵 = `MAPS` 에 빌더 추가.
- **L (리스코프 치환)**: `MemoryLink`·`PeerLink` 는 서로 바꿔 끼워도 된다 (`BaseLink` 계약: `send / onMessage / onClose / close`). Steam 으로 갈 때 `SteamLink` 를 같은 계약으로 만든다.
- **I (인터페이스 분리)**: 시스템은 `update(match, dt)` 하나, 감지기는 `detect(features, traits)` 하나, Link 는 4개 메서드만 요구한다.
- **D (의존성 역전)**: 게임 코드는 구체 통신·판정 구현을 모른다. `main.js`(조립 지점)에서만 `PeerNetwork`, `createJudge`, `GameServer` 를 골라 주입한다.

## Steam 으로 옮길 때

1. **이 코드를 살리는 길**: Electron 으로 감싸고 `steamworks.js` 로 `SteamLink`(Steam P2P) 를 만들어 `main.js` 의 `network` 만 교체. 로비는 Steam 로비로.
2. **Unity 로 새로 만드는 길**: `shared/`(판정·밸런스·메시지 규칙)와 `server/` 의 시스템 구조를 C# 으로 옮긴다. 메시지 이름과 스냅샷 모양을 그대로 쓰면 설계가 그대로 간다.

## 메시지 흐름 (요약)

- 로비: `hello → welcome`, `role / animal / settings → lobby`(전체), `start → mstart`(각자 역할)
- 경기: 클라 → `ps`(위치 20Hz), `hit`, `shot`, `gren`, `rev`, `spawn`, `view` / 방장 → `snap`(15Hz), `ev`(이벤트), `spres`(소환 결과), `over`(결과)
- 이벤트: `pending`(빨간 장판) → `mspawn`(획 데이터 포함, 각 화면이 같은 그림을 다시 그림) → `mhit / mdie`, `boss`, `doorrev / dooropen`, `pdeath / previve / prespawn / pescape`, `proj / projend`, `gthrow / gboom`
