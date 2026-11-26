"""Shiba 스펙 만들기: 템플릿(object-sculpt-spec.template.json)의 공통 칸은 두고, 부품·재질·리뷰 대상·리그를 시바용으로 채운다.
좌표: y 위, +Z 정면, 캐릭터 왼쪽 = +X. 단위: 발바닥(0) ~ 귀 끝(1.0). 참고 이미지 1px = 1/531.
위치는 부모 기준(local), 회전은 도(deg), scale = 크기."""
import json, copy, math, os
T = json.load(open('object-sculpt-spec.template.json'))
tmpl = {c['id']: c for c in T['componentTree']}
BASE = tmpl['head']

def comp(id, name, level, role, prim, parent, mat, pos, size, rot=(0, 0, 0), att=None, anim='static', imp=0.6, conf=0.8, topo='assembled-solid', why=None, layers=None, ev='full-object'):
    c = copy.deepcopy(BASE)
    c.update({'id': id, 'name': name, 'level': level, 'role': role, 'primitive': prim, 'parent': parent, 'material': mat,
              'materialLayers': layers or [mat], 'importance': imp, 'confidence': conf, 'topologyClass': topo,
              'topologyRationale': why or f'{name}: stylized chibi body part built as one smooth closed primitive (no continuous sculpt needed at this scale).',
              'attachment': att, 'evidenceRefs': [ev], 'localFeatures': [], 'details': [], 'fidelityTier': 'blockout'})
    c['dimensions'] = {'width': size[0], 'height': size[1], 'depth': size[2], 'units': 'relative', 'confidence': conf}
    c['transform'] = {'position': list(pos), 'rotation': list(rot), 'scale': list(size)}
    c['actionProfile'] = copy.deepcopy(BASE['actionProfile'])
    c['actionProfile']['animationRole'] = anim
    c['geometryDescriptor'] = copy.deepcopy(BASE['geometryDescriptor'])
    return c

def limb(start, end, r0, r1, socket, contact='socket-joint'):
    return {'parentSocket': socket, 'localStart': list(start), 'localEnd': list(end), 'contactType': contact,
            'baseRadius': r0, 'endRadius': r1, 'embedDepth': 0.02, 'gapTolerance': 0.01, 'evidenceRefs': ['full-object']}

def rot_z_deg(dx, dy):  # 기본 축(+Y)을 (dx,dy) 방향으로 돌리는 z 회전
    return -math.degrees(math.atan2(dx, dy))

