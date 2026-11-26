#!/bin/bash
# 리뷰 기록 + 동기화 + 상태 진행. 사용: review.sh <pass> <fidelity> <aiScore> <action> "<summary>" "<matched>" "<mismatches>" '<layersJSON>' <features.json> "<notes>"
set -eo pipefail
FEAT="$(realpath "$9")"; HERE="$(cd "$(dirname "$0")" && pwd)"; W=$HERE/work; R=$W/renders; S=$W/.img2threejs/state.json
cd /home/user/ink-escape/.claude/skills/img2threejs
python3 forge/stage4_review/append_review.py $W/object-sculpt-spec.json --pass-id $1 --fidelity $2 --ai-vision-score $3 --action $4 --summary "$5" --matched "$6" --mismatches "$7" --layer-scores-json "$8" --feature-reviews-json "$FEAT" --ai-vision-notes "${10}" --render-screenshot $R/$1-front.png --comparison-image $R/$1-cmp.png --camera-view front --map-stripped-render $R/$1-stripped.png --in-place 2>&1 | tail -1
python3 forge/stage3_build/orchestrate_passes.py sync $W/object-sculpt-spec.json --in-place >/dev/null
python3 forge/state.py mark ai-review-recorded --state $S --evidence $R/$1-cmp.png >/dev/null
python3 forge/state.py mark pipeline-sync --state $S --evidence $W/object-sculpt-spec.json >/dev/null
python3 forge/next.py --state $S $W/object-sculpt-spec.json 2>&1 | sed -n 1,2p
