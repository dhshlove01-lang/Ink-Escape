# 1인칭 동물 앞발 (paw_*.glb)

플레이어 1인칭 손. `assets/models/paw_{shiba,bear,rabbit,cat}.glb`.

## 어디서 왔나 (2026-11-27)

1. 그림 4장 생성 — `source/paw_{shiba,bear,rabbit,cat}.png`
   (잉크 코믹 3D, 굵은 검은 외곽선, 균일 회색 배경, 총 없이 살짝 쥔 그립 포즈 한 개, 1254×1254)
2. `tools/paw_mesh.py` 로 그림 → 닫힌 3D 메시 + 그림 텍스처 GLB.

원래는 Stability **Stable Fast 3D**(허깅페이스 Space)로 변환할 계획이었지만, 사용 계정의 ZeroGPU 무료 한도가
하루치 소진되어(`You have exceeded your free ZeroGPU quota (60s requested vs. 0s left)`) 쓸 수 없었다.
그래서 그림의 실루엣을 그대로 살린 로컬 메시로 만들었다. **SF3D 한도가 다시 풀리면 같은 파일 이름만 덮어쓰면
코드 수정 없이 교체된다** (긴 변 1.0 기준으로 정규화되고 `src/config/models.js` 의 `size` 로 크기를 맞추므로).

## 다시 만들기

```bash
python3 tools/paw_mesh.py art/models/paw/source/paw_shiba.png assets/models/paw_shiba.glb \
        --grid=170 --depth=0.12 --zoom=0.8
# bear / rabbit / cat 동일
```

- `--zoom=0.8` : 주먹 쪽으로 잘라 낸다(그림에서 앞발은 바운딩박스 왼쪽 위).
- `--depth` : 부피(앞뒤로 튀어나오는 정도). 크게 주면 손가락 사이가 메워져 뭉개진다 → 0.1 근처가 좋다.
- 실행 환경에 `numpy`·`opencv-python` 이 필요하다.

## 게임 쪽

- `src/config/models.js` : `paw_*` 4줄. `lazy: true` 라서 시작할 때 받지 않고 그 동물로 플레이할 때만 받는다(4종 합쳐 ~12MB).
- `src/client/render/AnimalModels.js` : `createViewModel()` 이 손마다 홀더를 만들고 `putPaw()` 가 GLB 를 넣는다.
  GLB 가 없거나 실패하면 예전 코드 팔+앞발이 폴백으로 남는다. 자세(위치·회전·쥔 지점)는 `createViewModel` 안의 `putPaw(...)` 인자에서 조정한다.
- 재질은 **조명 없는 MeshBasic**(그림에 명암이 이미 구워져 있음) + `alphaTest 0.5`(배경 텍셀 버리기).