C = []
add = C.append
add(comp('root', 'Shiba (root)', 'macro', 'body', 'box', None, 'hidden', (0, 0, 0), (1, 1, 1), anim='root', imp=1.0))
# 몸통 (서양배 모양) + 크림 배
add(comp('torso', 'Torso', 'macro', 'body', 'ellipsoid', 'root', 'fur-orange', (0, 0.315, 0), (0.63, 0.53, 0.50), anim='static', imp=0.95))
add(comp('belly', 'Belly patch', 'meso', 'body', 'ellipsoid', 'torso', 'fur-cream', (0, -0.02, 0.10), (0.44, 0.40, 0.34), imp=0.75))
# 머리 + 얼굴 크림 마스크(우라지로) + 주둥이
add(comp('head', 'Head', 'macro', 'head', 'ellipsoid', 'torso', 'fur-orange', (0, 0.41, 0.02), (0.53, 0.38, 0.47), anim='rotate', imp=1.0))
add(comp('face-mask', 'Face mask (urajiro)', 'meso', 'head', 'ellipsoid', 'head', 'fur-cream', (0, -0.08, 0.075), (0.56, 0.255, 0.35), imp=0.85))
add(comp('muzzle', 'Muzzle', 'meso', 'head', 'ellipsoid', 'head', 'fur-cream', (0, -0.055, 0.17), (0.17, 0.11, 0.12), imp=0.7))
for s, side in ((1, 'l'), (-1, 'r')):
    # 귀: 납작한 세모판(두께 4.5cm)을 머리 위 바깥쪽에 조금 기울여 꽂는다 + 앞쪽에 크림색 안쪽 세모
    add(comp(f'ear-{side}', f'Ear {side.upper()}', 'meso', 'ear', 'extrude', 'head', 'fur-orange', (s * 0.145, 0.115, -0.03), (1, 1, 1),
             rot=(-8, 0, -s * 14), anim='rotate', imp=0.8,
             why='Shiba ear is a flat rounded-tip triangle slab, embedded into the skull top-lateral.'))
    next(c for c in C if c['id'] == f'ear-{side}')['geometryDescriptor']['profile2D'] = {
        'points': [[-0.072, 0.0], [0.072, 0.0], [0.03, 0.09], [0.008, 0.135], [-0.008, 0.135], [-0.03, 0.09]], 'depth': 0.05}
    add(comp(f'ear-inner-{side}', f'Ear inner {side.upper()}', 'micro', 'detail', 'extrude', f'ear-{side}', 'ear-inner', (0, 0.012, 0.051), (1, 1, 1), imp=0.6))
    next(c for c in C if c['id'] == f'ear-inner-{side}')['geometryDescriptor']['profile2D'] = {
        'points': [[-0.045, 0.0], [0.045, 0.0], [0.016, 0.075], [0.0, 0.098], [-0.016, 0.075]], 'depth': 0.008}
    add(comp(f'eye-rim-{side}', f'Eye rim {side.upper()}', 'micro', 'detail', 'ellipsoid', 'head', 'fur-cream', (s * 0.092, 0.006, 0.192), (0.098, 0.102, 0.04), imp=0.5))
    add(comp(f'eye-{side}', f'Eye {side.upper()}', 'micro', 'detail', 'ellipsoid', 'head', 'eye', (s * 0.092, 0.008, 0.200), (0.078, 0.082, 0.045), imp=0.9))
    add(comp(f'catchlight-{side}', f'Eye catchlight {side.upper()}', 'micro', 'detail', 'sphere', f'eye-{side}', 'catchlight', (0.012, 0.016, 0.02), (0.018, 0.018, 0.012), imp=0.6))
    add(comp(f'brow-{side}', f'Brow dot {side.upper()}', 'micro', 'detail', 'ellipsoid', 'head', 'fur-cream', (s * 0.072, 0.085, 0.188), (0.055, 0.034, 0.026), imp=0.7))
    # 팔: 어깨 → 앞발 (아래 바깥으로 약 35°)
    sa = (s * 0.255, 0.20, 0.02); ea = (s * 0.395, 0.04, 0.06)
    add(comp(f'arm-{side}', f'Arm {side.upper()}', 'meso', 'arm', 'capsule', 'torso', 'fur-orange', sa, (0.11, 0.22, 0.11),
             rot=(0, 0, rot_z_deg(ea[0] - sa[0], ea[1] - sa[1])), att=limb(sa, ea, 0.058, 0.052, f'shoulder-{side}'), anim='rotate', imp=0.75))
    add(comp(f'paw-{side}', f'Paw tip {side.upper()}', 'micro', 'arm', 'sphere', 'torso', 'fur-cream', (s * 0.405, 0.025, 0.065), (0.11, 0.105, 0.105), imp=0.6))
    # 다리 + 발
    sl = (s * 0.13, -0.13, 0.0); el = (s * 0.13, -0.27, 0.02)
    add(comp(f'leg-{side}', f'Leg {side.upper()}', 'meso', 'leg', 'capsule', 'torso', 'fur-orange', sl, (0.14, 0.14, 0.14),
             att=limb(sl, el, 0.07, 0.068, f'hip-{side}'), anim='rotate', imp=0.6))
    add(comp(f'foot-{side}', f'Foot {side.upper()}', 'meso', 'leg', 'ellipsoid', 'root', 'fur-cream', (s * 0.13, 0.035, 0.035), (0.14, 0.075, 0.18), imp=0.65))
    # 벨트 주머니
    add(comp(f'pouch-{side}', f'Pouch {side.upper()}', 'meso', 'accessory', 'box', 'torso', 'leather', (s * 0.255, -0.07, 0.13), (0.10, 0.12, 0.07), rot=(0, s * 40, 0), imp=0.65))
    add(comp(f'pouch-flap-{side}', f'Pouch flap {side.upper()}', 'micro', 'accessory', 'box', f'pouch-{side}', 'leather-dark', (0, 0.035, 0.035), (0.105, 0.06, 0.012), imp=0.4))
    add(comp(f'pouch-stud-{side}', f'Pouch stud {side.upper()}', 'micro', 'detail', 'sphere', f'pouch-{side}', 'brass', (0, 0.02, 0.043), (0.016, 0.016, 0.01), imp=0.35))
