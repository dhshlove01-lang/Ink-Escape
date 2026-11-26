# 설치 기록

- 출처: https://github.com/img2threejs/img2threejs (Apache-2.0, LICENSE 파일 그대로)
- 버전: v2.0.1, 커밋 0c0c49bc168e648dbaf9c8c080474de0b3a941b6
- 2026-11-26 사용자 요청으로 설치. 이 저장소에서 여는 Claude Code 세션이 프로젝트 스킬로 자동으로 불러온다.
- 설치 전 검토: 핵심 스크립트(forge/)는 파이썬 표준 라이브러리만 쓰고 외부 통신 없음. 외부 명령은 macOS 이미지 변환(sips)뿐.
  integrations/vision 은 선택 기능으로, 쓸 때만 Google 얼굴·자세 모델을 내려받는다.
- 업데이트: 새 버전 폴더로 통째로 바꾸고 이 파일의 버전·커밋을 고친다 (`npx --yes img2threejs@latest install --host claude` 는 개인 PC/세션용).
