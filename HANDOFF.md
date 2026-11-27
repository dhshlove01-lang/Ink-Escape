# HANDOFF — 다른 AI 가 이어서 작업하기 위한 문서

> 이 저장소에서 작업하는 AI(Claude, Codex, Cursor 등)는 **무엇보다 먼저 이 파일을 읽는다.**
> 그리고 **작업하는 동안 이 파일을 실시간으로 계속 고쳐 쓴다.** (아래 규칙)

---

## ⚠ 이 파일 쓰는 규칙 (필수 — 사용자 지시 2026-11-26)

1. **작업을 시작하면 바로**: 아래 "지금 진행 중"에 할 일을 적고 **커밋·푸시**한다.
2. **작업하는 동안 계속**: 한 단계가 끝날 때마다(파일 몇 개를 고쳤을 때, 테스트를 돌렸을 때) "지금 진행 중"의 체크 목록을 갱신하고 **커밋·푸시**한다.
   - 대화가 중간에 끊겨도 다음 AI 가 이 파일만 보고 이어받을 수 있어야 한다.
   - 미완성 코드라도 깨진 상태로 두지 말고, 어디까지 됐고 무엇이 남았는지 적는다.
3. **작업이 끝나면**: "작업 기록" 맨 위에 *무엇을 · 왜 · 어디(파일/함수) · 검증* 을 적고, "지금 진행 중"을 비우고, "다음 할 일"을 고친다. 커밋·푸시.
4. 사용자가 새로 정한 규칙·결정은 "사용자가 확정한 결정"에 바로 한 줄 추가한다.

---

## 프로젝트 한눈에

- **게임**: 비대칭 드로잉 FPS. 술래 1명이 도화지에 그린 그림이 3D 전장의 몬스터(종이 인형 빌보드)가 되고, 플레이어 1~4명(동글동글 동물)이 10분을 버티고 탈출한다.
- **지금 형태**: 브라우저 프로토타입 v0.1 (three.js + PeerJS/WebRTC P2P, 빌드 도구 없음). PC 전용.
- **저장소**: `dhshlove01-lang/Ink-Escape` (2026-11-26 사용자가 asymmetric-drawing-fps 에서 이름 변경, 공개 전환 완료)
- **배포**: GitHub Pages (main 브랜치 루트) → **https://dhshlove01-lang.github.io/Ink-Escape/** (2026-11-26 켜짐, 푸시하면 1~2분 뒤 반영)
  - 저장소 설정(Pages 켜기 등)은 사용자가 GitHub 설정에서 직접 해야 한다 (AI 쪽 권한으로는 막혀 있음).
- **최종 목표**: Steam 출시. 통신은 `Link` 인터페이스 뒤에 있어서 Steam P2P 로 갈아 끼울 수 있게 설계했다.
- **기획안**: `docs/gdd_v1.1.md` · **구조 설명**: `docs/ARCHITECTURE.md`

## 실행 · 검증

```bash
npm test                                   # 판정·서버 로직 (node --test, 설치 없음)
python3 -m http.server 8765 &              # http://localhost:8765
NODE_PATH=$(npm root -g) node tools/smoke.cjs   # 헤드리스 혼자 테스트: {"monsters":1,"errors":[]} 이어야 함
URL=https://dhshlove01-lang.github.io/Ink-Escape/ NODE_PATH=$(npm root -g) node tools/smoke.cjs   # 배포된 사이트 확인
```

- 멀티플레이 시험: 로컬 PeerJS 서버(`npm i peer` 후 `ExpressPeerServer` 를 127.0.0.1:9000 에)를 띄우고
  `index.html?peerHost=127.0.0.1&peerPort=9000&peerPath=/` 로 브라우저 2~3개 접속.
- 헤드리스에서는 포인터 잠금이 안 되므로 `window.__app.views.player.weapon.fire()` 처럼 직접 호출해서 시험한다.

## 코드 지도

| 어디 | 무엇 |
| --- | --- |
| `src/main.js` | 조립 지점. 구현체 선택은 여기서만 |
| `src/config/balance.js` | **모든 밸런스 숫자** (코드에 숫자 박지 말 것) |
| `src/shared/judge/` | 그림 판정: 래스터라이저 → 색(면적) + 형태 감지기(날개·가시·촉수) → 스탯 |
| `src/shared/map/` | 격자 맵(충돌·시야·탈출 문), 맵 정의 |
| `src/server/` | 방장 PC 서버: 로비, 경기(Match), 시스템 10개, 명령 처리기 표 |
| `src/net/` | `Link` 인터페이스, MemoryLink, PeerJS |
| `src/client/player/` | 플레이어 1인칭 3D |
| `src/client/tagger/` | 술래 2분할 화면 |
| `src/client/ui/` | 시작·로비·결과 화면 (`CharacterStage.js` = 3D 대기실·결과 무대) |

## 사용자가 확정한 결정 (바꾸지 말 것)

- 개발 방식: **SOLID**. 새 기능은 감지기·시스템·명령 처리기·표에 "추가"하는 방식으로.
- PC 전용 (모바일 안 함). GitHub Pages 배포. 실시간 동기화에 Firebase 안 씀 (나중에 저장 기능에만 고려), Steam 으로 옮길 수 있게.
- 아트: 캐릭터는 동글동글 귀여운 3D 동물(시바·곰·토끼·삼색고양이), 전장은 어두운 낙서 던전 — 대비가 컨셉. 1인칭 손은 동물 앞발(지금은 임시).
- 총: 1종 통일, 30발, 예비 탄약 무한, 재장전 1초.
- 몬스터·보스에 **이름 없음** (속성 아이콘·오라로만 구분). (반반 속성 규칙은 C안으로 폐기)
- 몬스터는 가장 가까운 플레이어를 쫓는다. 동시 수 제한 없음(잉크가 제한). 처치해야만 사라진다. 술래가 지휘하지 않는다(보는 재미).
- (복도 맵이 생기면) 통로보다 큰 몬스터는 못 지나가고, 통로를 지나는 원거리 스킬이 있으면 쏘고 없으면 그 플레이어를 무시.
- 소환: 3초 전 짧은 공지 + 바닥 빨간 장판. 보스 재사용 60초. 플레이어 8m 안 소환 금지.
- 술래는 3D 전장에 보이지 않는다.
- 부활: 죽으면 바로 시체(기절 없음), 60초 뒤부터, 팀원이 2초 누르면 그 자리에서 HP 50%로. 한 사람이 살릴 수 있는 횟수 = 플레이어 4명 3회 / 3명 2회 / 2명 1회. 부활 대기도 "죽은 것"으로 친다. 죽은 사람은 관전.
- 2인전(플레이어 1명)은 목숨 2개.
- 승리: 살아 있는 플레이어 **1명이라도 탈출**하면 플레이어 승리. 전멸하면 술래 승리.
- 이탈: 술래가 나가면 플레이어 승리, 플레이어가 모두 나가면 술래 승리.
- 방장(계산 담당) = **핑이 가장 좋은 플레이어** (목표. 지금은 방 만든 사람 — 미구현).
- 인원수 보정: 보스 HP 조금 상향 + 술래 잉크(연필 자루)를 넉넉히.
- 문이 열린 뒤 **최후 발악 = 잉크 무제한**.
- 지우개 수류탄으로 뭉친 몬스터 제거.
- 보급: 3분마다 술래·플레이어 둘 다, 10장 중 랜덤 3장에서 1장 선택 (미구현).
- 마우스로 그린다. 최근 3개 재소환 슬롯.
- 역할 선택: 랜덤 / 술래 / 플레이어, 먼저 누른 사람 우선. 봇·솔로·연습 모드 원함 (봇 미구현).
- 그림 속 무기는 생긴 대로: 칼은 휘두르고 총은 쏜다 (미구현, 기획안 7-5 무기 레이어).
- 명예(잘 그린 그림 투표)·그림 갤러리 원함 (미구현).
- 맵은 3개로 시작 (지금 1개).
- 술래 왼쪽 화면 (2026-11-26 IMG_1239 로 재확정): **실시간 3D 탑뷰**(비스듬히 내려다보는 원근 카메라, 마우스 휠로 확대/축소) + **왼쪽 위 플레이어 카드(얼굴·이름·HP)** + **왼쪽 아래 2D 미니맵**(플레이어·문·몬스터 점) + **오른쪽 아래 화면 전환**(◀ 3D 탑뷰 ▶ / 플레이어 카드를 누르면 그 플레이어 머리 위 따라가기 카메라). 그림은 계속 그릴 수 있고 뷰만 바뀐다. 소환은 3D 탑뷰·따라가기 화면을 클릭/드래그해서 고른다.
- 술래 오른쪽 화면 (DIRECTOR, IMG_1239): 위에 `보스 2배`·`올인` 토글, `PENCIL INK` 게이지+%, 가운데 **공책 도화지 + 오른쪽 세로 색 팔레트(검정·빨강·파랑·노랑·보라 + 직접 고르기·지우개·휴지통)**, 그 아래 속성(C안)·굵기/되돌리기/색 코드·판정 미리보기·재소환 3칸, 맨 아래 큰 빨간 `SPAWN`.
- 천장은 바닥처럼 막힌 면: 몬스터·아이콘이 뚫지 않는다. 천장은 플레이어 화면에만.
- 폰트: 주아(한글 제목·버튼) + Luckiest Guy(영문·숫자) + Pretendard(본문) + 개구(낙서 포인트). 모두 상업용 무료, 저장소에 파일로 (`assets/fonts/`).
- 언어: 한국어·영어 둘 다, 고를 수 있게.
- 술래 소환 순서: 그림 → SPAWN → 지도 클릭(탑뷰·3D 둘 다). 색은 컬러 피커로 자유롭게.
- **속성은 색과 분리**: 색은 꾸미기만, 속성은 소환 전에 아이콘으로 따로 고른다 (2026-11-26 사용자 C안 선택, '혼합 속성 반반' 규칙은 폐기).
- 대기실은 **폴가이즈 스타일 3D 무대**(단상 위 캐릭터·READY 이름표), 결과 화면은 **가운데 3D 캐릭터 + 왼쪽 뱃지 + 오른쪽 점수 정산 + 로비로 돌아가기**. (2026-11-26 사용자 요청)

- **밸런스 목표** (2026-11-26): 술래:플레이어 승률 50:50, 플레이어는 FPS 초보·캐주얼(명중률 40~50%) 기준. 달리기는 기력(4초) 제한, 지우개 수류탄은 일반 몬스터 최대 HP 60% (즉사 아님).
- **보급 = 그 판 동안 영구 증강** (2026-11-26 확인): 3·6·9분에 10장 중 3장 → 1장. 목록은 `docs/gdd_v1.1.md` 10장 (플레이어 10 · 술래 10). 수치형은 2번까지 중첩, 효과형은 한 번만. 플레이어는 맵에 떨어진 상자를 주워서, 술래는 자동 카드 (2026-11-26 사용자 결정).

## 지금 진행 중

(없음)

## 다음 할 일 (우선순위)

1. 보급 카드 (3분마다 10장 중 3장) — 기획안 10장
2. 핑 기준 방장 자동 선택 + 방장 이전
3. 봇 플레이어 / AI 술래 (갤러리 그림 사용), 연습 모드
4. 명예 투표 + 그림 갤러리 (이때 Firebase 같은 저장소 검토)
5. 무기 레이어 (칼 휘두르기·총 쏘기)
6. 맵 2·3 (한밤의 미술실, 한밤의 책상 위)
7. 신고·다른 사람 그림 숨기기·스트리머 모드
8. 1인칭 앞발 — **2026-11-27 GLB 4종으로 교체 완료**(`paw_*.glb`). 남은 건 총 손잡이를 감싸는 느낌 다듬기, 그리고 SF3D 한도가 풀리면 같은 파일명으로 재구성 모델 덮어쓰기 · 효과음 파일
9. 캐릭터 **대기(idle) 클립** — 지금은 정지 시 바인드(A포즈)다. Tripo 에서 idle 을 뽑아 `assets/models/<동물>.glb` 안에 넣으면 `CharacterRig` 가 `pickClip(clips,'idle')` 로 자동 재생(코드 한 줄 추가). 있으면 로비 단상도 훨씬 살아난다.
10. 애니메이션 클립 추가(피격·사망·재장전·부활) — 같은 리그에 클립만 늘리면 된다(`CharacterRig` 가 이름으로 찾는다).

