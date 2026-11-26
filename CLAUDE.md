# 비대칭 드로잉 FPS — Claude 작업 규칙

먼저 `HANDOFF.md` 를 읽는다 (상태·확정 결정·진행 중·다음 할 일). 그다음 `docs/ARCHITECTURE.md`, 기획안 `docs/gdd_v1.1.md`.

**작업하는 동안 `HANDOFF.md` 를 실시간으로 갱신하고 커밋·푸시한다** — 시작할 때, 단계마다, 끝날 때 (규칙은 HANDOFF.md 맨 위, 사용자 지시).

## 원칙 (사용자 지시)
- **SOLID 로 개발한다.** 새 기능은 기존 파일을 크게 고치기보다 감지기·시스템·명령 처리기·표에 "추가"하는 방식으로 (구체 예는 ARCHITECTURE.md).
- 밸런스 숫자는 `src/config/balance.js` 에만 둔다. 코드에 숫자를 박지 않는다.
- 통신은 `Link` 인터페이스 뒤에 둔다. 나중에 Steam 으로 바꿀 수 있어야 한다. 실시간 동기화에 Firebase 를 쓰지 않는다 (저장 기능에만 고려).
- 몬스터·보스에는 이름이 없다. 혼합 색은 속성 2개 반반. 술래는 3D 전장에 보이지 않는다. 모바일은 지원하지 않는다.

## 검증
1. `npm test` (판정·서버 로직)
2. `python3 -m http.server 8765 &` 후 `NODE_PATH=$(npm root -g) node tools/smoke.cjs` → `errors: []`, `monsters: 1`
3. 멀티플레이를 바꿨으면 로컬 PeerJS 서버로 브라우저 2~3개 접속 시험 (`?peerHost=127.0.0.1&peerPort=9000&peerPath=/`)

## 배포
- GitHub Pages (main 브랜치 루트). 빌드 없음 — 커밋·푸시하면 그대로 반영.
- 작업 기록은 `HANDOFF.md` "작업 기록" 맨 위에 (무엇을·왜·어디·검증).
