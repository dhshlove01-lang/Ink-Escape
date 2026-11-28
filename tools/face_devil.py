"""assets/source/devil_face.png (AI 초상화) → assets/ui/faces/devil.webp (투명 배경 192px).

다른 4종 초상화(shiba·bear·rabbit·cat)와 같은 방식: 이미지 AI 로 그린 얼굴 → 체커보드 배경 제거 → 192px webp.
AI 가 그린 '체커보드'는 진짜 투명이 아니라 그림이므로, 테두리에서 이어진 밝은 회색만 지운다
(눈·송곳니의 흰색은 피사체 안쪽이라 남는다). 가장자리 3px 은 가장 가까운 안쪽 색으로 바꿔 회색 테두리를 없앤다.

사용: python3 tools/face_devil.py      (Pillow, numpy, scipy)
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'source' / 'devil_face.png'
DST = ROOT / 'assets' / 'ui' / 'faces' / 'devil.webp'
TARGET_H = 192
PAD = 4


def main():
    im = Image.open(SRC).convert('RGB')
    a = np.asarray(im).astype(np.int16)
    lum = a.mean(axis=2)
    sat = a.max(axis=2) - a.min(axis=2)
    cand = (lum > 205) & (sat < 16)  # 체커보드(밝은 흰/회색)만 후보

    seed = np.zeros_like(cand)
    seed[0, :] = seed[-1, :] = True
    seed[:, 0] = seed[:, -1] = True
    seed &= cand
    lab, _ = ndimage.label(cand)
    keep = np.unique(lab[seed])
    bg = np.isin(lab, keep[keep > 0])

    alpha = np.where(bg, 0, 255).astype(np.uint8)
    inner = ndimage.binary_erosion(~bg, iterations=1)
    alpha[(~bg) & (~inner)] = 150  # 1px 부드러운 테두리

    rgb = np.asarray(im).astype(np.float32)
    fringe = ndimage.binary_dilation(bg, iterations=3) & ~bg
    _, (iy, ix) = ndimage.distance_transform_edt(bg, return_indices=True)
    rgb[fringe] = rgb[iy[fringe], ix[fringe]]  # 가장자리 회색 오염 제거

    out = Image.fromarray(np.dstack([rgb.clip(0, 255).astype(np.uint8), alpha]), 'RGBA')
    out = out.crop(out.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox())
    canvas = Image.new('RGBA', (out.width + PAD * 2, out.height + PAD * 2), (0, 0, 0, 0))
    canvas.alpha_composite(out, (PAD, PAD))
    w = round(canvas.width * TARGET_H / canvas.height)
    canvas.resize((w, TARGET_H), Image.LANCZOS).save(DST, 'WEBP', quality=92, method=6)
    print('saved', DST.relative_to(ROOT), (w, TARGET_H))


if __name__ == '__main__':
    main()
