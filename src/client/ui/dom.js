import { url } from '../render/Images.js';

// 작은 DOM 도우미들.

/** 아이콘 이미지(있으면) 또는 대체 글자(이모지) */
export function icon(key, fallback = '') {
  const u = url(key);
  if (!u) return document.createTextNode(fallback);
  const im = document.createElement('img');
  im.src = u;
  im.alt = fallback;
  im.className = 'ico';
  im.draggable = false;
  return im;
}

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

// 화면 가운데 큰 알림 (보스 경고, 1분 남음 등)
export class Banner {
  constructor(parent) {
    this.root = el('div', { class: 'banner-stack' });
    parent.append(this.root);
  }

  show(text, { kind = 'info', ms = 2600 } = {}) {
    const b = el('div', { class: `banner banner-${kind}` }, text);
    this.root.append(b);
    setTimeout(() => b.classList.add('out'), ms);
    setTimeout(() => b.remove(), ms + 400);
  }
}

export function toast(text, kind = 'info') {
  let host = document.getElementById('toasts');
  if (!host) {
    host = el('div', { id: 'toasts' });
    document.body.append(host);
  }
  const t = el('div', { class: `toast toast-${kind}` }, text);
  host.append(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3000);
}