# 코·입·혀
add(comp('nose', 'Nose', 'micro', 'detail', 'ellipsoid', 'head', 'nose', (0, -0.035, 0.245), (0.062, 0.042, 0.036), imp=0.85))
add(comp('mouth', 'Mouth', 'micro', 'detail', 'ellipsoid', 'head', 'mouth', (0, -0.1, 0.238), (0.135, 0.062, 0.035), imp=0.8))
add(comp('tongue', 'Tongue', 'micro', 'detail', 'ellipsoid', 'mouth', 'tongue', (0, -0.012, 0.009), (0.075, 0.034, 0.026), imp=0.6))
# 반다나: 목 둘레 + 가슴 삼각 + 왼쪽 어깨 매듭
add(comp('bandana-collar', 'Bandana collar', 'meso', 'accessory', 'torus', 'torso', 'bandana', (0, 0.228, -0.02), (0.47, 0.40, 0.42), rot=(90, 0, 0), imp=0.8))
add(comp('bandana-front', 'Bandana triangle', 'meso', 'accessory', 'extrude', 'torso', 'bandana', (0, 0.262, 0.2), (1, 1, 1), rot=(16, 0, 0), imp=0.85,
         why='Bandana is a thin cloth panel: an extruded rounded triangle whose top edge tucks under the chin, point down to mid-chest.'))
next(c for c in C if c['id'] == 'bandana-front')['geometryDescriptor']['profile2D'] = {
    'points': [[-0.25, 0.0], [-0.17, -0.055], [-0.09, -0.115], [-0.03, -0.165], [0.0, -0.18], [0.03, -0.165], [0.09, -0.115], [0.17, -0.055], [0.25, 0.0], [0.0, 0.03]],
    'depth': 0.022}
add(comp('bandana-knot', 'Bandana knot', 'micro', 'accessory', 'sphere', 'torso', 'bandana', (0.255, 0.255, 0.06), (0.085, 0.08, 0.08), imp=0.6))
add(comp('bandana-tail', 'Bandana knot tail', 'micro', 'accessory', 'box', 'bandana-knot', 'bandana', (0.04, 0.0, 0.0), (0.07, 0.04, 0.015), rot=(0, 0, -20), imp=0.45))
# 벨트 + 버클
add(comp('neck', 'Neck filler', 'meso', 'body', 'ellipsoid', 'torso', 'fur-orange', (0, 0.235, -0.01), (0.42, 0.16, 0.38), imp=0.5,
         why='Hidden neck volume joining head underside to torso top so no gap shows from the side.'))
add(comp('belt', 'Belt strap', 'meso', 'accessory', 'torus', 'torso', 'leather', (0, -0.085, 0.0), (0.585, 0.535, 0.45), rot=(90, 0, 0), imp=0.8,
         why='Belt hugs the waist: a torus whose ring runs just inside the torso surface so only ~2cm of the strap stands proud; vertical thickness scaled separately.'))
