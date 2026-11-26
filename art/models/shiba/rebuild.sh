#!/bin/bash
# 스펙 다시 만들기 → 검사 → 코드 생성 → 미리보기 렌더 → 비교 시트. 사용: rebuild.sh <pass-id>
set -e
cd "$(dirname "$0")/work"; PASS=${1:-blockout}
V=/home/user/ink-escape/.claude/skills/img2threejs/forge
P=/tmp/claude-0/-home-user/ef1e1da7-0310-5460-a05f-5fb4b21322b4/scratchpad/preview
python3 build_spec.py >/dev/null
python3 $V/stage3_build/orchestrate_passes.py sync object-sculpt-spec.json --in-place >/dev/null 2>&1 || true
python3 $V/stage2_spec/validate_sculpt_spec.py object-sculpt-spec.json --strict-quality 2>&1 | tail -1
python3 $V/stage3_build/generate_threejs_factory.py object-sculpt-spec.json --out src/createObjectModel.ts --pass-id $PASS --force 2>&1 | tail -1
$P/build.sh
(cd $P && node capture.cjs /home/user/ink-escape/art/models/shiba/work/renders $PASS)
python3 -c "
from PIL import Image
ims=[Image.open(f'renders/$PASS-{n}.png').convert('RGB') for n in ['front','right','rear','left']]
ref=Image.open('../reference.png').convert('RGB'); w,h=ref.width//2,ref.height//2
sheet=Image.new('RGB',(w*5,h),(40,40,40)); sheet.paste(ref.resize((w,h)),(0,0))
for k,i in enumerate(ims): sheet.paste(i.resize((w,h)),((k+1)*w,0))
sheet.save('renders/$PASS-sheet.png')"
