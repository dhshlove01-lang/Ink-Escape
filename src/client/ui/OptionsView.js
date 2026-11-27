import { el, toast } from './dom.js';
import { t } from '../i18n.js';
import { BALANCE } from '../../config/balance.js';
import { DEFAULTS, EDITABLE, leaves, getPath, validRule, currentRules, applyRules, saveLocalRules } from '../../config/balanceStore.js';
import { AUGMENTS } from '../../config/augments.js';
import { augName } from './AugmentPicker.js';

// 옵션 창: balance.js 의 모든 값을 묶음(탭)별로 고친다. 적용 = 내 PC 에 저장 + 지금부터 내가 만드는 방에 모두 적용.
// 값 모양(경로·기본값)은 balanceStore 가, 글씨는 strings.js 'opt.*' 가 맡는다 — 새 밸런스 값은 balance.js 에 넣고
// 글씨 한 줄(opt.<경로>)만 더하면 여기 자동으로 뜬다.

const AUG_P = new Set(AUGMENTS.player.map((a) => a.key));

// 경로 → 탭
function groupOf(path) {
  const [g, k] = path.split('.');
  if (g === 'aug') return AUG_P.has(k) ? 'augPlayer' : 'augTagger';
  return g;
}
const TABS = ['match', 'player', 'gun', 'grenade', 'ink', 'spawn', 'monster', 'boss', 'giant', 'supply', 'augPlayer', 'augTagger', 'score'];

// 경로 → 보이는 이름
function labelOf(path) {
  const ks = path.split('.');
  if (ks[0] === 'aug') return `${augName(ks[1])} · ${t('opt.augp.' + ks[2])}`;
  if (ks[0] === 'ink' && ks[1] === 'byPlayers') return t('opt.ink.' + ks[3], { n: ks[2] });
  return t('opt.' + path);
}

const fmt = (v) => (Array.isArray(v) ? v.join(', ') : String(v));
const parse = (text, def) => (Array.isArray(def) ? text.split(',').map((x) => x.trim()).filter(Boolean).map(Number) : Number(text));
const stepOf = (d) => (Number.isInteger(d) ? (d >= 100 ? 10 : 1) : d < 1 ? 0.05 : 0.1);

export function optionsModal({ onClose }) {
  const rows = []; // { path, def, input, row }
  let tab = TABS[0];
  const tabBar = el('div', { class: 'opt-tabs', role: 'tablist' });
  const list = el('div', { class: 'opt-list' });
  const count = el('span', { class: 'opt-count' });

  for (const [path, def] of leaves(DEFAULTS)) {
    if (!EDITABLE(path)) continue;
    const input = el('input', {
      class: 'opt-input',
      type: Array.isArray(def) ? 'text' : 'number',
      step: Array.isArray(def) ? undefined : stepOf(def),
      min: Array.isArray(def) ? undefined : 0,
      value: fmt(getPath(BALANCE, path)),
      'aria-label': labelOf(path),
    });
    const reset = el('button', { class: 'opt-reset', title: t('opt.resetOne'), onclick: () => { input.value = fmt(def); mark(); } }, '↺');
    const row = el('label', { class: 'opt-row' },
      el('span', { class: 'opt-label' }, labelOf(path)),
      input,
      el('span', { class: 'opt-def' }, t('opt.default', { v: fmt(def) })),
      reset,
    );
    input.addEventListener('input', () => mark());
    rows.push({ path, def, input, row, group: groupOf(path) });
  }

  // 기본값과 다른 칸은 노랗게, 탭에도 표시
  const changed = (r) => fmt(parse(r.input.value, r.def)) !== fmt(r.def);
  function mark() {
    let n = 0;
    const per = {};
    for (const r of rows) {
      const c = changed(r);
      r.row.classList.toggle('changed', c);
      r.row.classList.toggle('bad', !validRule(r.path, parse(r.input.value, r.def)));
      if (c) (n++, (per[r.group] = (per[r.group] || 0) + 1));
    }
    count.textContent = t('opt.changed', { n });
    for (const b of tabBar.children) b.classList.toggle('dot', !!per[b.dataset.tab]);
  }

  function show(g) {
    tab = g;
    for (const b of tabBar.children) b.classList.toggle('on', b.dataset.tab === g);
    list.replaceChildren(...rows.filter((r) => r.group === g).map((r) => r.row));
    list.scrollTop = 0;
  }
  tabBar.append(...TABS.map((g) => el('button', { class: 'opt-tab', role: 'tab', 'data-tab': g, onclick: () => show(g) }, t('opt.g.' + g))));

  function collect() {
    const rules = {}, bad = [];
    for (const r of rows) {
      const v = parse(r.input.value, r.def);
      if (!validRule(r.path, v)) bad.push(labelOf(r.path));
      else if (fmt(v) !== fmt(r.def)) rules[r.path] = v;
    }
    return { rules, bad };
  }

  const apply = () => {
    const { rules, bad } = collect();
    if (bad.length) return toast(t('opt.bad', { list: bad.slice(0, 3).join(', ') }), 'warn');
    saveLocalRules(rules);
    applyRules(rules);
    toast(t('opt.applied'));
    close();
  };
  const resetAll = () => {
    if (!confirm(t('opt.confirmReset'))) return;
    for (const r of rows) r.input.value = fmt(r.def);
    saveLocalRules({});
    applyRules({});
    mark();
    toast(t('opt.resetDone'));
  };
  const close = () => {
    // 적용하지 않은 입력은 버리고 지금 값으로 되돌려 둔다
    for (const r of rows) r.input.value = fmt(getPath(BALANCE, r.path));
    mark();
    back.hidden = true;
    onClose?.();
  };

  const back = el('div', { class: 'modal-back', hidden: true, onclick: (e) => e.target === back && close() },
    el('div', { class: 'modal-card wide opt-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('opt.title') },
      el('h2', { class: 'modal-title' }, '⚙ ', t('opt.title')),
      el('p', { class: 'opt-hint' }, t('opt.hint')),
      tabBar,
      list,
      el('div', { class: 'modal-actions opt-actions' },
        el('button', { class: 'btn ghost opt-resetall', onclick: resetAll }, t('opt.resetAll')),
        count,
        el('button', { class: 'btn ghost', onclick: close }, t('common.cancel')),
        el('button', { class: 'btn primary', onclick: apply }, t('opt.apply')),
      ),
    ),
  );
  back.addEventListener('keydown', (e) => e.key === 'Escape' && close());
  show(tab);
  mark();
  back.open = () => {
    for (const r of rows) r.input.value = fmt(getPath(BALANCE, r.path));
    mark();
    back.hidden = false;
  };
  return back;
}

// 로비 표시용: 이 방 규칙 {경로: 값} → "이름: 기본 → 값" 목록
export function describeRules(rules = {}) {
  return Object.entries(rules).map(([p, v]) => `${labelOf(p)}: ${fmt(getPath(DEFAULTS, p))} → ${fmt(v)}`);
}

export { currentRules };