add(comp('buckle', 'Belt buckle', 'micro', 'detail', 'box', 'torso', 'brass', (0, -0.085, 0.274), (0.078, 0.066, 0.02), imp=0.75))
add(comp('buckle-hole', 'Buckle opening', 'micro', 'detail', 'box', 'buckle', 'leather', (0, 0, 0.006), (0.045, 0.03, 0.012), imp=0.4))
# 꼬리 (정면에서 안 보임 — 시바 말린 꼬리로 추정, 낮은 확신)
add(comp('tail', 'Curled tail (inferred)', 'meso', 'tail', 'ellipsoid', 'torso', 'fur-orange', (0, 0.07, -0.25), (0.17, 0.17, 0.13), anim='rotate', imp=0.4, conf=0.35, ev='full-object'))
add(comp('tail-tip', 'Tail cream curl (inferred)', 'micro', 'tail', 'ellipsoid', 'tail', 'fur-cream', (0, 0.02, -0.045), (0.09, 0.09, 0.06), imp=0.3, conf=0.35))

def mat(id, name, color, rough=0.9, metal=0.0, notes=''):
    m = copy.deepcopy(T['materials'][2])
    m.update({'id': id, 'name': name, 'baseColor': color, 'color': color})
    m['albedo'] = {'dominant': color, 'secondary': []}
    m['colorVariation'] = {'palette': [color], 'pattern': 'flat', 'amplitude': 0.0, 'heightCorrelation': 0.0}
    m['roughness'] = {'base': rough, 'variation': 0.03}
    m['metalness'] = {'base': metal, 'variation': 0.0}
    if notes: m['notes'] = notes
    return m
M = [copy.deepcopy(next(m for m in T['materials'] if m['id'] == 'hidden')),
     mat('fur-orange', 'Orange fur', '#d27a22', 0.92), mat('fur-cream', 'Cream fur', '#f2e6cf', 0.92), mat('ear-inner', 'Ear inner', '#f0d9c4', 0.9),
     mat('eye', 'Glossy eye', '#141012', 0.15), mat('catchlight', 'Eye catchlight', '#ffffff', 0.3), mat('nose', 'Nose', '#3a2620', 0.4),
     mat('mouth', 'Mouth interior', '#5a2a22', 0.6), mat('tongue', 'Tongue', '#e5818a', 0.45), mat('bandana', 'Bandana cotton', '#e2601e', 0.88),
     mat('leather', 'Brown leather', '#7a4f33', 0.6), mat('leather-dark', 'Dark leather', '#6b4430', 0.62), mat('brass', 'Brass', '#b08a4a', 0.35, 0.8)]


# ── 엄격 검사용 보강 ─────────────────────────────────────────
TEXTURE_FIELDS = ('normal', 'bump', 'displacement', 'surfaceFrequencyBands', 'textureProjection', 'textureResolution', 'referencePbr')
REGION = {'fur-orange': 'forehead-fur', 'fur-cream': 'belly-fur', 'ear-inner': 'ear-inner', 'eye': 'eye', 'nose': 'nose', 'tongue': 'tongue',
          'bandana': 'bandana', 'leather': 'belt-strap', 'leather-dark': 'pouch-flap', 'brass': 'buckle-brass'}
for m in M:
    for f in TEXTURE_FIELDS:
        m.pop(f, None)
    m['textureless'] = {'declared': True, 'evidence': [
        'reference.png: flat-shaded designer-toy render; regions are flat colour with hard boundaries, no print/grain/pores at 590px',
        f"material-analysis.json region {REGION.get(m['id'], 'n/a (not separately cropped: too small or hidden)')}"]}
    m['ambientOcclusion'] = {'cavityStrength': 0.25, 'contactShadowBias': 0.35, 'notes': 'Soft contact darkening where parts meet (head/torso, belt/torso, limbs).'}