## 알려진 문제

- 방장 탭이 뒤로 가면 브라우저가 타이머를 늦춰 다른 사람 화면이 끊긴다.
- PeerJS 공개 중개 서버(0.peerjs.com)는 AI 작업 환경에서 접속이 막혀 있어 실서버 접속은 사용자 PC 에서만 확인 가능.
- 인게임 다른 플레이어 몸(진짜 GLB)에 든 총이 몸에 조금 파묻혀 있다(원거리에서는 티가 안 남). 몸에 맞춰 총 위치만 더 다듬으면 된다 — `AnimalModels.rifleMesh()`.
- 효과음은 아직 임시.

## 작업 기록

### 2026-11-27 · 버그: 사이트가 계속 새로고침됨 (무한 새로고침)
- **원인**: 새 배포 감지(`UpdateWatcher`)가 "지금 화면의 배포 시각(document.lastModified) < index.html HEAD 의 Last-Modified" 이면 새로고침. 그런데 GitHub Pages CDN 서버마다 **같은 배포**인데 Last-Modified 가 1초 달랐다 (05:04:13 / 05:04:14). 화면은 :13 서버, HEAD 는 :14 서버에서 받으면 → 새로고침 → 또 :13 → 끝없이 반복 (헤드리스로 25초에 46번 재현).
- **고침**: `src/client/UpdateWatcher.js` — 60초(`SAME_DEPLOY_MS`) 넘게 새로울 때만 새 배포로 봄. `reload()`: 주소에 `?fresh=<배포시각>` 을 붙여 CDN 옛 사본을 건너뛰고, 같은 버전 때문에 2분 안에 또 새로고침하지 않음(sessionStorage, `RELOAD_GUARD_MS`). `App.reloadForUpdate()` 가 이걸 쓰고, 거절되면 그냥 지금 화면으로 계속. `index.html` 로더가 `?fresh=` 를 주소창에서 지움.
- **검증**: `tests/update.test.mjs`(1초 차이 무시 · 5분 뒤 배포는 감지 · 같은 버전 연속 새로고침 안 함), `npm test` 통과. 배포 후 실제 사이트에서 다시 확인(아래).

### 2026-11-27 · 대마왕 궁전 맵 (원통형·천장 2배) + 게임 오브젝트 GLB 17종 + 소품 충돌
- **무엇을** (사용자 요청·답변): 지금 맵을 궁전으로 교체, **큰 원통형** 맵, 천장 **2배(7→14m)**, 오브젝트·표시 높이는 최대치(`VIEW_H` 7.5m), 보스 의자(왕좌) + 앞 발판 + 잉크병들, 탈출 자물쇠를 문에 붙여 **문 열릴 때 자물쇠도 열림**, 오브젝트 **통과 안 되게**, 던전 소품·탈출문·보급/회복 상자·던지는 것 GLB 교체.
- **맵** `src/shared/map/maps.js buildPalace()` (map id `palace`, 이름 `map.palace` ko/en): 39×39 칸, 반지름 34m 원. 가운데 왕좌의 방(ㄱ자 벽 4개, 동서남북 10m 입구) + 바깥 둘레, 기둥 12개(둘레 8 + 방 안 4), 탈출문 북·서·동. 스폰은 홀 가운데. `Lobby.js` 기본 mapId `palace`. 예전 `dungeon` 빌더는 남겨 둠.
  - 소품은 **맵 데이터**(`map.props`: kind·x·z·ry·solid{r | hx,hz}·tall) → 방장·클라이언트가 같은 데이터로 충돌. 왕좌(상자, tall=총알·시야도 막음)·발판·잉크병 6+3·통·상자·카펫·샹들리에 5·스테인드글라스 창 9.
- **충돌** `GameMap`: `bounds`(둥근 벽, 문 입구 `inMouth` 만 예외), `collideCircle` 이 소품(원·돌린 상자)·둥근 벽에서 밀어냄, `raycast` 는 둥근 벽·키 큰 소품에서 멈춤, `isFloor` 는 원 밖·소품 위 false(소환·보급 자리), 몬스터 길찾기 `FlowField` 는 `map.blocked`(벽 + 소품 칸). `WALL_H` 14, `VIEW_H` 7.5 (몬스터 그림 `MonsterRenderer CEIL`, 보급 빛기둥, 창·샹들리에 위끝).
- **화면** `render/PalaceBuilder.js`(둥근 벽 = 안쪽을 보는 원통 조각, 문 자리 비움 / 원형 바닥·천장 / 벽 윗테 / 소품 배치·카펫·샹들리에 사슬·빛), `render/MapModels.js placeModel()`(GLB 를 lazy 로 받고 그동안 간단 도형, 도착하면 교체, `fit` 으로 축별 크기). `SceneBuilder`: 둥근 맵이면 PalaceBuilder, 테마가 주면 GLB 기둥(천장까지 늘림)·GLB 횃불(`buildTorch(..., model)`)·GLB 탈출문, 낙서·크레용 원은 테마가 켤 때만. 테마 `config/themes.js palace`(텍스처 `assets/tex/palace_{floor,wall,carpet}.webp`, `tile` 실제 크기, 밝은 조명, `models`, `lobby.window`). 로비 방(`CharacterStage.buildThemeRoom`)도 궁전 텍스처·GLB 기둥·횃불·가운데 창.
- **탈출문** `EscapeGate`: models 를 주면 `door_frame`(문 구멍 반폭=높이×0.235 로 크기 맞춤, 약 13m 아치)·`door_leaf` 두 짝(왼짝 거울=오른짝, 탈출구 쪽으로 열림)·`door_lock`(모델을 아래 70% 몸통 / 위 걸쇠로 **잘라** 열릴 때 걸쇠가 튀어 오르고 몸통이 떨어짐). 못 받으면 예전 석재 아치·철창·코드 자물쇠.
- **보급·회복 상자** `SupplyCrates`: `crate_supply`/`crate_heal` GLB, 회복 상자는 초록 빛기둥. 서버 `SupplySystem`: `balance.supply.healDrops: [1]`(두 번째 보급)이 회복 상자 → 줍는 사람 HP `healHp: 35` 회복(최대 넘지 않음) + 카드는 똑같이. 이벤트 `SUPPLY.kind`, `SUPPLY_TAKE.heal`.
- **던지는 것**: 지우개 수류탄 `Effects.grenade` → `grenade_eraser` 3D(빙글빙글). 보스·거인 원거리 탄 → `EV.PROJ.boss` 일 때 번갈아 `boss_pencil`(날아가는 쪽을 봄)·`boss_inkbomb`(회전). 일반 몬스터 탄은 그대로 그림.
- **에셋**: `assets/models/{prop_barrel,prop_crate,prop_pad,prop_inkbottle,prop_chandelier,prop_torch,palace_throne,palace_window,palace_pillar,door_frame,door_leaf,door_lock,crate_supply,crate_heal,grenade_eraser,boss_inkbomb,boss_pencil}.glb` — 받은 zip 의 파일명 "마왕의자"↔"마왕창문"은 서로 바뀌어 있어 렌더로 확인해 바로잡음. 텍스처를 `tools/glb_shrink.py`(새 도구: 최대 1024/512, JPEG)로 줄여 합계 9.9MB(궁전 3개는 각 8~9MB → 1MB). `config/models.js` 에 `prop()` 한 줄씩, 모두 `lazy`(경기 화면 만들 때 받음). 총(`총.glb`)은 이미 같은 파일이라 그대로.
- **검증**: `npm test` 18 통과(새 `tests/map.test.mjs` 둥근 벽·소품 충돌·문 입구·키 큰 소품 시야, `tests/supply.test.mjs` 회복 상자). smoke `errors: []`·`monsters: 1`(한 번은 헤드리스가 느려 0 → 다시 돌려 2번 연속 통과). 헤드리스 화면 확인: 로비(궁전 방), 1인칭 홀·카펫·왕좌·기둥·창·샹들리에·횃불, 탈출문 닫힘→자물쇠 번쩍·낙하→문짝 열림→탈출구 빛(애니메이션 시간을 직접 넘겨 확인), 술래 3D 탑뷰·따라가기·작은 지도(원형), 보급/회복 빛기둥·3D 수류탄·보스 탄.
- **알려진 점**: 소품 모델이 개당 약 1만 삼각형이라 화면 전체 50만 정도 — 느리면 같은 소품을 InstancedMesh 로 묶거나 `glb_shrink` 처럼 메시 줄이기. 보급 상자(떨어지는 것)는 부딪힘 없음(가서 닿으면 줍는 물건). 문틀이 13m 로 큼(문 칸 너비 6m 에 문 구멍을 맞춘 결과).

### 2026-11-27 · 총: 궤적 선 없앰 + 총구 번쩍임 절반
- **무엇을**: 사용자 지시 "총 쏠 때 레이저 같은 긴 선 안 나오게, 총구 번쩍임 크기 반으로". 내 총(1인칭)·다른 플레이어 총 모두 궤적 선(`effects.tracer`)을 부르지 않는다. 1인칭 번쩍임·빛무리는 `FLASH_SCALE = 0.5`, 월드 번쩍임 스프라이트 0.75→0.375(내 것)·0.5→0.25(남의 것). 총알 자국(5초)은 그대로.
- **어디**: `Weapon.js`(`FLASH_SCALE`, `update`), `PlayerView.onShot`, `WorldRenderer` EV.SHOT. `Effects.tracer` 함수는 남겨 둠(다시 쓸 수 있게).
- **검증**: smoke `errors: []`, `monsters: 1`.

### 2026-11-27 · 로비 대기 동작: 찌그러짐 없이 천천히 좌우로만
- **무엇을**: 사용자 지적 "대기 때 몸이 길어지거나 갑자기 움직이고 너무 찌그러짐" → 대기실 캐릭터는 정면을 본 채 천천히 좌우로 도는 것만(약 ±18°, `IDLE_SWAY`). 숨쉬기 크기 변화·위아래 들썩임·기지개(늘어남)·깡총 찌그러짐 제거, 플레이어 딴짓(인사·두리번·기지개·깡총·한 바퀴·갸우뚱) 끔. 술래의 연필 바닥 낙서는 유지(몸 모양은 안 바뀜). 결과 화면 축하 동작(깡총·한 바퀴·인사)은 유지하되 찌그러짐은 뺌.
- **어디**: `src/client/ui/CharacterStage.js` — `update()` (scale 항상 1), `IDLE_SWAY`, `PLAYER_ACTS = []`, `pickAct` 빈 목록이면 null, `actPose('hop')`.
- **검증**: 헤드리스로 1.5초 간격 6번 재서 회전 0.15 → -0.22 로 천천히 변하고 scale 1·높이 0 유지. smoke `errors: []`, `monsters: 1`.

