# ponytail 설치 기록

- 원본: https://github.com/DietrichGebert/ponytail (v5.3.3, 커밋 ebd8654, MIT — LICENSE)
- 설치일: 2026-11-27, 사용자 요청
- 설치한 것: 스킬 6개의 SKILL.md 만 → `.claude/skills/ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`
- 설치하지 않은 것: 플러그인 훅(hooks/ — 세션마다 모드 자동 켜기, 작업 기록 CSV·웹훅 보내기, 상태 표시줄). 클라우드 세션은 매번 새 컴퓨터라 저장소에 둔 스킬만 계속 남는다.
  훅까지 쓰려면 사용자 PC 의 Claude Code 에서: `/plugin marketplace add DietrichGebert/ponytail` → `/plugin install ponytail@ponytail`
- 업데이트: 원본을 다시 받아 `skills/<이름>/SKILL.md` 6개를 덮어쓰고 이 파일의 버전·커밋을 고친다.