def lo(mid, oid, kind, note):
    m = next(x for x in M if x['id'] == mid)
    m.setdefault('localOverrides', []).append({'id': oid, 'kind': kind, 'mask': 'component-region', 'notes': note})
lo('fur-cream', 'urajiro-boundary', 'colour-zone', 'Hard boundary between orange top and cream lower face/belly (shiba urajiro).')
lo('fur-orange', 'forehead-lighter', 'colour-zone', 'Slightly lighter orange on crown.')
lo('leather', 'edge-wear', 'wear', 'Lighter worn edges on belt and pouch rims.')
lo('brass', 'buckle-shine', 'gloss', 'Brighter specular on buckle face.')

CLS = {'fur-orange': 'fabric', 'fur-cream': 'fabric', 'ear-inner': 'fabric', 'bandana': 'fabric', 'eye': 'glass', 'catchlight': 'glass',
       'nose': 'rubber', 'mouth': 'rubber', 'tongue': 'rubber', 'leather': 'fabric', 'leather-dark': 'fabric', 'brass': 'metal', 'hidden': 'unknown'}
def rgba(hexc, a=1.0):
    h = hexc.lstrip('#'); return f"rgba({int(h[0:2],16)}, {int(h[2:4],16)}, {int(h[4:6],16)}, {a})"
MC = {m['id']: m.get('baseColor', '#000000') for m in M}
for c in C:
    col = MC.get(c['material'], '#888888') if c['material'] != 'hidden' else MC['fur-orange']  # 보이지 않는 root 는 캐릭터 전체의 주색
    c['colorMaterialRecipe'] = {'dominantAlbedo': rgba(col), 'secondaryAlbedo': rgba(col, 0.85), 'materialClass': CLS.get(c['material'], 'unknown'),
                                'materialClassConfidence': 0.8, 'evidenceRefs': ['full-object']}
# 붙는 자리 정보 (구·타원체·토러스 부품도 어디에 어떻게 붙는지)
def overlap(cid, socket):
    c = next(x for x in C if x['id'] == cid)
    p = c['transform']['position']
    c['attachment'] = {'parentSocket': socket, 'localStart': list(p), 'localEnd': [p[0], p[1] - 0.01, p[2]], 'contactType': 'overlap',
                       'baseRadius': max(c['dimensions']['width'], 0.02) / 2, 'endRadius': max(c['dimensions']['width'], 0.02) / 2, 'embedDepth': 0.02,
                       'gapTolerance': 0.01, 'evidenceRefs': ['full-object']}
for cid, sock in (('paw-l', 'wrist-l'), ('paw-r', 'wrist-r'), ('foot-l', 'ankle-l'), ('foot-r', 'ankle-r'), ('bandana-tail', 'knot'), ('tail', 'rump'), ('tail-tip', 'tail'), ('neck', 'neck'), ('ear-l', 'skull-l'), ('ear-r', 'skull-r'), ('ear-inner-l', 'ear-l'), ('ear-inner-r', 'ear-r'), ('eye-rim-l', 'eye-l'), ('eye-rim-r', 'eye-r')):
    overlap(cid, sock)
# 세부 특징(local features) — 머리·눈·버클 등에 이름 붙은 작은 특징
def feat(cid, fid, kind, note):
    c = next(x for x in C if x['id'] == cid)
    c['localFeatures'].append({'id': fid, 'kind': kind, 'description': note, 'evidenceRefs': ['full-object'], 'confidence': 0.8})