### 2026-11-27 · Tripo GLB 6종(시바·곰·토끼·삼색고양이·술래·총) 교체 + 달리기 애니메이션 + "총 들고 달리기"
- **무엇을**: 사용자가 Tripo AI 로 뽑아 메일(`제목 "트리포"`, 스레드 `1a21ade1c090be1b`, 메시지 `1a21ae100a9fff4d`)로 보낸 `.glb` 6개를 캐릭터 5종 + 총에 적용. 새 캐릭터 4종에는 **mixamo 뼈대(65개) + 달리기/걷기 클립**이 들어 있어, 그냥 달리는 대신 **총을 든 채로 달리는** 모습이 되도록 리그·IK·총 장착을 붙였다.
- **파일 매핑**(메일 첨부 `tripo_convert_<uuid>.glb` → 이름은 4방향 렌더로 직접 눈으로 판별):
  | 첨부 uuid | 정체 | 클립 | 비고 |
  | --- | --- | --- | --- |
  | `79f4196d-3be7-4e55-98f5-d67747be2374` | `cat.glb` (삼색고양이, 보라 베레모·목도리·가죽 가방) | walk.001 2.375s / **run.001 1.292s** | SkinnedMesh 65본 |
  | `4be743bf-8015-4901-82ec-8e10c48a114a` | `rabbit.glb` (흰 토끼, 겨자색 모자·목도리) | 위와 같음 | |
  | `d0e2685f-0d0c-4873-b6e2-1fc233dbe7f0` | `shiba.glb` (시바, 주황 목도리·가죽 벨트) | 위와 같음 | |
  | `2cb8c045-abfc-4b01-ac04-5639f71a39fc` | `bear.glb` (군용 곰, 헬멧·고글·탄약 조끼) | 위와 같음 | |
  | `d8e4670b-6dcb-4009-82fc-928050a3951f` | `devil.glb` (술래 악마, 박쥐날개·화살꼬리·연필) | **없음**(정적) | 단상 숨쉬기 연출 유지 |
  | `da71c9fe-2349-4b74-859f-e3ceb6c8bd16` | `gun.glb` (보라 탄창 소총) | 없음 | 총구 = **-X** |
- **왜**: 사용자 지적 — "달리는 게 총 들고 달려야 되는데 그냥 달리긴 해".
- **어디**
  - `assets/models/{shiba,bear,rabbit,cat,devil,gun}.glb` — 6개 전부 Tripo 판으로 교체(각 1.2~3.9MB, 총 18MB).
  - `vendor/addons/utils/SkeletonUtils.js` — three r160 예제 그대로 추가(MIT). 세 곳에서만 쓰는 clipAction 대상.
  - `src/config/models.js`: 캐릭터 `rotateY: Math.PI` (Tripo 원본이 **+Z 를 봄** → 반 바퀴), `gun` 은 `rotateY: -Math.PI/2` (원본 총구 **-X**).
  - `src/client/render/ModelLibrary.js`
    - **리깅 복제**: `get()` 이 `hasSkin()` 이면 `SkeletonUtils.clone(m)` — `clone(true)` 는 스킨·본 연결이 끊긴다. 애니메이션 클립은 `outer.userData.animations` 에 담아 복제본마다 넘긴다.
    - **SkinnedMesh 크기 측정**: `visibleBox()` 가 스킨드 메시는 `applyBoneTransform` 으로 실제 뼈 변형 정점을 재서 상자를 만든다. (Tripo 모델은 geometry 바인드 상자가 실제 몸의 1/2 도 안 돼서, 예전 방식이면 캐릭터가 2배로 커졌다.)
    - **뿌리 이동 제거** `stripRootMotion()`: run/walk 의 Hips 위치 트랙에서 첫 프레임 x·z 를 빼서, 달릴 때 모델이 앞으로 흘러가 충돌 위치와 어긋나지 않게(위아래 통통은 유지).
    - **`userData.grip` / `userData.sight`**: 총 모델에서 손잡이(아래쪽 25% 중 가장 뒤쪽 뭉치)와 가늠쇠 꼭대기를 자동으로 찾는다 → 총 모델이 바뀌어도 1인칭 손·빨간 점이 따라온다.
  - `src/client/render/CharacterRig.js` (신규) — 캐릭터 하나의 애니메이션·자세.
    - `AnimationMixer` + `run`(속도 5.2m/s 초과)/`walk` 클립, 속도에 맞춘 `timeScale`, 정지 시 무게 페이드로 바인드(대기) 자세.
    - **총 든 자세**: 매 프레임 오른팔 2뼈 IK 로 오른손을 어깨 앞(`forward 0.20 / right 0.02 / down 0.05`, 닿는 거리로 자름)에 두고, 상체(Spine2)를 살짝 앞으로 — 달리기 클립 위에 블렌딩(`blendSec 0.18`)한다.
    - **총**: 손뼈 위치를 매 프레임 읽어 `gun.position` 만 옮긴다(뼈에 붙이지 않아 어떤 동작에서도 찌그러지지 않고, 방향은 캐릭터 앞 -Z 고정).
  - `src/client/render/AnimalModels.js`: `createAnimalModel()` 이 GLB + 총 + `createCharacterRig()` 를 묶어 `holder.userData.rig` 로 넘긴다(뼈대 없는 임시 모델이면 예전 자리 `(0.34,0.62,-0.66)`). 1인칭은 `createViewModel()` 이 총의 grip 을 오른발 손목에 맞춰 놓고, 덧대던 사이트 상자는 숨기고 빨간 점만 모델 가늠쇠 위에 놓는다(총 스케일 0.78).
  - `src/client/player/RemotePlayers.js`: `rig.update(dt, 실제 이동속도)` 로 달리기/대기 전환. (예전엔 몸 전체를 흔들어 "그냥 달리는" 느낌이었다.)
- **검증**: 로컬 http.server + Playwright(스위프트셰이더).
  - 로비 5종 단상 스크린샷 `downloads/ink_escape_tripo/lobby_5.png` — 방향·크기·발 위치 정상, 총 없음.
  - 인게임(술래 화면의 3D 무대, 추적 카메라) `downloads/ink_escape_tripo/ingame_run_side.png` / `ingame_run_back.png` — 시바가 총을 오른손에 들고 달리는 모습, 찌그러짐·뒤집힘 없음.
  - 1인칭 `downloads/ink_escape_tripo/first_person.png` — 총 손잡이를 앞발이 쥐고, 빨간 점이 모델 가늠쇠 위.
  - 4종 × 대기/달리기 비교 시트 `downloads/ink_escape_tripo/kinds_sheet.png`.
  - `pageerror 0`, 4xx/404 0. **이 환경에 node 가 없어 `npm test`·`tools/smoke.cjs` 는 여전히 못 돌렸다 — 다음 AI 가 먼저 돌릴 것.**
- **남은 것**: 정지 자세가 바인드(A포즈)라 로비·대기 시 팔이 살짝 벌어져 있다. 대기 클립(idle)이 없어서이며, Tripo 에서 idle 을 뽑아 오면 `CharacterRig` 의 `pickClip(clips,'idle')` 한 줄로 붙일 수 있다. 왼팔은 달리기 클립 그대로 흔들린다(총은 오른손만).

### 2026-11-27 · 1인칭 동물 앞발 GLB 4종 (그림 → 3D 메시) · 손목 90도 꺾임 제거
- **무엇을**: 1인칭 손이 코드 도형(공 조합)이라 손목이 90도로 꺾여 보이던 것을, 동물 4종(시바·곰·토끼·삼색고양이)의 **새 앞발 그림에서 만든 GLB 4종**으로 교체.
  - 원래 계획은 Stable Fast 3D(허깅페이스) 이미지→GLB 변환이었으나, `deok` 계정의 **ZeroGPU 무료 한도가 하루치 소진**(`You have exceeded your free ZeroGPU quota (60s requested vs. 0s left)`)되어 쓸 수 없었다. CPU 로 도는 TripoSR 복제 스페이스들은 모두 generate 단계에서 깨져 있었고, 이 작업 환경은 CPU 2코어라 로컬 추론도 불가 → 사용자가 **"그림 그대로 로컬에서 3D로 만들어 오늘 배포"** 를 선택(2026-11-27 10:0x).
  - **`tools/paw_mesh.py`**: 앞발 그림 1장 → 닫힌 메시 + 그림 텍스처 GLB 생성기. HSV 로 실루엣 마스크(배경 회색은 채도 0 → 색거리 방식은 배경 그라데이션까지 잡아 회색 테두리가 남았다) → 거리변환으로 부피 → 앞/뒤 두 면. 텍스처는 가장자리 색을 배경 쪽으로 28px 번지게 하고, 재질은 `alphaTest 0.5` 로 배경 텍셀을 버린다. 그림 자체에 명암·굵은 잉크 외곽선이 있어 조명 없는 Basic 재질로 그대로 쓴다.
  - **SF3D 가 다시 되면**: 같은 파일 이름(`assets/models/paw_<동물>.glb`)만 덮어쓰면 코드 수정 없이 교체된다.
- **왜**: 사용자 지적 — "손 퀄리티가 너무 구린데 꺾여잇음 심지어".
- **어디**
  - `assets/models/paw_{shiba,bear,rabbit,cat}.glb` (새 파일, 각 3.1~3.3MB)
  - `src/config/models.js`: `paw_*` 4줄 (`size: 0.19`, `anchor: 'center'`, **`lazy: true`**).
  - `src/client/render/ModelLibrary.js`: `lazy` 모델은 `loadAll()` 에서 건너뛰고 필요할 때 `load(name)`; 같은 모델 중복 요청은 `pending` 약속으로 하나만 받는다.
  - `src/client/render/AnimalModels.js`: `createViewModel()` 이 손마다 홀더(Group)를 만들고 `putPaw()` 가 그 안에 GLB 를 넣는다. GLB 가 없거나 실패하면 예전 코드 팔+앞발로 폴백(팔뚝을 대각선으로 바꿔 폴백도 꺾여 보이지 않게). `buildGlbPaw()` 가 쥔 부분을 홀더 원점에 맞추고 왼손은 `scale.x = -1` 미러. `toViewModelMaterial` 이 손대지 않도록 `userData.vm = true`.
  - `tools/paw_mesh.py`(생성기), `art/models/paw/source/`(원본 그림 4장), `art/models/paw/README.md`(다시 만드는 법).
- **자세(튜닝값)**: 오른손(방아쇠) 홀더 `(-0.05,-0.105,-0.005)`, 왼손(총열 받침) `(-0.06,-0.015,-0.17)`·`scale 0.85`, 회전 `rotZ -0.55 / +0.50`, `rotX -0.12`, 쥔 지점 `(-0.16, 0.08)`.
- **검증**: 로컬 http.server + Playwright(스위프트셰이더)로 4종 각각 혼자 테스트 → 1인칭 스크린샷 4장 확인(`downloads/ink_escape_paws/final_{shiba,bear,rabbit,cat}.png`), `pageerror 0`, 4xx/404 0. 4종 색·발바닥 확인, 손목 꺾임 없음(메시가 팔뚝까지 이어진다). **이 환경에 node 가 없어 `npm test`·`tools/smoke.cjs` 는 못 돌렸다 — 다음 AI 가 먼저 돌릴 것.**
- **남은 것**: 앞발이 총 손잡이를 감싸 쥐는 느낌은 아직 약하다(그림이 2D라 손가락이 붙어 보임). 진짜 재구성 모델(SF3D)이 되면 같은 파일명 덮어쓰기로 교체.

### 2026-11-27 · ponytail 스킬 설치
- **무엇을**: 사용자 요청으로 https://github.com/DietrichGebert/ponytail (v5.3.3, 커밋 ebd8654, MIT) 의 스킬 6개를 `.claude/skills/` 에 설치 — `ponytail`(가장 작은 완전한 변경 + 답 끝에 안 한 것·위험), `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`.
- **왜 저장소에**: 클라우드 세션은 매번 새 컴퓨터 → 저장소에 둬야 다음 세션도 쓴다. 플러그인 훅(자동 켜기·작업 기록 CSV/웹훅·상태 표시줄)은 설치하지 않음 — 자세히는 `.claude/skills/ponytail/INSTALLED_FROM.md`.
- **규칙 충돌**: CLAUDE.md "## 스킬" 에 "이 파일의 규칙(SOLID·balance.js·번역·폰트·HANDOFF)이 우선" 명시.
- **검증**: 6개 SKILL.md 의 이름·설명 머리말 확인, 외부 접속·스크립트 실행 없음(글로 된 지침뿐).

