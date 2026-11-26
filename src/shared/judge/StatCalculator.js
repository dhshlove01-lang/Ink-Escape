import { msg } from '../i18n/strings.js';

// 판정 결과(색·형태) + 소환 옵션 → 몬스터 스탯과 잉크 비용.
// 미리보기(술래 화면)와 실제 소환(방장)이 같은 함수를 쓴다.

export class StatCalculator {
  constructor({ balance, palette, attributes }) {
    this.b = balance;
    this.palette = palette;
    this.attrs = attributes;
  }

  // 칠한 면적 기준 주 색상. 검정은 외곽선 보정으로 0.6배.
  attributesFrom(colorCounts) {
    const j = this.b.judge;
    const weighted = [];
    for (let i = 1; i < colorCounts.length; i++) {
      const p = this.palette[i];
      if (!p) continue;
      const v = colorCounts[i] * (p.key === 'black' ? j.blackWeight : 1);
      if (v > 0) weighted.push({ key: p.key, v });
    }
    weighted.sort((a, b) => b.v - a.v);
    if (!weighted.length) return [];
    const [first, second] = weighted;
    if (second && second.v >= first.v * j.dualRatio) {
      return [{ key: first.key, w: 0.5 }, { key: second.key, w: 0.5 }];
    }
    return [{ key: first.key, w: 1 }];
  }

  mult(attrs, prop) {
    return attrs.reduce((acc, a) => {
      const base = this.attrs[a.key][prop];
      return base === undefined ? acc : acc * (1 + (base - 1) * a.w);
    }, 1);
  }

  onHit(attrs) {
    const out = {};
    for (const a of attrs) {
      const h = this.attrs[a.key].onHit;
      if (!h) continue;
      if (h.burn) out.burn = { dps: h.burn.dps * a.w, sec: h.burn.sec };
      if (h.poison) out.poison = { dps: h.poison.dps * a.w, sec: h.poison.sec };
      if (h.slow) out.slow = { amount: h.slow.amount * a.w, sec: h.slow.sec };
    }
    return out;
  }

  /**
   * @param analysis DrawingAnalyzer.analyze() 결과
   * @param opt { boss, allIn, ink, frenzy, inkProfile:{bossHp}, bossReadyIn }
   */
  evaluate(analysis, opt) {
    const b = this.b;
    if (analysis.empty) return fail(msg('judge.empty'));
    if (analysis.areaPct < b.ink.minAreaPct) return fail(msg('judge.smallArea', { n: b.ink.minAreaPct }), analysis);
    if (analysis.extent < b.ink.minExtent) return fail(msg('judge.smallSize'), analysis);

    const attrs = this.attributesFrom(analysis.colorCounts);
    if (!attrs.length) return fail(msg('judge.noColor'), analysis);

    const kind = opt.boss && opt.allIn ? 'giant' : opt.boss ? 'boss' : 'normal';
    const baseInk = Math.ceil(analysis.areaPct);
    let cost = baseInk;
    if (kind === 'boss') cost = baseInk * b.ink.bossCostMult;
    if (kind === 'giant') cost = Math.floor(opt.ink);

    const result = { ok: true, kind, cost: opt.frenzy ? 0 : cost, attrs, traits: analysis.traits, areaPct: analysis.areaPct };

    if (kind !== 'normal' && opt.bossReadyIn > 0) return { ...result, ok: false, reason: msg('judge.bossWait', { n: Math.ceil(opt.bossReadyIn) }) };
    if (kind === 'giant' && opt.frenzy) return { ...result, ok: false, reason: msg('judge.noAllInFrenzy') };
    if (kind === 'giant' && opt.ink < b.ink.giantMinInk) return { ...result, ok: false, reason: msg('judge.allInMin', { n: b.ink.giantMinInk }) };
    if (!opt.frenzy && cost > opt.ink) return { ...result, ok: false, reason: msg('judge.noInk') };

    result.stats = this.stats(analysis, attrs, kind, opt);
    return result;
  }

  stats(analysis, attrs, kind, opt) {
    const b = this.b;
    const m = b.monster;
    const N = b.judge.grid;
    const t = analysis.traits;

    let height = (analysis.bbox.h / N) * m.baseHeight;
    let width = (analysis.bbox.w / N) * m.baseHeight;
    const maxDim = Math.max(height, width);
    if (maxDim < m.minHeight) {
      const k = m.minHeight / maxDim;
      height *= k;
      width *= k;
    }
    const sizeT = clamp((Math.max(height, width) - m.minHeight) / (m.baseHeight - m.minHeight), 0, 1);
    let speed = m.baseSpeed * (1 - m.sizeSlow * sizeT) * this.mult(attrs, 'speed');
    let hp = Math.ceil(analysis.areaPct) * m.hpPerInk * this.mult(attrs, 'hp');
    let dps = m.meleeDps * this.mult(attrs, 'dmg');
    const bossHp = opt.inkProfile?.bossHp ?? 1;

    if (kind === 'boss') {
      height *= b.boss.size;
      width *= b.boss.size;
      hp *= b.boss.hp * bossHp;
      dps *= b.boss.dmg;
      speed *= b.boss.speed;
    } else if (kind === 'giant') {
      height *= b.giant.size;
      width *= b.giant.size;
      hp = Math.min(Math.floor(opt.ink) * m.hpPerInk * this.mult(attrs, 'hp'), b.giant.hpCap * bossHp);
      dps *= b.giant.dmg;
      speed *= b.giant.speed;
    }

    // 천장 아래로 키 제한 (비율 유지해서 줄임)
    const maxH = m.maxHeight - (t.fly ? m.flyHeight : 0);
    if (height > maxH) {
      const k = maxH / height;
      height *= k;
      width *= k;
    }

    // 원거리: 촉수 길이 비례, 보라(독)는 15m, 둘 다면 1.3배
    const j = b.judge;
    let ranged = 0;
    if (t.limbs > 0) {
      ranged = j.limbRangeMin + (j.limbRangeMax - j.limbRangeMin) * clamp((t.limbRatio - j.limbRatio) / 1.3, 0, 1);
    }
    const purple = attrs.some((a) => this.attrs[a.key].ranged);
    if (purple) {
      const pr = Math.max(...attrs.map((a) => this.attrs[a.key].ranged || 0));
      ranged = ranged ? Math.max(ranged, pr) * j.comboRangeMult : pr;
    }

    return {
      kind,
      attrs,
      fly: !!t.fly,
      dash: !!t.dash,
      ranged: Math.round(ranged * 10) / 10,
      hp: Math.round(hp),
      height: round2(height),
      width: round2(width),
      speed: round2(speed),
      dps: round2(dps),
      reach: round2(0.9 + width * 0.35),
      radius: round2(clamp(width * 0.3, 0.3, kind === 'normal' ? 0.9 : 1.6)),
      onHit: this.onHit(attrs),
    };
  }

  // 미리보기·공지용 아이콘 문자열 (몬스터 이름은 없다)
  icons(attrs, traits, stats) {
    const parts = attrs.map((a) => this.attrs[a.key].icon + (a.w < 1 ? '½' : ''));
    if (traits?.fly) parts.push('🪽');
    if (traits?.dash) parts.push('💨');
    if (stats?.ranged) parts.push('🎯');
    return parts.join(' ');
  }
}

function fail(reason, analysis) {
  return { ok: false, reason, cost: analysis ? Math.ceil(analysis.areaPct) : 0, attrs: [], traits: analysis?.traits || {} };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round2 = (v) => Math.round(v * 100) / 100;