feat('head', 'cheek-lobes', 'contour', 'Cream cheek lobes bulge sideways below the eyes (part of face-mask volume).')
feat('eye-l', 'catchlight-pair-l', 'gloss', 'White catchlight upper-outer on the glossy eye.')
feat('eye-r', 'catchlight-pair-r', 'gloss', 'Mirrored catchlight on the right eye.')
feat('buckle', 'buckle-frame', 'fastener', 'Rectangular brass frame with dark leather showing through the opening.')
feat('pouch-l', 'pouch-snap-l', 'fastener', 'Brass snap stud on the flap.')
feat('pouch-r', 'pouch-snap-r', 'fastener', 'Brass snap stud on the flap.')
feat('mouth', 'smile-curve', 'contour', 'Open smile, wide U shape with pink tongue.')
feat('bandana-front', 'bandana-point', 'contour', 'Triangle point hangs to mid-chest.')
# 같은 이름의 캐치라이트는 좌우 대칭(반사)으로
cr = next(x for x in C if x['id'] == 'catchlight-r'); cr['transform']['position'][0] = -cr['transform']['position'][0]


# 회전 단위: 생성기는 transform.rotation 을 라디안으로 그대로 쓴다 → 도를 라디안으로.
# 끝점(attachment)으로 놓이는 부품(원뿔·캡슐)은 방향을 생성기가 끝점으로 정하므로 회전 0.
ATTACH_PRIMS = {'cylinder', 'cone', 'capsule', 'tube', 'curve-sweep'}
for c in C:
    if c['primitive'] in ATTACH_PRIMS and c.get('attachment'):
        c['transform']['rotation'] = [0.0, 0.0, 0.0]
    else:
        c['transform']['rotation'] = [round(math.radians(v), 5) for v in c['transform']['rotation']]


# 얼굴 부품은 머리 표면 위에: 머리 타원체 크기에서 그 높이(x,y)의 앞면 z 를 계산해 붙인다 (머리 크기를 바꿔도 묻히지 않게)
HEAD = next(c for c in C if c['id'] == 'head')
hx, hy, hz = [v / 2 for v in HEAD['transform']['scale']]
def surf_z(x, y, out=0.0):
    k = 1 - (x / hx) ** 2 - (y / hy) ** 2
    return round(hz * math.sqrt(max(0.02, k)) + out, 4)
for cid, out in (('eye-l', 0.004), ('eye-r', 0.004), ('eye-rim-l', -0.004), ('eye-rim-r', -0.004), ('brow-l', 0.014), ('brow-r', 0.014)):
    c = next(x for x in C if x['id'] == cid)
    p = c['transform']['position']
    p[2] = surf_z(p[0], p[1], out)
# 코·입은 주둥이(머리 앞 + 얼굴 마스크) 앞면에
MZ = next(c for c in C if c['id'] == 'muzzle'); FM = next(c for c in C if c['id'] == 'face-mask')
front = max(MZ['transform']['position'][2] + MZ['transform']['scale'][2] / 2, FM['transform']['position'][2] + FM['transform']['scale'][2] / 2)
next(c for c in C if c['id'] == 'nose')['transform']['position'][2] = round(front + 0.006, 4)
next(c for c in C if c['id'] == 'mouth')['transform']['position'][2] = round(FM['transform']['position'][2] + FM['transform']['scale'][2] / 2 * 0.93, 4)

S = copy.deepcopy(T)
S['componentTree'] = C
S['materials'] = M
S['coordinateFrame'] = {'front': '+Z (camera-facing side of the reference)', 'up': '+Y', 'characterLeft': '+X', 'scaleReference': 'feet bottom 0 → ear tip 1.0; 1 reference px = 1/531'}
S['repetitionSystems'] = [
    {'id': 'bilateral-pairs', 'kind': 'mirror', 'axis': 'x', 'componentRefs': [c['id'] for c in C if c['id'].endswith('-l')], 'mirrorOf': [c['id'] for c in C if c['id'].endswith('-r')], 'notes': 'ears, eyes, brows, arms, paws, legs, feet, pouches mirrored across x=0'},
    {'id': 'eye-catchlights', 'kind': 'repeat', 'componentRefs': ['catchlight-l', 'catchlight-r'], 'notes': 'same offset on both eyes (toward key light)'}]