### 2026-11-26 · 시바 3D 코드 모델 시험 제작 (img2threejs) + 게임 연결
- **무엇을**: 사용자 요청 "원본 2D 로 캐릭터 하나만 만들어봐" → `assets/source/shiba.png` 를 기준으로 img2threejs 스킬 파이프라인을 돌려 **코드로 만든 시바**(파일 없이 Three.js 도형 ~45개 + 뼈대)를 만들고 게임에 연결. **기본은 기존 GLB 그대로**, 주소에 `?models=code` 를 붙이면 코드 시바로 바뀐다(비교용).
- **결과/한계**: 패스 blockout → structural → proportion-lock → feature-placement → material 까지 리뷰 기록. 실루엣 일치(Tier 1 IoU) 0.87, 360° 구멍 검사 통과. 사용자에게 보여줄 비교: `art/models/shiba/compare-ingame.jpg`(원본 · 현재 GLB · 코드 모델, 로비 화면). 단점(정직하게): 털 질감·그라데이션 없음(단색 도형), 입이 U 미소가 아닌 타원, 반다나가 털색과 비슷해 로비 조명에서 묻힘, 등·꼬리·두께는 정면 한 장에서 추측. GLB(사진 기반)가 더 원본에 가깝고, 코드 모델은 가볍고(텍스처 0) 부위별로 움직일 수 있다는 장점.
- **어디**:
  - 모델 코드 `src/client/render/models/shiba.js` (`createShibaModel`, 순수 JS, `three` 만 import, 160KB) — 스킬이 낸 TypeScript 를 `art/models/shiba/export_game.sh` 가 esbuild 로 묶어 만든다. 손으로 고치지 말고 스펙 → 재생성.
  - 목록 `src/client/render/models/index.js` (`PROCEDURAL_MODELS`, 이름 → 필요할 때만 import).
  - `src/config/models.js`: `procedural` 항목 설명, `MODEL_VARIANTS.code.shiba`, `modelDefsFor(variant)`. `src/main.js` 가 `?models=` 로 고른다. 코드 시바를 기본으로 하려면 그 줄을 `MODEL_DEFS.shiba` 로 옮기면 끝.
  - `ModelLibrary`: `def.procedural` 지원(복제 대신 매번 새로 만듦 — 뼈대 있는 SkinnedMesh 는 clone 하면 깨짐), 완전히 투명한 부품(스킬의 root 상자)은 재질을 꺼서 그리지도 그림자 내지도 않게(`hideClearParts`), 크기 맞춤은 보이는 메시만(`visibleBox` — 처음엔 투명 root 상자가 포함돼 시바가 작고 떠 있었음), 재질 보정은 `def.material` 있을 때만.
  - 작업 파일 `art/models/shiba/`: `reference.png`, `rebuild.sh`/`gates.sh`/`review.sh`/`export_game.sh`, `work/build_spec.py`(스펙 생성기 — 모양 숫자는 여기서 고친다), `work/object-sculpt-spec.json`, `work/.img2threejs/state.json`, `work/renders/`(최종 material-pass 시트 + 단계별 점수 JSON). 중간 그림은 `.gitignore`.
  - 주의: 생성기는 `transform.rotation` 을 라디안으로 읽는다(build_spec.py 에서 변환), 끝점 부품(원기둥·캡슐 등)은 회전 0, 토러스는 반지름 0.45 기준 scale. 미리보기 빌드는 three 0.160 + esbuild 가 필요(스크립트 안 경로 참고).
- **검증**: `npm test` 16 통과. smoke 기본/`?models=code` 둘 다 `errors: []`, `monsters: 1`. 헤드리스로 로비(발이 받침 위, GLB 와 같은 키)·인게임 술래 3D 화면(총 든 몸) 확인, 콘솔 경고 0.

### 2026-11-26 · img2threejs 스킬 설치
- **무엇을**: 사용자 요청으로 https://github.com/img2threejs/img2threejs (v2.0.1, 커밋 0c0c49b, Apache-2.0) 를 프로젝트 스킬로 설치 → `.claude/skills/img2threejs/`. 참고 이미지를 보고 Three.js 코드로 모델을 다시 만드는 단계형 파이프라인(intake → spec → build → review, 스크린샷 비교 반복).
- **왜 저장소에**: 클라우드 세션은 매번 새 컴퓨터라 `~/.claude/skills` 설치가 사라짐. 저장소에 두면 이 프로젝트의 모든 Claude Code 세션이 자동으로 불러옴. (`npx --yes img2threejs@latest install --host claude` 도 이 세션에 실행함.)
- **검토**: 핵심 스크립트는 파이썬 표준 라이브러리만, 외부 통신 없음, 외부 명령은 macOS `sips` 뿐. `integrations/vision` 은 선택 기능(Google 얼굴·자세 모델 다운로드).
- **검증**: 스킬 자체 테스트 `python3 -m unittest discover -s forge/tests` → 1416개 통과(64개 건너뜀), 이 세션 스킬 목록에 img2threejs 표시됨.


### 2026-11-26 · 보급·증강 (플레이어 = 상자 줍기, 술래 = 자동 카드) + 술래 지도 닉네임
- **규칙**: 3·6·9분(`balance.supply.times`)에 맵에 보급 상자가 떨어지고(플레이어에게서 12m 이상, 문에서 8m 이상), 플레이어가 닿으면 그 사람에게 카드 3장(사람마다 1번). 술래는 같은 때 카드 3장이 바로. 10초 안에 고르기(플레이어 1·2·3 키/클릭, 술래 클릭), 안 고르면 방장이 무작위. 수치형 최대 2번, 효과형 1번. 새 보급이 오면 이전 상자는 사라짐.
- **데이터**: 수치 `balance.supply`·`balance.aug`(20개), 목록·아이콘·설명값 `src/config/augments.js`, 문구 `aug.<key>.name/desc`·`supply.*` (ko·en), 실제 수치 계산 `src/shared/augmentMath.js`(서버·화면 공용).
- **서버**: `systems/SupplySystem.js`(상자·줍기·카드·무작위·즉시 적용: 통통한 배·구조대 횟수·새 연필·연필깎이·두꺼운 종이). 나머지 효과는 각 자리: Match(두 번째 심장·간식 탄·재활용·끈적 잉크·투사체 공격력), commands(응원단 피해·지우개 탄 폭발·지우개 장인 최대치), SpawnSystem(그림자 소환 거리·대기, 큰 붓 대기·크기, 쌍둥이 붓, 두꺼운 종이 HP, 소환 잉크 기억), MonsterSystem(바람 물감·뾰족한 심, 지우개 충전, 구조대 부활), StatusSystem(웅덩이 느려짐), 명중 신고 허용량(빠른 앞발·관통). 메시지 `MSG.OFFER`·`MSG.AUG_PICK`, 이벤트 `SUPPLY`·`SUPPLY_TAKE`·`SUPPLY_GONE`·`AUG`·`SPLASH`·`PUDDLE`·`HEART`.
- **화면**: `ui/AugmentPicker.js`(카드 창·가진 증강 아이콘 `augChips`·아이콘 `augIcon` — `aug.<key>` 그림을 assets 에 등록하면 이모지 대신 그림), `render/SupplyCrates.js`(나무 상자+빨간 ! 표시, 떨어지며 쿵, 빛기둥·바닥 고리, 내가 연 상자는 빛 끔, 천장 위 큰 상자 표시 → 술래 3D 탑뷰에서만 보임 `crateIcon`), 술래 2D 지도·미니맵 상자 그림 + "연 사람/전체", 웅덩이. 플레이어 HUD: HP 위 증강 줄, 위쪽 가운데 상자 방향·거리 안내. 술래: 플레이어 카드에 증강 아이콘, 잉크 카드에 내 증강. 1인칭 효과(연사·재장전·이동속도·2단 점프·관통)는 `Weapon`/`FpsController`/`PlayerView.raycast`. 소리 `pickup`·`crate`.
- **술래 지도 닉네임**: `TopDownMap` 얼굴 아래 이름.
- **병합**: 다른 세션이 술래 화면을 DIRECTOR 구성(3D 탑뷰·`TaggerCam`·미니맵)으로 바꾼 것과 병합 — `CornerCam` 삭제, 증강 반영은 `TaggerCam` 소환 금지 고리·`spawnSpot.validSpawnSpot`·새 플레이어 카드·잉크 카드로 옮김.
- **알려진 점**: 혼자 테스트에서는 술래 카드 창이 플레이어 화면에도 뜬다(두 역할을 같이 하므로). 그림(카드 틀·아이콘 20·이펙트)은 아직 이모지·코드 그림.
- **검증**: `npm test` 16/16 (보급 흐름·두 번째 심장·그림자 소환 추가), smoke 통과, 헤드리스 스크린샷(3D 상자·방향 안내·술래 카드 창·플레이어 카드 창·HUD 증강 줄·술래 3D 탑뷰 상자 표시·미니맵), pageerror 0.


### 2026-11-26 · 술래 DIRECTOR 화면(3D 탑뷰·미니맵) + 1인칭 동물 앞발·레드도트·머즐 플래시 (IMG_1239·IMG_1240)
- **무엇을** (사용자 참고 이미지 `IMG_1239`=술래 2분할, `IMG_1240`=1인칭 손·총 분위기)
  - **왼쪽: 실시간 3D 탑뷰** — `TaggerCam`(새 파일)이 `WorldRenderer`(던전·몬스터·동물·문)를 원근 카메라(fov 38, 지평선 43°)로 비스듬히 내려다본다. 맵 네 귀가 화면에 들어오는 거리를 이분 탐색으로 찾고(`resize`), **마우스 휠로 0.42~1.0 배 확대/축소**(기본 0.82). 천장은 레이어 1 이라 안 보이고, 탑뷰에서는 안개를 끄고 위에서 비추는 방향광+보조광+약한 앰비언트를 켠다(`applyMode`). 벽 밑 접지 그림자(그라데이션 판 인스턴스 388장, `buildContactShadows`)로 벽이 솟은 것으로 보이게 함.
  - **왼쪽 위 플레이어 카드**: 동물 얼굴 + 이름 + HP 바 + HP 숫자, 지금 보는 카드에 노란 테두리, 죽으면 회색. 누르면 그 플레이어 머리 위 따라가기 카메라(기존 구석 카메라 기능 이전).
  - **왼쪽 아래 미니맵**: 기존 `TopDownMap` 을 `mini: true` 로 재사용(던전 그림·횃불·문 상태·플레이어 색 점·몬스터 빨간 점). 14fps 로만 그림. 클릭은 받지 않는다.
  - **오른쪽 아래 화면 전환**: `◀ 3D 탑뷰 ▶` / `🎥 이름`. ←→ 키도 그대로.
  - **소환 흐름 유지**: 그림 → SPAWN → 3D 화면 **클릭 또는 드래그**(pointerdown→move→up) → 그 자리 소환. 자리 검사는 `spawnSpot.js`(새 파일) 한 곳으로 모아 3D·2D 가 같은 규칙을 쓴다. Esc·우클릭 취소, 잘못된 자리면 토스트.
  - **오른쪽 DIRECTOR**: `DIRECTOR` 배지 + 상단 컴팩트 `보스 2배`·`올인` 토글, `PENCIL INK` 종이 카드(연필 아이콘·노란 게이지·% / 문 열리면 ∞), **공책 도화지**(왼쪽 스프링 링 + 종이 그림자) + **세로 색 팔레트**(5색 큰 사각형 + 🎨직접 고르기 팝오버(기존 ColorPicker) + ⌫지우개 + 🗑전체 지우기), 그 아래 속성 6칸(C안)·굵기 3단/되돌리기/색 코드·판정 미리보기·재소환 3칸, 맨 아래 큰 빨간 `SPAWN`(기존 art-spawn 버튼 이미지 그대로).
  - **1인칭 동물 앞발**(`AnimalModels.createViewModel`, 새 `buildPawView`/`buildArm`): 동물마다 털색·무늬(삼색고양이 얼룩, 시바 크림 양말, 곰 진한 발끝)·발바닥 젤리·발톱·소매 색 단·손목 털. **굵은 잉크 외곽선**은 각 메시의 BackSide 확대 복제(1.12배)로. 총 손잡이를 쥔 오른발과 총열을 받치는 왼발 두 개. 뷰모델 전용 조명(앰비언트+키+림)을 켜고 재질을 Lambert 로 바꿔 총이 어둠에 잠기지 않게 함(색 ×1.5).
  - **레드도트 사이트**: 총 위에 검은 몸통+붉은 렌즈, 렌즈 앞에 가산 합성 빨간 점 스프라이트(숨쉬듯 밝기 변화). 사격하면 총이 반동한다.
  - **머즐 플래시·궤적 보강**: 총구에 별 모양 불꽃 + 노란 빛무리 두 겹(55ms 동안 부풀었다 사라짐, 매 발사 회전각 랜덤). 전장 궤적은 얇은 Line 에서 **가산 합성 빛줄기(굵은 심+밝은 심지)**로 바꾸고, 총구·명중 지점에 불꽃 스프라이트를 띄운다(`Effects.tracer`/`muzzle`, 다른 플레이어 사격에도 적용).
  - `dom.el` 의 `style` 객체가 `--c` 같은 CSS 변수를 실제로 넣도록 고침(Object.assign → setProperty). 속성 칩·색 팔레트 색이 이제 제대로 나온다(예전엔 빈 칩).
