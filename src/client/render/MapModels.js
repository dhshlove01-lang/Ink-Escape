import * as THREE from 'three';
import { getModelLibrary } from './AnimalModels.js';

// 맵 소품 GLB 하나를 자리에 놓는다. GLB 가 오기 전(또는 못 받으면)에는 fallback 도형을 보여 주고,
// 도착하면 그 자리에서 바꿔 끼운다. fit 을 주면 모델 크기를 그 치수(m)에 맞춘다 (축마다 따로).
//   fit: { x?, y?, z? }  decorate(model): 바꿔 낄 때마다 한 번 (재질 손보기 등)
export function placeModel(name, { fallback = null, fit = null, decorate = null } = {}) {
  const holder = new THREE.Group();
  if (fallback) holder.add(fallback);
  const lib = getModelLibrary();
  if (!lib || !lib.defs[name]) return holder;
  const put = () => {
    const m = lib.get(name);
    if (!m) return;
    if (fit) fitModel(m, fit);
    decorate?.(m);
    holder.clear();
    holder.add(m);
  };
  if (lib.has(name)) put();
  else {
    lib.onReady(name, put);
    lib.load(name);
  }
  return holder;
}

// 축마다 다른 배율로 치수에 맞춘다 (발은 y=0 그대로)
function fitModel(m, fit) {
  const size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
  const k = (v, s) => v / Math.max(s, 1e-6);
  const sy = fit.y ? k(fit.y, size.y) : null;
  const sx = fit.x ? k(fit.x, size.x) : null;
  const sz = fit.z ? k(fit.z, size.z) : null;
  // 안 준 축은: 가로(x·z)는 서로 따라가고, 둘 다 없으면 높이 비율을 따른다
  const h = sx ?? sz ?? sy ?? 1;
  m.scale.set(sx ?? h, sy ?? h, sz ?? h);
}
