#!/bin/bash
# 게임용 내보내기: 생성된 TypeScript(work/src) → 순수 JS 한 파일 src/client/render/models/shiba.js
# esbuild(scratch 미리보기 폴더) 로 모델 함수만 묶고, 쓰지 않는 외부 import·설명용 userData(큰 JSON)는 뺀다.
set -e
P=/tmp/claude-0/-home-user/ef1e1da7-0310-5460-a05f-5fb4b21322b4/scratchpad/preview
OUT=/home/user/ink-escape/src/client/render/models/shiba.js
mkdir -p "$(dirname $OUT)"
cd $P && npx esbuild entry-shiba.ts --bundle --external:three --external:'three/*' --format=esm --target=es2020 --legal-comments=none --outfile=shiba.js --log-level=warning
python3 - "$P/shiba.js" "$OUT" <<'PY'
import re, sys
src, out = sys.argv[1], sys.argv[2]
s = open(src).read()
lines = s.split('\n')
body = '\n'.join(l for l in lines if not l.startswith('import '))
keep = []
for l in lines:
    m = re.match(r'import \{ (\w+) \} from "three/', l)
    if m and not re.search(r'\b' + m.group(1) + r'\b', body):
        continue  # 안 쓰는 외부 모듈 (조명 환경·후처리 등)
    # 설명용 메타데이터(스펙 사본) 한 줄짜리 대입은 게임에 필요 없음
    if re.match(r'\s+\w+\.userData\.(sculptComponent|colorMaterialRecipe|reconstructionEvidence|materialPipeline|materialReferenceRegistry|lookDevTargets|lightingFromPhoto) = ', l):
        continue
    keep.append(l)
header = ("// 시바 코드 모델 (자동 생성 — 직접 고치지 말 것)\n"
          "// 원본: art/models/shiba (img2threejs 스킬, 참고 이미지 assets/source/shiba.png).\n"
          "// 다시 만들기: art/models/shiba/rebuild.sh → export_game.sh. 등록: src/config/models.js 의 procedural.\n")
open(out, 'w').write(header + '\n'.join(keep))
PY
node --check $OUT && wc -c $OUT && grep -n '^import' $OUT