- **왜**: 사용자 요청 — 술래 화면을 IMG_1239 의 DIRECTOR 레이아웃으로, 1인칭 손을 동물 앞발로, 총구 연출을 IMG_1240 처럼.
- **어디**
  - 새 파일: `src/client/tagger/TaggerCam.js`(3D 탑뷰·따라가기·소환 마커·접지 그림자·휠 줌) · `src/client/tagger/spawnSpot.js`(소환 자리 규칙)
  - 삭제: `src/client/tagger/CornerCam.js` (TaggerCam 으로 통합 — 참조 없음)
  - `TaggerView.js`(레이아웃 전면 재작성, 동작·키는 유지) · `TopDownMap.js`(`mini` 모드) · `AnimalModels.js`(뷰모델·앞발·레드도트) · `Weapon.js`(불꽃 두 겹·레드도트 글로우·뷰모델 조명·플래시 시간) · `Effects.js`(빛줄기·총구 불꽃) · `PlayerView.js`/`WorldRenderer.js`(사격 연출 호출) · `App.js`(Tab 안내를 플레이어 화면에만) · `ui/dom.js`(CSS 변수) · `i18n/strings.js`(`tagger.director·inkTitle·minimap·topView·customColor`, hint·camView 문구) · `style.css`(술래 화면 블록 전면 교체)
- **주의**
  - 3D 탑뷰의 소환 클릭은 **pointerup** 에서 확정된다(드래그 지원). 좌표는 `TaggerCam.pickFloor` 가 활성 카메라로 바닥 평면과 교차해 구한다 — 줌·따라가기 어느 쪽이든 같은 함수.
  - 탑뷰 3D 는 40fps 로만 그린다(`RENDER_FPS`). 미니맵은 14fps. 플레이어 화면과 동시에 돌 때 부담을 줄이기 위함.
  - 천장(레이어 1)은 플레이어 카메라만 보므로 탑뷰에서 던전이 다 보인다. 탑뷰에서는 `scene.fog` 를 끈다(카메라가 멀어 안개에 다 잠김).
  - 뷰모델은 이제 조명을 받는다(`Weapon.vmScene` 에 앰비언트·키·림). 새 손·총 메시를 추가하면 `userData.vm` 을 세워 `toViewModelMaterial` 이 건드리지 않게 할 것.
  - `TopDownMap` 의 `this.mini` 는 **불리언**(미니맵 모드)이다. 몬스터 미니 그림 함수는 `monsterMini(id)` 로 이름을 바꿨다(예전 `mini(id)`).
- **main 최신과 통합** (2026-11-26): 그 사이 다른 세션이 올린 보급·증강·UI 키트·그래픽 품질·총 조준/탄흔/빛줄기 커밋을 병합했다.
  - `Effects`: 그쪽 `tracer`(원기둥 두 겹, 내 총은 총구를 따라감)·`bulletHole` 을 그대로 쓰고, 내 `muzzle()`(총구 불꽃 두 겹)만 더했다.
  - `Weapon`: 그쪽 `aimGun`(총신을 조준점으로)·`VIEW_POS`·`muzzleWorld` 위에 내 뷰모델 조명·불꽃 두 겹·레드도트를 얹었다. **레드도트 사이트와 빨간 점은 `aimGun` 의 회전 대상에 포함**(`userData.paws` 는 배열, `userData.sightObj`)시켜야 총과 같이 움직인다.
  - `CornerCam` 은 `TaggerCam` 으로 합치면서 그쪽의 `gfx`(안티앨리어스·픽셀 비율)와 `WorldRenderer` 의 `balance` 인자를 옮겼다. `CornerCam.js` 는 삭제.
  - `style.css`: UI 키트 블록은 그대로 두고 술래 화면 블록만 내 것으로 교체. `.toggle` 은 내 블록에서 정의(키트에 없음).
- **검증** (헤드리스 크로미엄 + swiftshader, 1600×900)
  - **로컬 확인은 서비스 워커를 끄고 해야 한다**(`sw.js` 가 `v/<배포시각>/` 주소로 옛 코드를 계속 준다 — Playwright 는 `new_context(service_workers='block')`). 끄지 않으면 코드를 고쳐도 화면이 그대로여서 "수정이 안 먹는다"고 착각하게 된다.
  - 시바·곰·토끼·삼색고양이 1인칭: 손+총 정지/사격(불꽃·궤적) 스크린샷을 직접 눈으로 확인. 동물별 털색·무늬·소매·발바닥 확인.
  - 술래: 3D 탑뷰(DIRECTOR 전체·왼쪽·오른쪽·미니맵) / 플레이어 카드 → 따라가기 / 그림 → SPAWN → 화면 클릭 소환(잉크 99%, 재소환 칸 생성, 빈 자리 토스트) / 한국어 화면.
  - `pageerror 0`, 4xx·404 0 (모든 실행 — 병합 뒤 다시 촬영).
  - 배포 사이트 `https://dhshlove01-lang.github.io/Ink-Escape/` 에서도 같은 화면 확인(pageerror 0, 4xx 0). Pages 빌드 `built`(커밋 3f2dc83, 66초).
  - 스크린샷: `downloads/ink_escape_ui_hands/` (`live_tagger.png`·`live_player.png` = 실제 배포 사이트) (`player_{동물}_{hands,hands_zoom,fire}.png`, `tagger_director/left_topview/right_director/minimap/follow/placing/spawned/ko.png`).
  - **이 작업 환경에는 node 가 없어 `npm test`·`tools/smoke.cjs` 를 못 돌렸다 — 다음 AI 는 먼저 돌릴 것.** (모듈 로드는 브라우저에서 전부 성공, pageerror 0 이라 문법 오류는 없다.)
- **알려진 다듬을 점**
  - 3D 탑뷰는 맵 전체가 들어오게 맞추면 카메라가 멀어 평면 지도처럼 보인다. 기본 0.82배(휠로 더 당길 수 있음)로 두었고, 그 상태에서도 벽 옆면은 얕게 보인다. 더 입체적으로 보이려면 기본 배율을 0.6 근처로 낮추거나 탑뷰 전용 벽 높이/그림자를 키우면 된다.
  - 앞발은 코드 모델(공·원기둥)이다. 손가락이 총을 감싸 쥐는 모양은 단순화되어 있어, 진짜 GLB 앞발로 바꾸면 더 좋다(다음 할 일 8번).
  - 미니맵은 `TopDownMap` 배경을 그대로 줄여 써서 작은 글씨·디테일은 뭉개진다.
### 2026-11-26 · 밸런스 1차 (사용자 결정 반영)
- **분석**(명중률 60% 가정): 4인 팀 DPS 180, 일반 몬스터(잉크 20, HP 600) 3.3초, 보스 20초, 술래 한 판 총 잉크 1140 = 몬스터 HP 34,200 → 팀이 약 3.2분이면 다 지움. 달리기 무제한(6.5m/s) > 몬스터(4.5m/s), 지우개 즉사(1인 판당 ~7개) → 플레이어 크게 유리로 판단.
- **바꾼 것**: 달리기 기력 `balance.player.stamina`(4초 달리면 바닥, 0.8초 쉬고 5초에 가득, 30% 차야 다시 달림) — `FpsController.updateStamina`, HUD HP 막대 아래 기력 막대(바닥나면 빨강). 지우개 수류탄 일반 몬스터 `grenade.normalPct` 0.6 (`MonsterSystem`). 안 쓰는 `judge.dualRatio`(옛 혼합 속성) 삭제.
- **아직 안 바꾼 것**: 잉크 양·회복, 몬스터 HP/잉크. 기력·지우개 변경만으로 술래 쪽이 꽤 세지므로 실제로 해 보고 조정 (명중률 45% 기준이면 4인 팀 DPS 135, 일반 몬스터 4.4초).
- **검증**: `npm test` 14/14 (지우개 60%·기력 테스트 추가 — `tests/stamina.test.mjs`), smoke 통과, HUD 스크린샷.


### 2026-11-26 · 그래픽카드 팬 소리 줄이기 (그래픽 품질 설정)
- **원인(측정)**: 그리기 호출은 프레임당 ~16번으로 적음. 부담은 픽셀 수 — 1920×1080 을 4배 안티에일리어싱 + 조명 9개를 모든 픽셀에서 계산 + 큰 빛무리 스프라이트 겹침. 게다가 창이 뒤에 있어도 60번, 로비도 60번, "고성능 GPU 우선".
- **해결**: `src/config/graphics.js` (낮음/보통/높음: 그리는 최대 가로 px 1100/1600/전체, fps 45/60/60, 실제 빛 주는 횃불 2/3/4, 안티에일리어싱 끔/켬/켬), `src/client/render/GraphicsSettings.js` (`gfx` — 저장·변경 알림·`pixelRatio(w)`·`frameInterval(cap)`). 기본 보통. 창이 포커스를 잃으면 초당 15번, 로비·결과 3D 무대는 초당 30번(`MENU_FPS`). `powerPreference: high-performance` 제거. 시작 화면·로비 위 "그래픽 낮음|보통|높음" (`gfxPicker`). 해상도는 바로, 안티에일리어싱·횃불 빛 수는 다음 판부터.
- **어디**: PlayerView·CornerCam·CharacterStage(resize 에서 setPixelRatio, 렌더러 옵션), App.loop·CharacterStage tick(빈도), SceneBuilder(TORCH_LIGHTS).
- **검증**: 1920×1080 에서 플레이어 캔버스 낮음 1100×618 / 보통 1600×900 / 높음 1920×1080, 로비 무대 정상, pageerror 0, `npm test` 12/12, smoke 통과.


