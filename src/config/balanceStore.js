import { BALANCE } from './balance.js';

// 옵션 창으로 바꾼 밸런스 (2026-11-27 사용자 요청).
// - 기본값 = balance.js 의 지금 값 (DEFAULTS). 바꾼 것만 '규칙'(rules: { 'gun.dmg': 12, ... })으로 다룬다.
// - 내 PC 에 저장(localStorage). 내가 방장인 방은 이 규칙을 로비·경기 시작 때 모두에게 보내고, 받은 쪽도 그 값으로 플레이.
// - BALANCE 객체를 그 자리에서 고친다 (게임 코드는 모두 같은 객체를 받으므로 그대로 따라간다).

// 옵션 창에서 빼는 것: 그림 판정·통신 같은 전문 값, 판 시간(로비에서 3·5·10분으로 고름)
export const EDITABLE = (path) => !/^(judge|net)\./.test(path) && path !== 'match.seconds';

export const DEFAULTS = structuredClone(BALANCE);
const KEY = 'ink.rules.v1';

// [경로, 값] 목록 (배열은 한 칸)
export function leaves(obj = DEFAULTS, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...leaves(v, p));
    else out.push([p, v]);
  }
  return out;
}

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setPath(obj, path, v) {
  const ks = path.split('.');
  const last = ks.pop();
  const o = ks.reduce((a, k) => a[k], obj);
  o[last] = Array.isArray(v) ? [...v] : v;
}

const okNum = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1e6;

// 그 경로에 넣어도 되는 값인가 (기본값과 같은 모양: 숫자 / 숫자 배열)
export function validRule(path, v) {
  if (!EDITABLE(path)) return false;
  const d = getPath(DEFAULTS, path);
  if (d === undefined || (typeof d === 'object' && !Array.isArray(d))) return false;
  if (Array.isArray(d)) return Array.isArray(v) && v.length <= 12 && v.every(okNum);
  return okNum(v);
}

const same = (a, b) => (Array.isArray(a) ? Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]) : a === b);

// 지금 BALANCE 에서 기본값과 다른 것만
export function currentRules(cur = BALANCE) {
  const out = {};
  for (const [p, d] of leaves(DEFAULTS)) {
    if (!EDITABLE(p)) continue;
    const v = getPath(cur, p);
    if (!same(v, d)) out[p] = Array.isArray(v) ? [...v] : v;
  }
  return out;
}

// BALANCE 를 기본값으로 되돌린 뒤 규칙을 얹는다 (잘못된 값은 버림)
export function applyRules(rules = {}) {
  for (const [p, d] of leaves(DEFAULTS)) setPath(BALANCE, p, d);
  for (const [p, v] of Object.entries(rules || {})) if (validRule(p, v)) setPath(BALANCE, p, v);
}

export function loadLocalRules() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || '{}');
    return r && typeof r === 'object' ? r : {};
  } catch {
    return {};
  }
}

export function saveLocalRules(rules) {
  try {
    if (Object.keys(rules).length) localStorage.setItem(KEY, JSON.stringify(rules));
    else localStorage.removeItem(KEY);
  } catch {}
}
