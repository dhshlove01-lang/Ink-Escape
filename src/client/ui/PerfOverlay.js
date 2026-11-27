import { el } from './dom.js';
import { t } from '../i18n.js';
import { gfx } from '../render/GraphicsSettings.js';

// 성능 표시 (F3 으로 켜고 끔, 브라우저에 기억). 경기 화면의 FPS·프레임 시간·자동 해상도·그린 양.
// 숫자는 GraphicsSettings.stats (App 루프가 매 프레임 채움).

const KEY = 'inkEscape.perf';

export function mountPerfOverlay() {
  const box = el('div', { class: 'perf-overlay', hidden: true });
  document.body.append(box);
  let on = false;
  try {
    on = localStorage.getItem(KEY) === '1';
  } catch {}
  const set = (v) => {
    on = v;
    box.hidden = !on;
    try {
      localStorage.setItem(KEY, on ? '1' : '0');
    } catch {}
  };
  set(on);
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'F3') return;
    e.preventDefault();
    set(!on);
  });
  const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(Math.round(n)));
  setInterval(() => {
    if (!on) return;
    const s = gfx.stats;
    // 보이는 3D 화면 중 가장 큰 캔버스 = 지금 그리는 해상도
    let canvas = null;
    for (const c of document.querySelectorAll('canvas')) if (c.offsetParent && (!canvas || c.width * c.height > canvas.width * canvas.height)) canvas = c;
    const res = canvas ? `${canvas.width}×${canvas.height}` : '—';
    box.textContent = [
      `${t('perf.fps')} ${s.fps ? Math.round(s.fps) : '—'} · ${s.ms ? s.ms.toFixed(1) : '—'}ms`,
      `${t('perf.res')} ${res} (${Math.round(gfx.scale * 100)}%)`,
      `${t('perf.draw')} ${fmt(s.calls)} · ${t('perf.tris')} ${fmt(s.tris)}`,
      `${t('perf.ink')} ${gfx.preset.ink !== false ? 'ON' : 'OFF'} · ${t('gfx.' + gfx.level)}`,
    ].join('\n');
  }, 250);
}