### 2026-11-26 · 로비 개선 · UI 키트 14종 적용 · 총 궤적/총알 자국 · 탈출문 다듬기
- **UI 키트** (`inkescape9ui14.zip` → 원본 `assets/source/ui14/`): `tools/process_ui_kit.py` 로 #00FF00 배경 제거(가장자리에서 이어진 초록만 지움 → 12번 초록 체크는 남음), 상태 스트립은 README 좌표로 잘라 `assets/ui/kit/*.webp`. `config/assets.js` 의 `kit.*` 가 모두 불러와지면 `main.js` 가 `--kit-*` 변수 + body `art-kit` → `style.css` 맨 끝 블록이 9-slice(border-image)로 버튼(빨강/검정/누름·올림)·비활성·나가기(X)·역할/시간 칩(고른 것 노랑)·큰 판(시작/로비)·캐릭터 카드·입력칸(공책)·팝업(빨간 띠)·경고 알림에 씌움. 방장 왕관·READY 체크도 키트 그림(`icon()`), 없으면 이모지. 토글·슬라이더·탭바·리본은 만들어 두기만 함(아직 쓰는 곳 없음).
- **로비 배치**: 참가자 한 줄(얼굴·이름·왕관·역할 칩·READY·핑), 역할 3개·시간 3개 한 줄, 노란 테두리 outline→border(잘림 해결), 오른쪽 스크롤 없음(5명도 1366×768 에 들어감). 혼자 테스트는 역할 칩이 "술래 + 플레이어".
- **로비 배경 = 맵 테마**: `src/config/themes.js` (THEMES·MAP_THEME·themeFor). 전장(`SceneBuilder`)과 로비(`CharacterStage.setTheme` → `buildThemeRoom`: 칸 크기 돌벽·기둥·게임과 같은 벽 횃불·천·크레용 원·낙서)가 같은 테마. 서버 `Lobby.settings.mapId`('dungeon') → 로비가 받아 배경, 경기도 이 맵. 맵 고르기를 만들면 mapId 만 바꾸면 됨.
- **로비 딴짓**: `CharacterStage` — 몇 초마다 인사(꾸벅)·두리번·기지개·깡총·한 바퀴·갸우뚱 (`pickAct`·`actPose`). 술래(역할 술래 또는 악마)는 숙여서 연필로 단상 위에 빨간 크레용 낙서(별·하트·나선·스마일·지그재그, `makeDoodlePlane`), 끝나면 서서히 지워짐. 악마 모델은 원래 연필을 들고 있어 따로 안 붙임.
- **술래 악마 얼굴**: 2D 초상화가 뿔 색으로 머리를 칠하고 눈이 배와 같은 색이라 얼굴이 안 보였음 → `drawDevilFace`(까만 머리·빨간 뿔/귀·흰 눈+빨간 눈동자·송곳니 웃음).
- **총**: 궤적이 70ms 동안 전장에 고정돼 화면을 돌리면 총구에서 밀려 보였음 → 내 총알 궤적은 사라질 때까지 매 프레임 지금 총구에서 시작(`Effects.tracer(follow)`, `Weapon.muzzleWorld`). GLB 총이 22° 비스듬해 총신과 총알 선이 어긋남 → `Weapon.aimGun`(꼭짓점 주성분 축이 화면 가운데 15m 점을 향하게, 손도 같이). 반동은 위로 덜·뒤로 더. 궤적은 원기둥 두 겹(심+빛)으로 굵게, 내 총알은 화면에서 일정한 굵기. **벽·기둥·바닥·천장 총알 자국** 5초(`balance.gun.holeSec`·`holeMax`, `Effects.bulletHole`, 면 판단 `player/surface.js`, 남의 총알도). 문에는 안 남김.
- **탈출문**: 열쇠구멍이 자물쇠 앞면과 같은 면이라 깜빡여 깨져 보였음 → 튀어나온 쇠판 + 한 덩어리 열쇠구멍 모양. 문 옆 배너가 문틀 기둥에 가려짐 → 바깥(hw+2.05)으로. 문 근처 4칸엔 횃불을 안 달고(`maps.js nearDoor`), 랜덤 배너는 뒤가 진짜 벽·문 8m 밖·횃불/다른 배너와 안 겹칠 때만(`DungeonKit.bannerFits`).
- **검증**: 헤드리스 크로뮴 스크린샷 — 총(궤적 정렬·화면 돌린 뒤·벽 자국 가까이), 로비 1명/5명(1366·1475, 스크롤 0), 딴짓 자세·낙서, 악마 얼굴, 문 3곳(자물쇠·배너), 시작 화면·코드 팝업·조작법 팝업·술래 화면(키트). pageerror 0, `npm test` 12/12, smoke 통과.


### 2026-11-26 · 옛 화면 절대 안 뜨게 (자동 새로고침)
- **문제**: GitHub Pages 는 파일을 10분 캐시(`max-age=600`) → 배포 직후 옛 화면. 게다가 크롬은 한 번 받은 CSS·JS 를 메모리 캐시에 두고 F5 에도 재사용(서비스 워커보다 앞단)해서 서비스 워커만으로는 부족했음.
- **해결**:
  1. `sw.js` (서비스 워커): 이 사이트 파일은 매번 서버에 확인(`cache: 'no-cache'`, 안 바뀌면 304). `v/<배포시각>/…` 주소를 진짜 파일로 연결(응답을 `new Response` 로 감싸 모듈 기준 주소가 v/… 로 남음 → 안쪽 import 도 전부 v/…).
  2. `index.html` 로더: 배포 시각 = `document.lastModified`(GitHub Pages 는 배포마다 모든 파일 Last-Modified 를 배포 시각으로). `style.css`·`src/main.js` 를 `v/<시각>/` 로 불러 배포마다 주소가 새로움. 서비스 워커를 못 쓰면 `?v=<시각>`. `window.BUILD_STAMP`.
  3. `src/client/UpdateWatcher.js`: 1분마다·창으로 돌아올 때 `index.html` HEAD 의 Last-Modified 가 BUILD_STAMP 보다 새로우면 'update'.
  4. `App.onUpdate`: 시작 화면이면 즉시 새로고침, 방·경기 중이면 알림(`common.updateReady`) 후 시작 화면으로 돌아갈 때 새로고침. `ensureLatest()`: 방 만들기·참가·혼자 테스트 직전에 한 번 더 확인 → 새 버전이면 들어가지 않고 새로고침.
- **주의**: `index.html` 에 `<script type="module" src="src/main.js">`·`style.css` 링크를 다시 넣지 말 것(로더가 넣음). `sw.js` 는 되도록 고치지 않음. 그림·모델(assets/)은 주소가 안 바뀌니 바꿀 땐 새 파일 이름 권장.
- **검증**: GitHub Pages 처럼 `max-age=600` 주는 로컬 서버로 — 배포 흉내(css·js·index.html 변경) 후 시작 화면 자동 새로고침 → 새 CSS·새 문구 적용, F5 도 새 파일, 로비에선 알림만·나가면 새로고침, 혼자 테스트 누를 때 새 버전이면 새로고침. 첫 방문 0.4~0.5초. `npm test` 12/12, smoke 통과, pageerror 0.

### 2026-11-26 · 맵 비주얼 업그레이드 + 탈출문(아치·철창·X사슬·자물쇠) 연출
- **무엇을** (사용자가 보낸 참고 이미지 `IMG_1240`(1인칭)·`IMG_1239`(탑뷰) 분위기에 맞춤)
  - **던전 비주얼**: 벽·바닥·기둥에 노멀맵(텍스처 밝기로 소벨 생성)을 입혀 횃불 빛에 돌 요철이 살아나게 함. 벽 윗면 캡(어두운 무늬돌)·걸레받이·굵은 검은 잉크 외곽선(BackSide 확대 인스턴스) 추가. 기둥에 머리·받침. 천장은 기존 레이어 1 방식 유지. 안개 `Fog(0x0a0712, 11, 64)` + 헤미스피어 1.05 + 차가운 림 디렉션이 + 따뜻한 보조광.
  - **횃불**: 쇠 받침(판·비스듬한 손잡이·잔) + 불꽃 스프라이트 + 큰 빛무리 스프라이트(가산). 빛은 기존처럼 카메라에서 가까운 4개만(`TORCH_LIGHTS`), 세기 46.
  - **소품**: 나무통(라테)·쇠테·나무상자·잔돌·보라 배너(분필 왕관)·벽 사슬을 고정 시드로 배치, 인스턴스 메시로 그림. 중앙 홀 바닥에 큰 빨간 크레용 원.
  - **탈출문**(`src/client/render/EscapeGate.js` 새 파일): 석재 아치(쐐기돌 9개·문틀·기둥·받침·띠) + 철창 양문(문틀 경첩, **안쪽으로** 열림) + **X자 사슬 4가닥**(링크 인스턴스, 늘어짐 계산) + **중앙 자물쇠**(어두운 쇠 몸통·붉은 네온 테두리 라인·열쇠구멍·리벳·걸쇠 반원·크레용 광채 스프라이트) + 문 너머 탈출구 빛(문 모양 그라데이션 스프라이트·바닥 빛) + 통로 끝 벽.
  - **열림 연출**(총 2.9초): ① 자물쇠가 확 번쩍이며 문이 덜컹 ② 걸쇠가 튀어나가고 자물쇠가 회전하며 낙하·페이드 ③ 사슬이 팽팽→늘어짐→낙하·페이드 ④ 철창 두 짝이 easeInOut 으로 안쪽으로 열리며 ⑤ 탈출구 빛이 차오름. 이미 열린 뒤 화면이 만들어지면(늦은 접속·화면 전환) `open(i, true)` 로 연출 없이 열린 상태.
  - **술래 탑뷰**(`TopDownMap`): 배경을 다시 그림 — 2×2 석판 바닥·벽 돌블록(윗면 하이라이트+홈)·벽 밑 그늘·네모 기둥머리·문 입구 통로/문틀. 매 프레임 횃불 빛무리(따뜻한 주황, 플리커)·소품 실루엣(`planProps` 공유)·문 3곳(철창 → 공개 시 붉은 광채+X사슬+자물쇠 → 열림 시 밝은 탈출구 빛)·가장자리 비네트.
- **왜**: 사용자 요청 — 참고 이미지 수준으로 맵과 탈출문/자물쇠/열림 연출 업그레이드.
- **어디**: `src/client/render/DungeonKit.js`(새로: 텍스처·노멀맵·재질·소품 배치·횃불·문양) · `src/client/render/EscapeGate.js`(새로) · `src/client/player/SceneBuilder.js`(재작성 — 기존 천장 레이어·조명 4개 풀·낙서 배치 로직 유지) · `src/client/render/WorldRenderer.js`(`openDoor(i, true)` 인자) · `src/client/tagger/TopDownMap.js`(배경·문·횃불·소품).
- **주의**
  - 서버 판정은 그대로다: `ClockSystem` 이 `EV.DOOR_OPEN` 을 쏘고 `GameSession.setDoorOpen` → `WorldRenderer` → `buildScene.openDoor`. **문이 서버에서 열리는 시점과 화면 연출(2.9초)은 별개** → 연출 중에도 플레이어는 통과할 수 있다. 판이 끝나는 순간이라 실제로는 거의 문제되지 않지만, 필요하면 `SWING_START/SWING_TIME` 을 줄이면 된다.
  - 조명 개수 고정 원칙 유지: 문 쪽 빛은 `doorLight`(자물쇠·붉은 광채)와 `exitLight`(탈출구) **두 개만** 만들어 예고/열린 문으로 옮겨 단다. `EscapeGate` 는 빛을 직접 만들지 않고 `lockLevel`·`exitLevel`·`lockPos()`·`exitPos()` 만 제공한다.
  - 천장(레이어 1) 때문에 **빛기둥은 문 안쪽(높이 14m)에만** 두어 문 너머로 보이게 했다.
  - 술래 탑뷰는 2D 캔버스라 소품 위치를 `DungeonKit.planProps()` 로 3D 와 공유한다. 소품을 늘리려면 이 함수만 고치면 양쪽이 맞는다.
- **검증** (헤드리스 크로미엄 + swiftshader, 1280×780)
  - 1인칭 닫힌 문(10m/5.5m/비스듬) · 중앙 홀 전경 · 술래 탑뷰(닫힘/공개) · 열림 연출 0.3s/1.0s/1.9s/2.8s/3.9s · 술래 탑뷰(열림)까지 스크린샷 촬영 후 직접 눈으로 확인. `pageerror 0`, 4xx 0.
  - 스크린샷: `downloads/ink_escape_map_gate/final_*.png`.
  - **이 작업 환경에는 node 가 없어 `npm test`·`tools/smoke.cjs` 를 못 돌렸다 — 다음 AI 는 먼저 돌릴 것.** (모듈 로드는 브라우저에서 전부 성공했고 pageerror 0 이라 문법 오류는 없다.)
- **알려진 다듬을 점**: 자물쇠가 가까이서 보면 붉은 판처럼 보인다(원거리 실루엣 위주). 천장이 매우 어두워 올려다보면 거의 검정.

### 2026-11-26 · 시작 화면 소개 문구 5개 무작위
- **무엇을**: 로고 아래 소개 문구를 유저 친화 문구 5개(`title.sub1`~`sub5`, ko·en) 중 하나로, 시작 화면에 들어올 때마다 무작위. 언어를 바꿔도 같은 번호 유지.
- **어디**: `screens.js` (`SUB_COUNT`, `TitleView.subNo`), `strings.js` (옛 `title.sub` 삭제).
- **검증**: 브라우저 12번 열어 ko/en 5개 모두 나옴, pageerror 0, `npm test` 12/12.


