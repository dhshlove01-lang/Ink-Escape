"""앞발 그림 1장 -> 닫힌 3D 메시 + 그림 텍스처 GLB.

그림의 실루엣을 거리변환으로 부풀려(앞/뒤 양면) 닫힌 메시를 만들고, 같은 그림을
텍스처로 입힌다. 1인칭 뷰모델처럼 시점이 거의 고정된 곳에서 그림 그대로의
색·굵은 잉크 외곽선을 유지한 채 부피만 생긴다.

사용: python3 .work/paw_mesh.py <입력.png> <출력.glb> [--grid 170] [--depth 0.42] [--unlit]
"""
import sys, json, struct
import numpy as np
import cv2


def load_mask(path, thr=34):
    bgr = cv2.imread(path, cv2.IMREAD_COLOR)
    h, w = bgr.shape[:2]
    # 배경은 무채색 회색(채도 0)이라, 색이 있거나(채도) 어두운(잉크) 픽셀만 앞발로 본다.
    # 색거리 방식은 배경의 밝기 그라데이션까지 앞발로 잡아 회색 테두리가 남았다.
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    sat = hsv[:, :, 1].astype(np.int32)
    val = hsv[:, :, 2].astype(np.int32)
    mask = ((sat > 24) | (val < 150)).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    if n > 2:
        keep = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        mask = (lab == keep).astype(np.uint8)
    # 안쪽 구멍 메우기
    inv = (1 - mask).astype(np.uint8)
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(inv, 4)
    for i in range(1, n2):
        x, y, ww, hh, area = st2[i]
        if x == 0 or y == 0 or x + ww == w or y + hh == h:
            continue
        mask[lab2 == i] = 1
    # 외곽선 바로 바깥의 회색 번짐(안티에일리어싱)을 잘라 낸다 → 메시 가장자리가 잉크 선 안쪽에 온다
    mask = cv2.erode(mask, np.ones((3, 3), np.uint8), iterations=2)
    return bgr, mask.astype(np.uint8)


