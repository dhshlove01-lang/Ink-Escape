#!/bin/bash
# 한 패스 검사 묶음: 다시 만들기 → Tier1(배경 평탄화 참고본) → Divine Eye → 턴테이블 → 다각도 → 패스 게이트 → 비교 시트
# 사용: gates.sh <pass-id>   (리뷰 기록 append_review 는 사람이 판단해서 따로)
set -e
PASS=$1; HERE="$(cd "$(dirname "$0")" && pwd)"; W=$HERE/work; R=$W/renders; S=$W/.img2threejs/state.json
SK=/home/user/ink-escape/.claude/skills/img2threejs; cd $SK
$HERE/rebuild.sh $PASS >/dev/null 2>&1 || true
python3 forge/state.py mark build-current-pass --state $S --evidence $W/src/createObjectModel.ts >/dev/null 2>&1 || true
python3 forge/state.py mark render-capture --state $S --evidence $R/$PASS-front.png >/dev/null 2>&1 || true
python3 forge/state.py mark review-contract-read --state $S --evidence grimoire/review/gates_reference.md >/dev/null 2>&1 || true
python3 forge/stage4_review/diagnose_render.py --reference $W/reference-flatbg.png --render $R/$PASS-front.png --map-stripped-render $R/$PASS-stripped.png --spec $W/object-sculpt-spec.json --pass-id $PASS --in-place --json > $R/$PASS-tier1.json 2>&1 || true
python3 -c "import json;t=open('$R/$PASS-tier1.json').read();d=json.loads(t[t.index('{'):]);c=d['checks'];print('tier1',d['passed'],c['silhouetteIoU'],c['scaleDelta'],d['failures'])"
python3 forge/stage4_review/divine_eye.py --reference $HERE/reference.png --render $R/$PASS-front.png --json > $R/$PASS-divine-eye.json 2>&1 || true
python3 -c "import json;d=json.load(open('$R/$PASS-divine-eye.json'));s=d['signals'];print('eye',d['action'],d['fidelity'],'objectness',s['objectness'],'phash',s['phashSimilarity'])"
python3 forge/state.py mark tier1-diagnostics --state $S --evidence $R/$PASS-tier1.json >/dev/null 2>&1 || true
python3 forge/stage4_review/turntable_gate.py --capture 0=$R/$PASS-front.png --capture 90=$R/$PASS-right.png --capture 180=$R/$PASS-rear.png --capture 270=$R/$PASS-left.png --json > $R/$PASS-turntable.json 2>&1 || true
python3 -c "import json;d=json.load(open('$R/$PASS-turntable.json'));print('turntable',d['passed'],[(a['azimuth'],a['holed']) for a in d['angles']])"
python3 forge/stage4_review/diagnose_render_multi_angle.py --reference $R/$PASS-front.png --orbit $R/$PASS-right.png --orbit $R/$PASS-rear.png --orbit $R/$PASS-left.png --json > $R/$PASS-multi-angle.json 2>&1 || true
python3 forge/state.py mark multi-angle-review --state $S --evidence $R/$PASS-turntable.json >/dev/null 2>&1 || true
python3 forge/stage3_build/orchestrate_passes.py check $W/object-sculpt-spec.json --pass-id $PASS 2>&1 | tail -2
python3 forge/state.py mark pass-gate-check --state $S --evidence $W/object-sculpt-spec.json >/dev/null 2>&1 || true
python3 forge/stage4_review/make_comparison_sheet.py --reference $HERE/reference.png --render $R/$PASS-front.png --out $R/$PASS-cmp.png --json >/dev/null 2>&1
echo "sheet: $R/$PASS-sheet.png  cmp: $R/$PASS-cmp.png"
