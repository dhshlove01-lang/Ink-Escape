# 게임 폰트

모두 **상업용 무료**이고, 게임 안에 파일로 넣어 배포(Steam 포함)할 수 있다. 폰트 파일만 따로 파는 것은 안 된다.
각 폴더의 `LICENSE.txt` 를 게임과 함께 배포한다 (크레딧 화면에도 이름 표기 권장).

| 토큰 (style.css) | 폰트 | 라이선스 | 쓰는 곳 |
| --- | --- | --- | --- |
| `--font-display` | 주아 (Jua, BM JUA) | SIL OFL 1.1 | 한글 제목·버튼·배너 |
| `--font-num` | Luckiest Guy | Apache 2.0 | 영문·숫자 강조 (타이머·탄약·HP·SPAWN·READY). 한글은 주아로 넘어감 |
| `--font-body` | Pretendard (프리텐다드) | SIL OFL 1.1 | 본문·설명·작은 글씨 (KS X 1001 서브셋, 400/600/700) |
| `--font-hand` | 개구 (Gaegu) | SIL OFL 1.1 | 낙서 느낌 포인트 (안내·라벨) |

- 출처: npm `@fontsource/jua`, `@fontsource/luckiest-guy`, `@fontsource/gaegu` (5.3.0), `pretendard` (1.3.9). woff2 만 넣었다.
- `fonts.css` 가 글자 범위(unicode-range)별로 나눠 두어, 화면에 나온 글자의 조각만 내려받는다.
- 새 글씨는 위 4개 토큰만 쓴다. 다른 폰트를 쓰려면 이 표와 라이선스를 먼저 추가한다.
