"""GLB 안의 텍스처를 줄인다 (가로·세로 최대 --max, PNG/큰 그림은 JPEG 로).

사용: python3 tools/glb_shrink.py <입력.glb> <출력.glb> [--max 1024] [--quality 88]
- 메시·재질은 그대로, 이미지 bufferView 만 바꿔 다시 묶는다.
- 투명(알파)이 실제로 쓰이는 PNG 는 PNG 로 남긴다 (크기만 줄임).
"""
import io
import json
import struct
import sys

from PIL import Image


def read_glb(path):
    data = open(path, 'rb').read()
    magic, _version, _length = struct.unpack('<4sII', data[:12])
    assert magic == b'glTF', 'GLB 아님'
    off = 12
    js, binc = None, b''
    while off < len(data):
        clen, ctype = struct.unpack('<I4s', data[off:off + 8])
        chunk = data[off + 8:off + 8 + clen]
        if ctype == b'JSON':
            js = json.loads(chunk)
        elif ctype == b'BIN\x00':
            binc = chunk
        off += 8 + clen
    return js, binc


def write_glb(path, js, binc):
    jb = json.dumps(js, separators=(',', ':')).encode()
    jb += b' ' * ((4 - len(jb) % 4) % 4)
    binc += b'\x00' * ((4 - len(binc) % 4) % 4)
    total = 12 + 8 + len(jb) + 8 + len(binc)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<I4s', len(jb), b'JSON') + jb)
        f.write(struct.pack('<I4s', len(binc), b'BIN\x00') + binc)


def shrink(src, dst, max_size=1024, quality=88):
    js, binc = read_glb(src)
    views = js['bufferViews']
    new_bytes = {}
    for img in js.get('images', []):
        bv = img['bufferView']
        v = views[bv]
        raw = binc[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
        im = Image.open(io.BytesIO(raw))
        im.load()
        has_alpha = im.mode in ('RGBA', 'LA') and im.getchannel('A').getextrema()[0] < 250
        scale = min(1.0, max_size / max(im.size))
        if scale < 1:
            im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        out = io.BytesIO()
        if has_alpha:
            im.save(out, 'PNG', optimize=True)
            mime = 'image/png'
        else:
            im.convert('RGB').save(out, 'JPEG', quality=quality, optimize=True)
            mime = 'image/jpeg'
        if scale == 1 and mime == img.get('mimeType') and len(out.getvalue()) >= len(raw):
            continue  # 줄일 게 없음
        new_bytes[bv] = out.getvalue()
        img['mimeType'] = mime
    # bufferView 들을 순서대로 다시 이어 붙인다
    out = bytearray()
    for i, v in enumerate(views):
        if v.get('buffer', 0) != 0:
            continue
        chunk = new_bytes.get(i) or binc[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
        out += b'\x00' * ((4 - len(out) % 4) % 4)
        v['byteOffset'] = len(out)
        v['byteLength'] = len(chunk)
        out += chunk
    js['buffers'][0]['byteLength'] = len(out)
    write_glb(dst, js, bytes(out))


if __name__ == '__main__':
    args = sys.argv[1:]
    opts = {'--max': 1024, '--quality': 88}
    pos = []
    i = 0
    while i < len(args):
        if args[i] in opts:
            opts[args[i]] = int(args[i + 1])
            i += 2
        else:
            pos.append(args[i])
            i += 1
    shrink(pos[0], pos[1], opts['--max'], opts['--quality'])