def build(path, out, grid=170, depth_ratio=0.42, unlit=False, gamma=0.55, zoom=1.0):
    bgr, mask = load_mask(path)
    H, W = mask.shape
    ys, xs = np.where(mask > 0)
    if zoom < 1.0:
        # 앞발(주먹) 쪽으로 잘라 낸다: 그림의 앞발은 바운딩박스 왼쪽 위에 있다
        side = int(max(ys.max() - ys.min(), xs.max() - xs.min()) * zoom)
        cy0 = max(0, min(ys.min() - side // 12, H - side))
        cx0 = max(0, min(xs.min() - side // 12, W - side))
        bgr = bgr[cy0:cy0 + side, cx0:cx0 + side].copy()
        mask = mask[cy0:cy0 + side, cx0:cx0 + side].copy()
        H, W = mask.shape
        ys, xs = np.where(mask > 0)
    cy, cx = (ys.min() + ys.max() + 1) / 2, (xs.min() + xs.max() + 1) / 2
    half = max(ys.max() - ys.min(), xs.max() - xs.min()) / 2 * 1.04
    y0 = int(max(0, cy - half)); y1 = int(min(H, cy + half))
    x0 = int(max(0, cx - half)); x1 = int(min(W, cx + half))

    # 텍스처와 기하가 같은 영역을 쓰도록 잘라 낸 사각형으로 둘 다 다시 만든다
    img = bgr[y0:y1, x0:x1].copy()
    ms = mask[y0:y1, x0:x1]
    m = cv2.resize(ms, (grid, grid), interpolation=cv2.INTER_AREA).astype(np.float32)
    inside = m > 0.5
    d = cv2.distanceTransform(inside.astype(np.uint8), cv2.DIST_L2, 5)
    t = d / max(float(d.max()), 1e-6)
    zf = np.sqrt(np.maximum(0.0, 1.0 - (1.0 - t) ** 2)) ** gamma
    z = zf * depth_ratio

    uu = (np.arange(grid) + 0.5) / grid
    vv = (np.arange(grid) + 0.5) / grid
    X, Y = np.meshgrid(uu, vv)
    x = X - 0.5
    y = 0.5 - Y

    ids = -np.ones((grid, grid), np.int64)
    iy, ix = np.where(inside)
    if len(iy) == 0:
        raise SystemExit("앞발을 찾지 못했습니다: " + path)
    ids[iy, ix] = np.arange(len(iy))

    fpos = np.stack([x[iy, ix], y[iy, ix], z[iy, ix]], 1)
    bpos = np.stack([x[iy, ix], y[iy, ix], -z[iy, ix]], 1)
    fuv = np.stack([X[iy, ix], 1 - Y[iy, ix]], 1)
    buv = np.stack([1 - X[iy, ix], 1 - Y[iy, ix]], 1)
    n = len(fpos)
    pos = np.vstack([fpos, bpos]).astype(np.float32)
    uv = np.vstack([fuv, buv]).astype(np.float32)

    tris = []
    for yy, xx in zip(iy, ix):
        if yy + 1 >= grid or xx + 1 >= grid:
            continue
        a, b, c, dd = ids[yy, xx], ids[yy, xx + 1], ids[yy + 1, xx + 1], ids[yy + 1, xx]
        if min(a, b, c, dd) < 0:
            continue
        tris += [(a, c, b), (a, dd, c)]                           # 앞면(+Z)
        tris += [(a + n, b + n, c + n), (a + n, c + n, dd + n)]   # 뒷면
    tris = np.array(tris, dtype=np.uint32).reshape(-1, 3)

    nrm = np.zeros(pos.shape, np.float64)
    p0, p1, p2 = pos[tris[:, 0]], pos[tris[:, 1]], pos[tris[:, 2]]
    fn = np.cross(p1 - p0, p2 - p0)
    for k in range(3):
        np.add.at(nrm, tris[:, k], fn)
    nrm = (nrm / np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)).astype(np.float32)

    # 텍스처: 가장자리 색을 배경 쪽으로 번지게 해 밉맵이 회색을 끌어오지 않게
    bgsel = ms == 0
    for _ in range(28):
        dil = cv2.dilate(img, np.ones((3, 3), np.uint8))
        img[bgsel] = dil[bgsel]
    ts = 1024
    tex = cv2.resize(img, (ts, ts), interpolation=cv2.INTER_AREA)
    al = (cv2.resize(ms, (ts, ts), interpolation=cv2.INTER_AREA).astype(np.float32) * 255).astype(np.uint8)
    rgba = np.dstack([tex, al]).astype(np.uint8)  # cv2.imencode 는 BGRA 순서
    ok, png = cv2.imencode('.png', rgba)
    assert ok

    glb = write_glb(pos, nrm, uv, tris, png.tobytes(), unlit)
    open(out, 'wb').write(glb)
    print(f"{out}: verts={len(pos)} tris={len(tris)} file={len(glb)/1024:.0f}KB")


def write_glb(pos, nrm, uv, tris, png, unlit):
    parts, views, off = [], [], 0

    def add(buf, target=None):
        nonlocal off
        buf = buf + b'\x00' * ((-len(buf)) % 4)
        views.append((off, len(buf), target))
        off += len(buf)
        parts.append(buf)
        return len(views) - 1

    v_pos = add(pos.tobytes(), 34962)
    v_nrm = add(nrm.tobytes(), 34962)
    v_uv = add(uv.tobytes(), 34962)
    v_idx = add(tris.tobytes(), 34963)
    v_img = add(png)
    blob = b''.join(parts)

    def acc(i, comp, count, typ, minmax=None):
        a = {"bufferView": i, "componentType": comp, "count": int(count), "type": typ}
        if minmax:
            a["min"] = minmax[0]
            a["max"] = minmax[1]
        return a

    accessors = [
        acc(v_pos, 5126, len(pos), "VEC3", [pos.min(0).tolist(), pos.max(0).tolist()]),
        acc(v_nrm, 5126, len(nrm), "VEC3"),
        acc(v_uv, 5126, len(uv), "VEC2"),
        acc(v_idx, 5125, tris.size, "SCALAR"),
    ]
    material = {
        "pbrMetallicRoughness": {
            "baseColorTexture": {"index": 0},
            "metallicFactor": 0.0,
            "roughnessFactor": 0.92,
        },
        "doubleSided": True,
    }
    if unlit:
        material["extensions"] = {"KHR_materials_unlit": {}}
    gltf = {
        "asset": {"version": "2.0", "generator": "pickle paw mesh"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2},
                                   "indices": 3, "material": 0}]}],
        "materials": [material],
        "textures": [{"source": 0, "sampler": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"bufferView": v_img, "mimeType": "image/png"}],
        "accessors": accessors,
        "bufferViews": [{"buffer": 0, "byteOffset": o, "byteLength": l, **({"target": t} if t else {})}
                        for (o, l, t) in views],
        "buffers": [{"byteLength": len(blob)}],
    }
    if unlit:
        gltf["extensionsUsed"] = ["KHR_materials_unlit"]
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    blob += b'\x00' * ((-len(blob)) % 4)
    total = 12 + 8 + len(js) + 8 + len(blob)
    out = struct.pack('<III', 0x46546C67, 2, total)
    out += struct.pack('<II', len(js), 0x4E4F534A) + js
    out += struct.pack('<II', len(blob), 0x004E4942) + blob
    return out


if __name__ == '__main__':
    argv = [a for a in sys.argv[1:] if not a.startswith('--')]
    grid = 170
    depth = 0.42
    zoom = 1.0
    for a in sys.argv[1:]:
        if a.startswith('--grid='):
            grid = int(a.split('=')[1])
        if a.startswith('--depth='):
            depth = float(a.split('=')[1])
        if a.startswith('--zoom='):
            zoom = float(a.split('=')[1])
    build(argv[0], argv[1], grid=grid, depth_ratio=depth, zoom=zoom, unlit='--unlit' in sys.argv)
