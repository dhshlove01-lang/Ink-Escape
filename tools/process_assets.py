"""assets/source/kit/*.png (사용자가 이미지 AI 로 뽑은 원본) → 게임용 webp.

- 초록 배경(#00FF00): 크로마키로 투명하게 + 가장자리 초록 번짐 제거
- 여러 개가 한 장에 모인 시트: 투명 조각별로 잘라 왼→오, 위→아래 순서로 저장
- 검은 배경 이펙트: 그대로 (게임에서 가산 합성 = 검정이 사라짐)
- 텍스처: 그대로 webp

사용: python3 -I tools/process_assets.py      (Pillow, numpy)
새 이미지는 JOBS 에 한 줄 추가한다.
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'source' / 'kit'
OUT = ROOT / 'assets'

# (원본, 처리, 결과, 긴 변 최대 px[, 붙임 거리]) — split 은 결과 이름 목록(왼→오, 위→아래)
# 붙임 거리: 이만큼(×8px) 떨어진 획까지 한 조각으로 본다. 아이콘이 촘촘히 붙은 시트는 0
JOBS = [
    ('map_01_wall_tile', 'tex', 'tex/wall', 512),
    ('map_02_floor_tile', 'tex', 'tex/floor', 512),
    ('map_03_pillar_tile', 'tex', 'tex/pillar', 512),
    ('ui_09_notebook_paper', 'tex', 'ui/paper', 512),
    ('ui_10_title_bg', 'tex', 'ui/title_bg', 1600),
    ('map_04_chalk_decals', 'split', [f'decals/chalk_{i:02d}' for i in range(1, 13)], 256),
    ('map_05_red_decals', 'split', [f'decals/red_{i:02d}' for i in range(1, 9)], 256),
    ('ui_01_logo', 'key', 'ui/logo', 900),
    ('ui_02_elem_icons', 'split', ['ui/icons/elem_black', 'ui/icons/elem_red', 'ui/icons/elem_blue', 'ui/icons/elem_yellow', 'ui/icons/elem_purple'], 128, 0),
    ('ui_03_trait_icons', 'split', ['ui/icons/trait_fly', 'ui/icons/trait_dash', 'ui/icons/trait_ranged'], 128),
    ('ui_04_portraits', 'split', ['ui/faces/shiba', 'ui/faces/bear', 'ui/faces/rabbit', 'ui/faces/cat'], 192),
    ('ui_05_spawn_btn', 'key', 'ui/spawn_btn', 640),
    ('ui_06_hp_bars', 'split', ['ui/bar_hp', 'ui/bar_boss'], 1024),
    ('ui_07_ink_pencils', 'split', ['ui/pencil_full', 'ui/pencil_half', 'ui/pencil_stub'], 512),
    ('ui_08_crosshair', 'key', 'ui/crosshair', 128),
    ('vfx_01_muzzle_flash', 'black', 'vfx/muzzle', 256),
    ('vfx_02_bullet_tracer', 'black', 'vfx/tracer', 512),
    ('vfx_03_hit_spark', 'black', 'vfx/spark', 256),
    ('vfx_04_eraser_grenade', 'key', 'vfx/grenade', 256),
    ('vfx_05_summon_circle', 'key', 'vfx/summon', 512),
    ('vfx_06_boss_summon_circle', 'black', 'vfx/summon_boss', 512),
    ('vfx_07_eraser_explosion', 'black', 'vfx/eraser_boom', 384),
    ('vfx_08_fire_proj', 'black', 'vfx/proj_red', 192),
    ('vfx_09_ice_proj', 'black', 'vfx/proj_blue', 192),
    ('vfx_10_lightning_proj', 'black', 'vfx/proj_yellow', 192),
    ('vfx_11_poison_proj', 'black', 'vfx/proj_purple', 192),
]


def chroma_key(im: Image.Image) -> Image.Image:
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    spill = g - np.maximum(r, b)  # 초록이 얼마나 튀나
    alpha = 1 - np.clip((spill - 30) / 90, 0, 1)
    g2 = np.minimum(g, np.maximum(r, b))  # 번진 초록 빼기 (이 그림들엔 초록 색이 없다)
    out = np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def trim(im: Image.Image, pad: int = 6) -> Image.Image:
    bb = im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    if not bb:
        return im
    x0, y0, x1, y1 = bb
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))


def black_trim(im: Image.Image, pad: int = 8) -> Image.Image:
    lum = im.convert('L').point(lambda v: 255 if v > 12 else 0)
    bb = lum.getbbox()
    if not bb:
        return im
    x0, y0, x1, y1 = bb
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))


def pieces(rgba: Image.Image, count: int, reach: int = 2):
    """투명 조각 덩어리 찾기: 알파를 줄인 격자에서 가까운 조각을 합쳐 count 개로."""
    s = 8
    small = np.asarray(rgba.getchannel('A').resize((rgba.width // s, rgba.height // s), Image.BILINEAR)) > 20
    h, w = small.shape
    label = np.zeros((h, w), np.int32)
    boxes = []
    for y0 in range(h):
        for x0 in range(w):
            if not small[y0, x0] or label[y0, x0]:
                continue
            idx = len(boxes) + 1
            stack = [(y0, x0)]
            label[y0, x0] = idx
            bx = [x0, y0, x0, y0]
            n = 0
            while stack:
                y, x = stack.pop()
                n += 1
                bx = [min(bx[0], x), min(bx[1], y), max(bx[2], x), max(bx[3], y)]
                rng = range(-max(1, reach), max(1, reach) + 1)
                for dy in rng:
                    for dx in rng:
                        if reach == 0 and dx and dy:
                            continue
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and small[ny, nx] and not label[ny, nx]:
                            label[ny, nx] = idx
                            stack.append((ny, nx))
            boxes.append((bx, n))
    # 너무 작은 티끌 버리고, 큰 것부터 count 개
    boxes = [b for b in boxes if b[1] > 6]
    boxes.sort(key=lambda b: -b[1])
    boxes = [b[0] for b in boxes[:count]]
    # 줄(위→아래) 묶고 줄 안에서 왼→오
    boxes.sort(key=lambda b: (b[1] + b[3]) / 2)
    rows, cur = [], []
    for b in boxes:
        if cur and (b[1] + b[3]) / 2 - (cur[-1][1] + cur[-1][3]) / 2 > (b[3] - b[1]) * 0.6:
            rows.append(cur)
            cur = []
        cur.append(b)
    if cur:
        rows.append(cur)
    ordered = [b for row in rows for b in sorted(row, key=lambda b: b[0])]
    return [(b[0] * s - 4, b[1] * s - 4, (b[2] + 1) * s + 4, (b[3] + 1) * s + 4) for b in ordered]


def fit(im: Image.Image, size: int) -> Image.Image:
    k = min(1, size / max(im.size))
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS) if k < 1 else im


def save(im: Image.Image, name: str, size: int):
    p = OUT / f'{name}.webp'
    p.parent.mkdir(parents=True, exist_ok=True)
    fit(im, size).save(p, 'WEBP', quality=90, method=6)


def main():
    for job in JOBS:
        src, kind, out, size = job[:4]
        reach = job[4] if len(job) > 4 else 2
        im = Image.open(SRC / f'{src}.png')
        if kind == 'tex':
            save(im.convert('RGB'), out, size)
        elif kind == 'black':
            save(black_trim(im.convert('RGB')), out, size)
        elif kind == 'key':
            save(trim(chroma_key(im)), out, size)
        elif kind == 'split':
            rgba = chroma_key(im)
            boxes = pieces(rgba, len(out), reach)
            if len(boxes) != len(out):
                print(f'!! {src}: 조각 {len(boxes)}개 (기대 {len(out)}개)')
            for name, box in zip(out, boxes):
                save(trim(rgba.crop(box)), name, size)
        print('ok', src)


if __name__ == '__main__':
    main()