S['featureReviewTargets'] = [
    {'id': 'anatomy-proportion', 'name': 'Chibi head/torso proportion (~2.6 HU)', 'tier': 'critical', 'passIds': ['blockout', 'proportion-lock'], 'minimumScore': 0.75, 'mustPass': True, 'componentRefs': ['head', 'torso'], 'evidenceRefs': ['full-object']},
    {'id': 'face-landmark-placement', 'name': 'Eyes, brow dots, nose, mouth placement', 'tier': 'critical', 'passIds': ['feature-placement'], 'minimumScore': 0.72, 'mustPass': True, 'componentRefs': ['eye-l', 'eye-r', 'brow-l', 'nose', 'mouth'], 'evidenceRefs': ['full-object']},
    {'id': 'pose-silhouette', 'name': 'Arms down-out, short legs, ears silhouette', 'tier': 'critical', 'passIds': ['blockout', 'proportion-lock'], 'minimumScore': 0.72, 'mustPass': True, 'componentRefs': ['arm-l', 'ear-l', 'leg-l'], 'evidenceRefs': ['full-object']},
    {'id': 'outfit-and-palette', 'name': 'Orange/cream split, bandana, belt+pouches', 'tier': 'critical', 'passIds': ['material-pass'], 'minimumScore': 0.72, 'mustPass': True, 'componentRefs': ['face-mask', 'belly', 'bandana-front', 'belt', 'pouch-l'], 'evidenceRefs': ['full-object']},
    {'id': 'eye-life', 'name': 'Glossy eyes with catchlights', 'tier': 'important', 'passIds': ['feature-placement'], 'minimumScore': 0.65, 'mustPass': False, 'componentRefs': ['eye-l', 'catchlight-l'], 'evidenceRefs': ['full-object']}]
# 리그: 뼈대 (나중에 손 흔들기·고개·꼬리 움직임)
def pos_of(cid):
    by = {c['id']: c for c in C}
    p = [0, 0, 0]; c = by[cid]
    while c:
        p = [p[i] + c['transform']['position'][i] for i in range(3)]
        c = by.get(c['parent'])
    return [round(v, 4) for v in p]
bones = [{'id': 'root', 'parent': None, 'jointPos': [0, 0, 0], 'tipPos': pos_of('torso'), 'component': 'root', 'role': 'rigid', 'chain': 'spine'},
         {'id': 'torso', 'parent': 'root', 'jointPos': pos_of('torso'), 'tipPos': [0, pos_of('torso')[1] + 0.24, 0], 'component': 'torso', 'role': 'rigid', 'chain': 'spine'},
         {'id': 'head', 'parent': 'torso', 'jointPos': pos_of('head'), 'tipPos': [0, 1.0, 0.02], 'component': 'head', 'role': 'rigid', 'chain': 'spine'},
         {'id': 'tail', 'parent': 'torso', 'jointPos': pos_of('tail'), 'tipPos': [0, pos_of('tail')[1] + 0.1, pos_of('tail')[2] - 0.05], 'component': 'tail', 'role': 'rigid', 'chain': 'tail'}]
for side in 'lr':
    for part, chain in (('arm', f'arm-{side}'), ('leg', f'leg-{side}')):
        c = next(x for x in C if x['id'] == f'{part}-{side}')
        par = 'head' if part == 'ear' else 'torso'
        base = pos_of(par)
        bones.append({'id': f'{part}-{side}', 'parent': par, 'jointPos': [round(base[i] + c['attachment']['localStart'][i], 4) for i in range(3)],
                      'tipPos': [round(base[i] + c['attachment']['localEnd'][i], 4) for i in range(3)], 'component': f'{part}-{side}', 'role': 'rigid', 'chain': chain})
