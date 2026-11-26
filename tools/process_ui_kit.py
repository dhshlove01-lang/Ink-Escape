"""공용 UI 키트 14종 (assets/source/ui14/*.png, 배경 정확히 #00FF00) → assets/ui/kit/*.webp

- 배경 빼기: 그림 가장자리에서 이어진 초록만 지운다 (flood fill). 그래서 그림 안의 초록(12번 체크 표시)은 남는다.
  경계의 섞인 픽셀은 초록이 튀는 정도로 반투명 + 초록 번짐 제거.
- 상태 스트립(보통/올림/누름 등)은 README 의 x 좌표로 자른다.

사용: python3 -I tools/process_ui_kit.py      (Pillow, numpy)
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'source' / 'ui14'
OUT = ROOT / 'assets' / 'ui' / 'kit'

# (원본, [(결과 이름, x0, x1) ...] 또는 결과 이름 하나, 긴 변 최대 px)
JOBS = [
    ('ui14_01_primary_btn', [('btn_primary', 64, 501), ('btn_primary_hover', 542, 975), ('btn_primary_down', 1015, 1439)], 480),
    ('ui14_02_secondary_btn', [('btn_secondary', 64, 481), ('btn_secondary_hover', 538, 957), ('btn_secondary_down', 1020, 1432)], 480),
    ('ui14_03_danger_btn', [('btn_danger', 55, 597), ('btn_danger_hover', 653, 1192), ('btn_danger_down', 1250, 1708)], 480),
    ('ui14_04_disabled_btn', 'btn_disabled', 600),
    ('ui14_05_large_panel', 'panel_large', 1200),
    ('ui14_06_small_card', 'card_small', 600),
    ('ui14_07_input_box', 'input', 1200),
    ('ui14_08_tab_bar', 'tab_bar', 900),
    ('ui14_09_toggle_switch', [('toggle_off', 64, 643), ('toggle_on', 758, 1337)], 320),
    ('ui14_10_slider', 'slider', 900),
    ('ui14_11_tag_chips', [('chip_gray', 64, 432), ('chip_red', 474, 843), ('chip_blue', 881, 1249), ('chip_yellow', 1294, 1662)], 360),
    ('ui14_12_badges', 'BADGES', 256),
    ('ui14_13_popup_dialog', 'popup', 1200),
    ('ui14_14_alert_banner', 'banner_alert', 1200),
]


def key_green(im: Image.Image) -> Image.Image:
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    spill = g - np.maximum(r, b)
    greenish = spill > 40
    # 가장자리에서 초록 픽셀을 따라 번져 나간 영역 = 배경
    bg = np.zeros_like(greenish)
    bg[0, :], bg[-1, :], bg[:, 0], bg[:, -1] = greenish[0, :], greenish[-1, :], greenish[:, 0], greenish[:, -1]
    while True:
        grown = bg.copy()
        grown[1:, :] |= bg[:-1, :]
        grown[:-1, :] |= bg[1:, :]
        grown[:, 1:] |= bg[:, :-1]
        grown[:, :-1] |= bg[:, 1:]
        grown &= greenish
        if (grown == bg).all():
            break
        bg = grown
    # 배경 바로 옆 2px 띠 (그림 테두리와 섞인 픽셀)
    edge = bg.copy()
    for _ in range(2):
        e = edge.copy()
        e[1:, :] |= edge[:-1, :]
        e[:-1, :] |= edge[1:, :]
        e[:, 1:] |= edge[:, :-1]
        e[:, :-1] |= edge[:, 1:]
        edge = e
    band = edge & ~bg
    alpha = np.ones_like(r)
    alpha[bg] = 0
    soft = 1 - np.clip((spill - 10) / 120, 0, 1)
    alpha[band] = soft[band]
    g2 = g.copy()
    near = bg | band
    g2[near] = np.minimum(g, np.maximum(r, b))[near]  # 경계의 초록 번짐 빼기 (그림 안쪽 초록은 그대로)
    out = np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def trim(im: Image.Image, pad: int = 2) -> Image.Image:
    bb = im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    if not bb:
        return im
    x0, y0, x1, y1 = bb
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))


def save(im: Image.Image, name: str, size: int):
    k = min(1, size / max(im.size))
    if k < 1:
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    p = OUT / f'{name}.webp'
    p.parent.mkdir(parents=True, exist_ok=True)
    im.save(p, 'WEBP', quality=92, method=6)
    print(f'  {name}.webp {im.size}')


def split_columns(rgba: Image.Image, count: int):
    """알파가 있는 세로 띠를 왼→오로 count 개 찾는다 (배지 3개)."""
    cols = (np.asarray(rgba.getchannel('A')) > 20).any(axis=0)
    runs, start = [], None
    for x, on in enumerate(list(cols) + [False]):
        if on and start is None:
            start = x
        elif not on and start is not None:
            runs.append((start, x))
            start = None
    runs.sort(key=lambda r: -(r[1] - r[0]))
    return sorted(runs[:count])


def main():
    for src, out, size in JOBS:
        rgba = key_green(Image.open(SRC / f'{src}.png'))
        print('ok', src)
        if out == 'BADGES':
            for name, (x0, x1) in zip(['badge_crown', 'badge_check', 'badge_ribbon'], split_columns(rgba, 3)):
                save(trim(rgba.crop((x0, 0, x1, rgba.height))), name, size)
        elif isinstance(out, str):
            save(trim(rgba), out, size)
        else:
            for name, x0, x1 in out:
                save(trim(rgba.crop((x0, 0, x1, rgba.height))), name, size)


if __name__ == '__main__':
    main()
