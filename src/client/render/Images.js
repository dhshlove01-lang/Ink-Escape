import * as THREE from 'three';

// 2D 이미지 불러오기 창구. 다 불러온 것만 돌려주고, 없으면 null → 쓰는 쪽이 코드 그리기로 대체.
// 화면들은 이 모듈의 함수만 안다 (어디서 어떻게 불러오는지는 모름).

const images = new Map(); // key → HTMLImageElement (불러오기 끝난 것만)
const textures = new Map();
let urls = {};

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('이미지 없음: ' + url));
    im.src = url;
  });
}

export function loadImages(defs) {
  urls = { ...urls, ...defs };
  return Promise.allSettled(
    Object.entries(defs).map(async ([key, url]) => {
      try {
        images.set(key, await loadImage(url));
      } catch (e) {
        console.warn('[image]', e.message);
      }
    }),
  );
}

/** 불러온 이미지 또는 null */
export function img(key) {
  return images.get(key) || null;
}

/** CSS 등에서 쓸 경로 (불러오기 성공한 것만) */
export function url(key) {
  return images.has(key) ? urls[key] : null;
}

/** three.js 텍스처 (한 번 만들어 재사용). opts: { repeat:[x,y], srgb:true } */
export function texture(key, { repeat, clone = false } = {}) {
  const im = images.get(key);
  if (!im) return null;
  let t = textures.get(key);
  if (!t) {
    t = new THREE.Texture(im);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.needsUpdate = true;
    textures.set(key, t);
  }
  if (repeat || clone) {
    t = t.clone();
    t.needsUpdate = true;
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
    }
  }
  return t;
}

/** 이미지 하나 불러와 텍스처로 (데칼처럼 목록이 긴 것) */
export async function textureFromUrl(u) {
  const key = 'url:' + u;
  if (!images.has(key)) {
    try {
      images.set(key, await loadImage(u));
    } catch {
      return null;
    }
  }
  return texture(key);
}