### 2026-11-26 · 시작 화면 정리 (팝업 2개)
- **무엇을**: 위쪽 동물 얼굴 줄·"닉네임" 흰 글씨 제거 → 전체 배치를 위로. 닉네임 칸은 방 만들기와 같은 주아 글씨·가운데 정렬. 방 코드 칸+참가 버튼 → 빨간 긴 **참가하기** 버튼 하나, 누르면 가운데 팝업(방 코드 칸: 큰 글씨·가운데, 취소/참가). 아래로 펴지던 조작법 → 잘 보이는 **🎮 조작법** 버튼 + 가운데 팝업(플레이어/술래/혼자 테스트 칸, 문장을 ' · ' 로 나눠 줄 목록).
- **왜**: 사용자 요청 (닉네임 두 번 표시, 조작법이 잘 안 보임).
- **어디**: `src/client/ui/screens.js` (`modalBox` 공용 팝업 — 배경 클릭·Esc 로 닫힘, `TitleView.build`), `style.css` (`.title-input`·`.code-input`·`.modal-*`·`.howto-btn`·`.howto-sec`, 빈 `.title-status` 는 숨김), `strings.js` (`title.joinRoom`·`title.joinTitle`·`common.cancel`·`common.ok`, ko·en).
- **검증**: 헤드리스 크로뮴 ko/en 스크린샷(시작 화면·조작법 팝업·코드 팝업), pageerror 0, `npm test` 12/12, smoke 통과.


### 2026-11-26 · 속성을 색과 분리(C안) · 플레이어 따라가기 카메라 · 천장 뚫림 방지
- **C안**: 속성은 술래가 고름 — 술래 화면에 `속성: — 기본 · 🛡 방어 · 🔥 화염 · ❄ 빙결 · ⚡ 번개 · ☠ 독` (숫자키 0~5). 색(컬러 피커)은 꾸미기만. `StatCalculator.attributesFrom(opt.attr)`, 소환 메시지에 `attr`, 방장 `SpawnSystem` 이 검사. 기본(속성 없음)은 효과 없음·종이색 오라. (획의 `c` 는 이제 칠한 칸 표시용일 뿐)
- **따라가기 카메라**: 술래 화면 아래 플레이어 카드가 버튼 → 누르면 그 플레이어 머리 위(벽 위 6m)·뒤 5m 에서 따라가며 내려다봄, 보는 카드는 노란 테두리. (`CornerCam.followSpot`, `TaggerView.setView`)
- **천장 뚫림 방지**: `balance.monster.maxHeight` 5.4m(꼭대기 한계), 큰 비행 몬스터는 `flyY` 를 낮춰(최저 0.6m) 꼭대기가 한계 아래로. 화면에서도 흔들림·등장 연출 중 그림 꼭대기·아이콘·HP 막대를 천장 아래로 잡음 (`MonsterRenderer` CEIL).
- **검증**: `npm test` 12/12 (속성 선택·키 한계 테스트 추가), 스크린샷(속성 버튼·빙결 보스·따라가기 카메라·천장 아래 보스), smoke 통과.

### 2026-11-26 · 1인칭 손·총 위로 낙서가 덮이던 버그, 총구 불꽃 위치, 낙서 위치, 천장
- **손·총**: 깊이 검사 없이 그리면 깊이도 안 써서 나중의 반투명 낙서가 덮었다 → 손·총을 별도 장면(`Weapon.vmScene`/`vmCam`, 카메라 기준 좌표)으로 빼서 전장 다음에 깊이만 지우고 그린다(`PlayerView.update`).
- **총구**: `ModelLibrary` 가 `tip: '-z'` 인 모델에서 가장 앞쪽 점들의 평균을 `userData.tip` 으로 저장 → `Weapon.placeFlash` 가 매 프레임 그 자리에 불꽃, 총알 궤적도 거기서 시작(카메라 행렬로 전장 좌표 변환).
- **벽 낙서**: 가운데만 검사하던 것을 낙서 폭 전체 + 여유 30cm 뒤가 진짜 벽(`TILE.WALL`)일 때만 → 모서리 밖·통로·탈출 문(닫힌 문은 solid 라 걸렸음)에 안 붙음. 바닥 낙서도 네 귀퉁이가 바닥일 때만.
- **천장**: 벽 높이(7m)에 천장, 레이어 1 → 플레이어 카메라만 봄(술래 구석 카메라는 벽 위에서 보므로 안 보임). 몬스터 키 상한 `balance.monster.maxHeight` 6.4m(비행이면 3m 빼고) — 보스·초대형이 천장을 뚫지 않게.
- **검증**: 스크린샷(바닥 내려다보며 사격, 천장, 탈출 문 앞, 술래 카메라), `npm test` 12/12, smoke 통과.

### 2026-11-26 · 소환 순서 변경 + 컬러 피커 + HP·보스 바 틀 맞춤
- **소환 순서**: 그림 → SPAWN(Enter) → "지도 클릭!" 상태(지도 빨간 테두리·안내) → 탑뷰/3D 구석 카메라 클릭 = 그 자리 소환. 재소환 칸도 같은 방식. Esc·우클릭 취소, 잘못된 자리면 안내 후 계속 대기. (`TaggerView.beginPlace / onPick / cancelPlace`)
- **컬러 피커**: 5색 버튼 → 채도·밝기 네모 + 색상 막대(`src/client/tagger/ColorPicker.js`), 옆에 "속성 → 아이콘 이름". 1~5 키는 기본 색. 획에 실제 색 `rgb` 저장(`DrawingPad`), 그림에도 그 색 그대로(`PaperCutout`).
- **속성 판정**: `attributes.nearestPaletteIndex` — 채도 22% 미만 또는 밝기 25% 미만은 검정(방어), 나머지는 색상(무지개 위치)이 가장 가까운 기본 색. 처음엔 Lab 거리로 했으나 진한 파랑이 보라로 나와서 색상 기준으로 바꿈. 방장은 `sanitizeStrokes` 에서 rgb 로 속성을 다시 계산(조작 방지, 테스트 있음).
- **HP·보스 바**: 채움이 틀 밖으로 나오던 문제 → 틀 안쪽 빈칸을 픽셀로 재서 border-image 로 양 끝 장식은 그대로, 가운데만 늘임 (`style.css` art 블록).
- **레이아웃**: 피커 때문에 오른쪽이 화면 밖으로 넘치던 것 → 도화지가 남는 공간에 맞춰 정사각형으로 줄어듦(container query).
- **검증**: `npm test` 12/12, 헤드리스로 피커 클릭 → 마우스로 그리기 → SPAWN → 지도 클릭 → 파랑 몬스터 소환, HUD 바 스크린샷, pageerror 0.

### 2026-11-26 · 성능(팬·프레임 드랍) + 횃불 벽에 붙이기
- **원인**: 실시간 조명 13개(횃불 9·문 3·소환 원마다 추가) → 모든 픽셀이 매번 13개 계산. 소환 때 조명 수가 바뀌어 셰이더 재컴파일(순간 끊김). 프레임 제한 없음(144Hz 모니터면 초당 144번). 해상도 배율 1.5.
- **고침**: 조명 6개 고정(반구광 1 + 횃불 빛 4개를 카메라에서 가까운 횃불로 매 프레임 옮김 + 문 빛 1개), 소환 원 조명 삭제(빨간 바닥이 대신), 60fps 제한(App 루프·로비 3D), 해상도 배율 1.
- **횃불**: 방 위·아래 벽 가운데가 통로 구멍이면 옆 실제 벽 칸으로 옮겨 18개, 받침판+비스듬한 손잡이+불꽃으로 벽에 붙임.
- **어디**: `SceneBuilder`(torch pool·doorLight), `WorldRenderer.update`(카메라 위치 전달), `MonsterRenderer`(조명 삭제), `maps.js` 횃불 위치, `App.loop`, `CharacterStage` tick, 각 렌더러 `setPixelRatio(1)`.
- **검증**: 조명 6개 확인, 횃불 스크린샷, `npm test` 11/11, smoke 통과. (스모크는 브라우저 언어가 영어라 버튼을 글씨 대신 클래스로 찾도록 수정)

### 2026-11-26 · 한국어/영어 언어 선택
- **무엇을**: 번역 사전 `src/shared/i18n/strings.js`(ko·en, 약 260 키) + `src/client/i18n.js`(t·tr·setLang·onLangChange, 이 브라우저에 기억, 첫 실행은 브라우저 언어). 시작 화면·로비 오른쪽 위에 `한국어 | English` 버튼. 언어를 바꾸면 시작 화면·로비가 그 자리에서 다시 그려짐(입력한 이름·코드 유지). 경기 화면은 시작할 때의 언어.
- **방장 서버 문장 → 키**: 로비 오류, 소환 실패 사유(StatCalculator·SpawnSystem), 경기 결과 사유(Match·core·GameServer), 결과 정산·뱃지(results.js)가 `{ key, params }` 를 보낸다 → 참가자마다 자기 언어로 보임. 맵·문 이름, 속성·색·특성·캐릭터 이름도 키로.
- **주의(겪은 버그)**: 받은 메시지 변수 이름이 `msg` 인 파일(SpawnSystem·GameServer)에선 번역 함수를 `say` 로 바꿔 씀. 화면에서도 지역 변수 `t` 가 번역 함수를 가려서 이름을 바꿈.
- **검증**: `npm test` 11/11, 헤드리스로 영어 시작·로비(3D 이름표 포함)·술래 화면, 한국어로 다시 전환, pageerror 0.

### 2026-11-26 · 상업용 폰트 저장·적용
- **무엇을**: 주아·Luckiest Guy·Pretendard·개구 woff2 를 `assets/fonts/` 에 넣고(라이선스 포함, 5.5MB 이지만 글자 범위별 조각이라 필요한 것만 내려받음) 구글 폰트 서버 링크 제거. CSS 토큰 `--font-display/num/body/hand`, 버튼·토글은 주아, 타이머·HP·탄약·SPAWN·READY·점수는 Luckiest Guy, 캔버스 이름표도 주아. 시작 전에 `document.fonts.load` 로 준비.
- **왜**: 사용자 요청 — 상업용 가능한 폰트, Steam(오프라인) 대비.
- **어디**: `assets/fonts/`(fonts.css, README.md), `index.html`, `style.css` 토큰, `main.js`, `CharacterStage.js`·`RemotePlayers.js` 캔버스 글씨, `CLAUDE.md` 규칙.
- **검증**: 헤드리스 스크린샷(시작·HUD) 폰트 적용 확인, pageerror·404 0.

### 2026-11-26 · 폴가이즈 스타일 3D 대기실 · 결과 화면 + 캐릭터 5종 GLB
- **무엇을**
  - **3D 로비 대기실**: 던전 무대(돌바닥·벽 낙서·횃불 2개)에 캐릭터마다 단상 하나. 캐릭터가 숨쉬고(스쿼시·스트레치) 좌우로 흔들리고 가끔 깡총 뛴다. 머리 위 이름표(캔버스→스프라이트)에 이름·역할·READY, 내 캐릭터는 노란 링+이름표 테두리. 카메라는 인원수에 맞춰 자동 프레이밍(1~5명), 아주 느린 흔들림.
  - **캐릭터 선택 5종**: `ANIMALS` 에 `devil`(술래 악마) 추가 → 시바·곰·토끼·삼색고양이·술래 악마. 임시(코드) 모델에도 악마(검은 털·빨간 뿔·날개·꼬리·빨간 눈)를 그린다. `drawAnimalFace` 도 뿔/빨간 눈 처리.
  - **READY**: 로비에서 `READY` 버튼 → 서버 `Lobby.setReady` → 로비 상태(`ready`) → 3D 이름표에 `READY` 배지 + 참가자 카드 초록 표시 + 방장 화면에 `n/m READY`(전원이면 시작 버튼에 초록 글로우). **표시만** 하고 방장 시작을 막지는 않는다(기존 동작 유지).
  - **결과 화면**: 화면 전체가 3D 무대 — 가운데 단상에 내 캐릭터가 서서 천천히 돌고 깡총 뛴다(스포트라이트·금색 링). 왼쪽 = 실제 판 기록 기반 뱃지(최다 처치·보스 막타·탈출 성공·팀원 부활·지우개 명중·끝까지 생존), 오른쪽 = 내 점수 정산(생존 시간·몬스터 처치·보스 처치·부활·기여·탈출 보너스·총점) + 전체 점수 순위, 아래 = `로비로 돌아가기`(끊겼으면 `시작 화면으로`).
  - **캐릭터 5종 GLB 적용**: `assets/models/{shiba,bear,rabbit,cat,devil}.glb` — 3D 대기실·결과 화면·인게임 다른 플레이어 몸에 모두 적용(몸에는 총도 함께 든다). GLB 가 없거나 늦게 오면 임시 모델로 그리고 도착하면 그 자리에서 바꿔 끼운다.
