import { rasterize, silhouette, CANVAS_SIZE } from '../../shared/judge/StrokeRasterizer.js';

// 술래 그림 → 종이 인형 이미지 (흰 종이 테두리 + 안쪽 종이색 채우기 + 원래 획).
// 판정과 같은 실루엣 계산을 써서, 보이는 모양과 판정 모양이 같다.

const PAPER = '#efe7d6';
const EDGE = '#2a221d';
const GRID = 128;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function drawStrokes(ctx, strokes, palette, scale = 1) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    const p = s.p;
    if (!p || p.length < 2) continue;
    ctx.globalCompositeOperation = s.c === 0 ? 'destination-out' : 'source-over';
    ctx.strokeStyle = s.c === 0 ? '#000' : palette[s.c].hex;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = s.w * scale;
    if (p.length === 2) {
      ctx.beginPath();
      ctx.arc(p[0] * scale, p[1] * scale, (s.w * scale) / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(p[0] * scale, p[1] * scale);
    for (let i = 2; i + 1 < p.length; i += 2) ctx.lineTo(p[i] * scale, p[i + 1] * scale);
    ctx.stroke();
  }
  ctx.restore();
}

function tinted(src, color) {
  const c = makeCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

function stampRing(g, img, x, y, r) {
  const n = 20;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.drawImage(img, x + Math.cos(a) * r, y + Math.sin(a) * r);
    g.drawImage(img, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
  }
}

/** @returns {{ canvas, bbox:{x,y,w,h} (원본 512 기준 px), pad }} */
export function buildCutout(strokes, palette, { outline = 13 } = {}) {
  const S = CANVAS_SIZE;
  const cell = S / GRID;
  const sil = silhouette(rasterize(strokes, GRID), GRID);

  let x0 = GRID, y0 = GRID, x1 = -1, y1 = -1;
  const mask = makeCanvas(S, S);
  const mg = mask.getContext('2d');
  mg.fillStyle = '#fff';
  for (let y = 0; y < GRID; y++) {
    let run = -1;
    for (let x = 0; x <= GRID; x++) {
      const on = x < GRID && sil[y * GRID + x];
      if (on) {
        if (run < 0) run = x;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      } else if (run >= 0) {
        mg.fillRect(run * cell, y * cell, (x - run) * cell, cell);
        run = -1;
      }
    }
  }
  if (x1 < 0) {
    x0 = y0 = 0;
    x1 = y1 = GRID - 1;
  }
  const ink = makeCanvas(S, S);
  drawStrokes(ink.getContext('2d'), strokes, palette);
  // 획 자체도 마스크에 (격자보다 매끈하게)
  mg.drawImage(tinted(ink, '#fff'), 0, 0);

  const pad = outline + 5;
  const bx = x0 * cell, by = y0 * cell, bw = (x1 - x0 + 1) * cell, bh = (y1 - y0 + 1) * cell;
  const out = makeCanvas(bw + pad * 2, bh + pad * 2);
  const g = out.getContext('2d');
  const ox = pad - bx, oy = pad - by;
  stampRing(g, tinted(mask, EDGE), ox, oy, outline + 3);
  stampRing(g, tinted(mask, PAPER), ox, oy, outline);
  g.drawImage(tinted(mask, PAPER), ox, oy);
  g.drawImage(ink, ox, oy);
  return { canvas: out, bbox: { x: bx, y: by, w: bw, h: bh }, pad };
}
