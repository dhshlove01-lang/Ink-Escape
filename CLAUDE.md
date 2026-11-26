# 비대칭 드로잉 FPS — Claude 작업 규칙

먼저 `HANDOFF.md` 를 읽는다 (상태·확정 결정·진행 중·다음 할 일). 그다음 `docs/ARCHITECTURE.md`, 기획안 `docs/gdd_v1.1.md`.

**작업하는 동안 `HANDOFF.md` 를 실시간으로 갱신하고 커밋·푸시한다** — 시작할 때, 단계마다, 끝날 때 (규칙은 HANDOFF.md 맨 위, 사용자 지시).

## 원칙 (사용자 지시)
- **SOLID 로 개발한다.** 새 기능은 기존 파일을 크게 고치기보다 감지기·시스템·명령 처리기·표에 "추가"하는 방식으로 (구체 예는 ARCHITECTURE.md).
- 밸런스 숫자는 `src/config/balance.js` 에만 둔다. 코드에 숫자를 박지 않는다.
- **글씨는 `style.css` 의 폰트 토큰 4개만 쓴다**: `--font-display`(주아: 한글 제목·버튼·배너), `--font-num`(Luckiest Guy: 영문·숫자 강조), `--font-body`(Pretendard: 본문), `--font-hand`(개구: 낙서 포인트). 캔버스 글씨도 같은 폰트 이름. 파일·라이선스는 `assets/fonts/` (README.md). 구글 폰트 서버 링크를 다시 넣지 않는다.
- **화면 글씨는 번역 사전으로**: `src/shared/i18n/strings.js` 에 키를 만들고 **ko·en 둘 다** 채운 뒤 화면에선 `t('키', {값})` (`src/client/i18n.js`). 코드에 한국어·영어 문장을 직접 쓰지 않는다. 방장 서버는 문장 대신 `msg('키', {값})` 를 보내고, 받은 쪽이 `tr()` 로 자기 언어로 표시한다. 함수 안에 `t`·`msg` 라는 지역 변수를 만들지 말 것 (번역 함수를 가린다).
- 3D 모델(GLB)은 `assets/models/` + `src/config/models.js` 에 한 줄. 불러오기는 `ModelLibrary`, 실패하면 임시(공 조합) 모델로 대체되어야 한다.
- 통신은 `Link` 인터페이스 뒤에 둔다. 나중에 Steam 으로 바꿀 수 있어야 한다. 실시간 동기화에 Firebase 를 쓰지 않는다 (저장 기능에만 고려).
- 몬스터·보스에는 이름이 없다. 혼합 색은 속성 2개 반반. 술래는 3D 전장에 보이지 않는다. 모바일은 지원하지 않는다.

## 검증
1. `npm test` (판정·서버 로직)
2. `python3 -m http.server 8765 &` 후 `NODE_PATH=$(npm root -g) node tools/smoke.cjs` → `errors: []`, `monsters: 1`
3. 멀티플레이를 바꿨으면 로컬 PeerJS 서버로 브라우저 2~3개 접속 시험 (`?peerHost=127.0.0.1&peerPort=9000&peerPath=/`)

## 배포
- GitHub Pages (main 브랜치 루트). 빌드 없음 — 커밋·푸시하면 그대로 반영.
- 작업 기록은 `HANDOFF.md` "작업 기록" 맨 위에 (무엇을·왜·어디·검증).