- **왜**: 사용자 요청 — 폴가이즈 스타일 대기실/결과 화면, 캐릭터 5종 GLB 적용.
- **어디**
  - `src/client/ui/CharacterStage.js`(새로): 무대(바닥·벽·낙서·횃불·단상·스포트라이트) + 캐릭터 배치/애니메이션 + 이름표 스프라이트. `setCharacters(list, { me, ownerId, solo })`.
  - `src/client/ui/screens.js`: `LobbyView` 를 "DOM 한 번 만들고 값만 갱신"으로 재작성(3D 화면이 매 렌더마다 새로 만들어지지 않게), `ResultView` 재작성. `pause/resume/destroy` 로 경기 중에는 3D 를 멈춘다.
  - `src/client/App.js`: `showTitle` 에서 `lobby.destroy()`, 결과→로비 복귀 시 `lobby.resume()`.
  - `src/shared/protocol.js`: `MSG.READY`, `ANIMALS`+`devil`, `ANIMAL_NAMES.devil`.
  - `src/server/Lobby.js`(`setReady`·`allReady`·`taggerAnimal`), `GameServer.js`(READY 처리), `entities.js`(통계 필드·술래 animal), `Match.js`(`finish` 에 생존 시간·부활·지우개 처치·보스 막타·점수·뱃지 넣기, `damageMonster` 가 보스 막타/지우개 처치 기록), `systems/MonsterSystem.js`·`systems/core.js`(생존 시간·부활 횟수·탈출 시각·지우개 표시).
  - `src/shared/results.js`(새로): 뱃지·점수 정산 — **서버가 한 번 계산**해서 모든 참가자가 같은 숫자를 본다. 가중치는 `src/config/balance.js` 의 `score`.
  - `src/config/models.js`(캐릭터 5줄, `rotateY:0` — 원본이 이미 -Z 를 봄, `anchor:'bottom'`), `ModelLibrary.js`(`anchor:'bottom'` 지원), `AnimalModels.js`(`devil` 외형·`createCharacterModel`·인게임 몸에 GLB+총, `rifleMesh`).
  - `style.css`: 로비 그리드(`.lobby-main`/`.lobby-stage`/`.stage-hint`/READY), 결과 오버레이(`.result-stage`/`.result-panel`/`.badges`/`.score-card`/`.rank-list`).
- **주의**: 3D 캐릭터는 원본이 -Z 를 보므로 무대(카메라 +Z)에서는 `bodyHolder.rotation.y = Math.PI` 로 돌려 세운다. 모델 교체 시 `rotateY` 를 먼저 확인할 것(프로브: `.work/probe/glb.html` 방식 — 카메라를 +Z/−Z 에 두고 앞뒤 확인).
- **검증**: 헤드리스 크로미엄으로 타이틀 → 로비(가짜 5인 상태로 5종 캐릭터·READY·이름표) → 혼자 테스트 경기(1인칭·술래 탑뷰·구석 카메라) → 결과(승리·내 점수·뱃지·순위) → 로비 복귀까지 확인. `pageerror 0`, 404 0. 스크린샷: `.work/probe/ink_shots/`. **이 작업 환경에는 node 가 없어 `npm test`·`tools/smoke.cjs` 는 못 돌렸다 — 다음 AI 는 반드시 먼저 돌릴 것.**
- **남은 것**: 인게임 몸의 총이 살짝 파묻힘(원거리 무해), PeerJS 실서버 2~5인 로비는 사용자 PC 에서 확인 필요, 1인칭 앞발은 아직 임시.
- **푸시 상태**: (해결됨) 처음엔 Pickle 쪽 GitHub 연결이 읽기 전용이라 막혔으나, 사용자가 권한을 열어 `9636181`·`41f6810` 이 main 에 푸시됨. 다른 세션(Claude)이 pull 해서 `npm test` 11/11·`tools/smoke.cjs` 통과·3D 로비와 게임 속 캐릭터 GLB 를 스크린샷으로 확인 (2026-11-26).
- **참고**: 방을 나가는 중(`App.quitting`)에 늦게 도착한 `GAME_OVER` 는 버렸다(종료 직후 결과 화면이 떴다가 사라지는 문제).

### 2026-11-26 · 맵·이펙트·UI 이미지 29장 적용
- **무엇을**: 사용자가 이미지 AI 로 뽑은 키트(원본 `assets/source/kit/`)를 게임에 적용.
  - 맵: 벽·바닥·기둥 텍스처, 방마다 벽(통로 구멍 제외)·바닥에 분필/빨간 낙서 데칼 (고정 시드라 모두 같은 자리).
  - 이펙트: 명중 불꽃·지우개 수류탄(날아가는 그림)·지우개 폭발·총구 불꽃·소환 원(일반=투명, 보스=검은 배경 가산 합성)+반투명 빨간 바닥·속성별 원거리 탄 스프라이트.
  - UI: 로고·던전 시작 배경, 동물 얼굴(로비·HUD·술래 패널·탑뷰), 속성·특성 아이콘(미리보기 칩·보스 바·몬스터 머리 위), SPAWN 버튼, HP·보스 바 틀, 연필 잉크(심 쪽부터 줄어듦), 조준점, 공책 종이 도화지.
- **어디**: `tools/process_assets.py`(초록 배경 크로마키·번짐 제거·시트 자르기, 검은 배경은 그대로), `src/config/assets.js`(이미지 목록), `src/client/render/Images.js`(불러오기 창구: img/url/texture), `main.js`(시작 전 최대 4초 대기, CSS 는 `--img-*` 변수 + `art-*` 클래스), `SceneBuilder.addDecals`, `Effects.vfxSprite`, `MonsterRenderer`(소환 원·탄·아이콘), `Weapon`(총구), `AnimalModels.drawAnimalFace`, `ui/dom.icon()`, `DrawingPad.render`, `style.css` 맨 아래 art 블록.
- **원칙**: 이미지를 못 불러오면 전부 예전 코드 그리기로 대체된다.
- **주의**: CSS 토큰 `--pencil`(연필 노란색)과 이름이 겹치지 않게 이미지 변수는 `--img-` 접두어.
- **제외**: 탈출문·횃불·술통 상자 이미지(회색 배경 사물) — 3D 로 만들어 쓸 예정.
- **검증**: `npm test` 11/11, `tools/smoke.cjs` 통과, 헤드리스 스크린샷(시작·로비·술래·플레이어·보스·소환 원) pageerror 0.

### 2026-11-26 · 총 3D 모델(GLB) 적용
- **무엇을**: 사용자가 Stable Fast 3D(Hugging Face, 설정 Triangle·정점 5000·텍스처 2048)로 뽑은 총을 1인칭 총과 다른 플레이어 손의 총에 적용.
- **어디**: `assets/models/gun.glb`, `vendor/addons/`(three 0.160.0 GLTFLoader), `src/config/models.js`(모델별 회전·크기·재질 보정 표), `src/client/render/ModelLibrary.js`(불러오기·정규화·복제·늦게 오면 바꿔 끼우기), `AnimalModels.createGunMesh(decorate)`·`setModelLibrary`, `main.js`(시작 시 불러오기).
- **보정**: SF3D 텍스처가 밝은 회색으로 구워져 나와서, 불러올 때 무채색 픽셀만 0.3배로 어둡게(보라·노랑·빨강 유지), 금속성 0. 원본 총구가 +X 라 Y 축 90° 회전.
- **검증**: `npm test` 11/11, `tools/smoke.cjs` 통과, 헤드리스 스크린샷으로 1인칭 총·동물 손의 총 확인.
- **참고**: 2D 배경 지우기(누끼)는 사용자가 결과가 나쁘다고 해서 중단·삭제함. 원본 컨셉 이미지는 `assets/source/` 에 있음.

### 2026-11-26 · 술래 화면 3D 구석 카메라
- **무엇을**: 술래 왼쪽 화면 양쪽 ◀ ▶ 화살표(또는 ← → 키)로 `탑뷰 지도 → 플레이어1 구석 카메라 → 플레이어2 …` 를 넘긴다. 구석 카메라는 그 플레이어가 있는 방의 가장 먼 구석 위(벽 위 18m)에서 실제 3D 전장을 내려다보고, 플레이어가 움직이면 부드럽게 따라간다. 따라가는 플레이어 머리 위에 노란 화살표. 3D 화면에서도 바닥을 클릭하면 소환 위치가 골라지고(초록/빨강 원), 플레이어 주변 8m 금지 원이 보인다. 오른쪽 도화지는 그대로라 그리던 그림을 계속 그릴 수 있다.
- **왜**: 사용자 요청 — 탑뷰 말고 실제 플레이 화면도 보며 그리기.
- **어디**: `src/client/render/WorldRenderer.js`(새로: 맵·몬스터·플레이어·연출 묶음, PlayerView 에서 분리 → 1인칭과 술래 카메라가 같이 씀), `src/client/tagger/CornerCam.js`(새로), `TaggerView.setView / update`, `GameMap.rooms / roomAt()`, `RemotePlayers({ skipId })`, `style.css`(.view-arrow, .view-label, .cornercam).
- **검증**: `npm test` 11/11, `tools/smoke.cjs` 통과, 헤드리스 스크린샷으로 구석 카메라·3D 클릭 소환·화면 전환·플레이어 화면(리팩터 후) pageerror 0 확인.
- **참고**: 3D 구석 카메라는 처음 켤 때 만든다(탑뷰만 쓰면 3D 를 안 그림). 술래 카메라는 소리를 내지 않는다(혼자 테스트에서 소리 겹침 방지).
- **저장소 이름 변경**: 사용자가 `asymmetric-drawing-fps` → `Ink-Escape` 로 바꿈 (공개 전환됨, Pages 는 아직 꺼짐).

### 2026-11-26 · v0.1 첫 프로토타입
- **무엇을**: 기획안 v1.1 기준 브라우저 멀티플레이 프로토타입 전체.
  - 판정(`src/shared/judge/`): 자체 래스터라이저(PC마다 같은 결과) → 칠한 면적 색 집계(검정 0.6배, 2위가 55% 이상이면 반반) + 반경 그래프 기반 형태 감지(날개·가시·촉수).
  - 방장 서버(`src/server/`): 로비(먼저 누른 사람 우선), 경기 시스템 10개, 명령 처리기 표.
  - 클라이언트(`src/client/`): 플레이어 3D(three.js, 종이 인형 빌보드, 동물 모델은 공 조합 임시), 술래 2분할, 시작/로비/결과.
  - 통신(`src/net/`): `Link` 인터페이스, MemoryLink(방장 본인·혼자 테스트), PeerJS(WebRTC).
- **왜**: 사용자 요청 — 웹 링크로 PC끼리 플레이 가능, SOLID 구조, GitHub Pages 배포.
- **검증**: `npm test` 11/11 통과. 헤드리스 크로뮴 혼자 테스트(소환·사격·pageerror 0). 로컬 PeerJS 서버로 브라우저 3개(술래 1 + 플레이어 2) 접속 → 역할 배정, 몬스터 동기화, 네트워크 명중으로 처치, 술래 이탈 시 "플레이어 승리" 확인.
- **조정한 수치**: 최소 면적 5% → 3% (큰 외곽선 그림이 거절되던 문제), 반반 기준 60% → 55%.
