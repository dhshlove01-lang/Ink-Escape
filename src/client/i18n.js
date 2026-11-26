import { STRINGS, LANGS } from '../shared/i18n/strings.js';

// 언어 고르기·기억·번역. 화면 코드는 t('키', {값}) 만 쓴다.
// 첫 실행은 브라우저 언어(한국어면 ko, 아니면 en), 고르면 이 브라우저에 기억.

const KEY = 'inkescape.lang';
const listeners = new Set();

function initial() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && STRINGS[saved]) return saved;
  } catch {}
  const nav = (navigator.language || 'ko').toLowerCase();
  return nav.startsWith('ko') ? 'ko' : 'en';
}

let lang = initial();
document.documentElement.lang = lang;

export function getLang() {
  return lang;
}

export function setLang(code) {
  if (!STRINGS[code] || code === lang) return;
  lang = code;
  document.documentElement.lang = code;
  try {
    localStorage.setItem(KEY, code);
  } catch {}
  for (const fn of listeners) fn(code);
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export { LANGS };

/** 번역. 키가 없으면 한국어 → 키 그대로 */
export function t(key, params) {
  let s = STRINGS[lang]?.[key] ?? STRINGS.ko[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? tr(params[k]) : m));
  return s;
}

/** 방장이 보낸 메시지 번역: { key, params } · '키' · 그냥 문장 모두 받는다 */
export function tr(m) {
  if (m === null || m === undefined) return '';
  if (typeof m === 'object' && m.key) return t(m.key, m.params);
  if (typeof m === 'string' && (STRINGS.ko[m] !== undefined)) return t(m);
  return String(m);
}
