# INK ESCAPE 공용 UI 컴포넌트 14종

손그림 스케치북 스타일 UI 키트. 14장 모두 별도 PNG이며 아래 공통 규칙을 지킵니다.

- **배경**: 정확히 `#00FF00` (0,255,0) 단색. 알파 채널 없음(RGB). 테두리 64px 이상 여백으로 잘린 곳 없음.
- **텍스트 없음**: 글자·숫자·라벨 0건.
- **색**: ink `#0d0b10`, crayon-red `#d8283f`, cream `#f3ecdd`. 주요 채움색은 이 값에 맞춰 정규화했습니다.
- 파일명은 아래 기본 이름과 짧은 별칭(`ui14_NN.png`)이 같은 바이트로 함께 들어 있습니다.

## 파일

| # | 파일 | 크기 |
|---|---|---|
| 01 | `ui14_01_primary_btn.png` | 1504×362 |
| 02 | `ui14_02_secondary_btn.png` | 1497×341 |
| 03 | `ui14_03_danger_btn.png` | 1773×336 |
| 04 | `ui14_04_disabled_btn.png` | 1224×495 |
| 05 | `ui14_05_large_panel.png` | 1536×1020 |
| 06 | `ui14_06_small_card.png` | 948×1091 |
| 07 | `ui14_07_input_box.png` | 1743×810 |
| 08 | `ui14_08_tab_bar.png` | 1396×367 |
| 09 | `ui14_09_toggle_switch.png` | 1402×382 |
| 10 | `ui14_10_slider.png` | 1665×290 |
| 11 | `ui14_11_tag_chips.png` | 1727×270 |
| 12 | `ui14_12_badges.png` | 1359×525 |
| 13 | `ui14_13_popup_dialog.png` | 1428×832 |
| 14 | `ui14_14_alert_banner.png` | 1773×530 |

## 9-slice 권장 모서리 크기

장식이 모서리에만 있고 가운데가 평평하도록 그렸습니다. 아래 크기 이상으로 자르면 장식이 늘어나지 않습니다.

| 파일 | corner |
|---|---|
| 05 large_panel | 180 |
| 06 small_card | 230 (좌상단 빨간 탭이 156×144 라서 크게) |
| 13 popup_dialog | 120 (상단 빨간 헤더 87px) |
| 14 alert_banner | 180 (찢긴 좌우 끝) |
| 01·02·03·04 | 버튼 안쪽이 단색이라 40~60이면 충분 |

**07 input_box 주의**: 가운데에 노트 줄무늬가 있어 세로로 늘리면 줄 간격이 벌어집니다. 좌우로만 늘리는 3-slice(좌우 90px 고정)나, 줄무늬를 배경 타일로 따로 쓰세요.

## 상태 스트립 자르기 좌표 (pixel, x 시작–끝)

| 파일 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| 01 primary | 64–501 normal | 542–975 hover | 1015–1439 pressed | |
| 02 secondary | 64–481 normal | 538–957 hover | 1020–1432 pressed | |
| 03 danger | 55–597 normal | 653–1192 hover | 1250–1708 pressed | |
| 09 toggle | 64–643 OFF | 758–1337 ON | | |
| 11 chips | 64–432 gray | 474–843 red | 881–1249 blue | 1294–1662 yellow |

세로는 01이 y 64–297(normal/hover), 114–294(pressed) — pressed는 눌린 느낌으로 낮고 짧습니다. 09는 y 64–317, 11은 y 64–205.

## 크로마키

- 배경만 정확히 `#00FF00`이므로 **정확 일치(exact match)** 키를 권장합니다.
- 12번 초록 체크는 `(15,181,74)` 안팎의 진한 초록 + 검정 테두리라 `#00FF00`와 G값이 74 차이 납니다. 허용 오차가 큰 색상 키(tolerance > 0.2)를 쓰면 체크가 일부 지워질 수 있으니 주의하세요.

## 검증

- `downloads/ink_escape_ui_kit_14_preview.png` — 14장 미리보기 시트(정확한 #00FF00 배경 그대로)
- 작업·검증 스크립트와 검사 이미지: `downloads/ink_escape_ui_kit_14_src/`