A = S['preSpecAssessment']
S['assumptions'] = list(S.get('assumptions') or []) + [u + ' (resolved by stylized inference, low confidence)' for u in A.get('unknownsToResolveBeforeImplementation', [])]
A['unknownsToResolveBeforeImplementation'] = []
KIND = {'face-mask': ('contour', 'face-mask'), 'brow-dots': ('decal', 'brow-l'), 'eyes': ('gloss', 'catchlight-pair-l'), 'nose': ('gloss', 'nose'),
        'mouth': ('contour', 'smile-curve'), 'ear-inner': ('contour', 'ear-inner-l'), 'bandana-triangle': ('contour', 'bandana-point'),
        'bandana-knot': ('ridge', 'bandana-knot'), 'belly-patch': ('contour', 'belly'), 'belt-buckle': ('fastener', 'buckle-frame'),
        'pouches': ('fastener', 'pouch-snap-l'), 'paw-tips': ('contour', 'paw-l'), 'feet': ('contour', 'foot-l')}
for d in A['detailInventory']['details']:
    k, ref = KIND[d['id']]
    d['kind'] = k
    d['mapsTo'] = {'type': 'component', 'ref': ref}
ALL = [c['id'] for c in C]
MACRO = [c['id'] for c in C if c['level'] == 'macro']
MESO = [c['id'] for c in C if c['level'] in ('macro', 'meso')]
for p in S['buildPasses']:
    p['componentRefs'] = MACRO if p['id'] == 'blockout' else MESO if p['id'] in ('structural-pass', 'proportion-lock') else ALL
ids = [p['id'] for p in S['buildPasses']]
if 'structural-pass' not in ids:
    bp = copy.deepcopy(S['buildPasses'][0])
    bp.update({'id': 'structural-pass', 'goal': 'Lock component hierarchy: head on torso, ears/eyes on head, limbs/feet, bandana, belt+pouches, tail.',
               'componentRefs': [c['id'] for c in C if c['level'] in ('macro', 'meso')], 'acceptance': ['every visible part attached to its parent socket', 'no floating parts']})
    S['buildPasses'].insert(1, bp)
S['lightingFromPhoto'] = [
    {'id': 'key', 'type': 'directional', 'direction': 'upper-front-right', 'intensity': 2.2, 'color': '#fff4e6', 'notes': 'soft studio key, catchlights upper-outer'},
    {'id': 'fill', 'type': 'hemisphere', 'sky': '#ffffff', 'ground': '#b8b0a8', 'intensity': 1.0, 'notes': 'neutral grey studio fill'},
    {'id': 'rim', 'type': 'directional', 'direction': 'back-left', 'intensity': 0.6, 'notes': 'subtle rim on fur edges'},
    {'id': 'exposure', 'notes': 'ACES filmic tone mapping, exposure 1.0'},
    {'id': 'ground', 'notes': 'soft contact shadow / ambient occlusion under feet'}]
for side, sg in (('l', 1), ('r', -1)):
    e = pos_of(f'ear-{side}')
    bones.append({'id': f'ear-{side}', 'parent': 'head', 'jointPos': e, 'tipPos': [round(e[0] + sg * 0.03, 4), round(e[1] + 0.13, 4), e[2]], 'component': f'ear-{side}', 'role': 'rigid', 'chain': f'ear-{side}'})
S['rig'] = {'version': '1.0', 'bindPose': 'A', 'forward': '+Z', 'bones': bones}
# 파이프라인 도구가 쌓은 기록(리뷰·패스 진행·Tier1·시각 근거·재질 분석)은 다시 만들어도 이어서 유지
if os.path.exists('object-sculpt-spec.json'):
    OLD = json.load(open('object-sculpt-spec.json'))
    for k in ('reviewHistory', 'sculptPipeline', 'tier1Results', 'visualEvidence', 'materialAnalysis'):
        if k in OLD:
            S[k] = OLD[k]
json.dump(S, open('object-sculpt-spec.json', 'w'), indent=1, ensure_ascii=False)
print('components', len(C), 'materials', len(M), 'bones', len(bones))
