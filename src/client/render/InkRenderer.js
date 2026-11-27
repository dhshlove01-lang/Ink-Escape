import * as THREE from 'three';
import { gfx } from './GraphicsSettings.js';

// 잉크 스타일 렌더링 (2026-11-27, art/style/ink-test 시험을 게임에 적용).
//   1) 색: PBR·램버트 재질을 그 자리에서 셀 셰이딩(MeshToonMaterial, 3단 명암)으로 바꿔 그린다 — 원래 재질은 그대로 둔다
//   2) 면 방향·깊이: 따로 한 번 더 그려서
//   3) 합치기: 깊이 차이 = 윤곽선, 면 방향이 크게 꺾인 곳 = 주름선 → 검은 잉크 선 + 종이 결
// 선은 화면 고정 흔들림 없이 물체에 붙어 다닌다. 반투명·빛 효과(스프라이트·빛무리·자국·장판)는 선 계산에서 뺀다.
// 그래픽 '끄기'(gfx.preset.ink === false)면 평소처럼 그냥 그린다.

const DEFAULTS = { fadeNear: 30, fadeFar: 75 }; // 이 거리(m)부터 선이 흐려져 이 거리에서 사라짐

// 셀 명암 띠: 어두움→중간→밝음 3단, 경계만 살짝 부드럽게 (딱 끊으면 털 무늬마다 얼룩)
function rampTexture() {
  const N = 64, d = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const x = i / (N - 1);
    const band = (e) => 1 / (1 + Math.exp(-(x - e) / 0.035));
    const v = 0.38 + 0.27 * band(0.32) + 0.25 * band(0.68); // 밝은 쪽 0.9 — 툰은 PBR 보다 밝게 나와서 (카펫이 눈부셨음)
    d.set([v * 255, v * 248, v * 250, 255], i * 4);
  }
  const t = new THREE.DataTexture(d, N, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

function paperTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 220 + Math.random() * 35;
    img.data[i] = v;
    img.data[i + 1] = v * 0.98;
    img.data[i + 2] = v * 0.92;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

let RAMP = null, PAPER = null;
const TOON_FROM = (m) => m && (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial);
const toonOf = new WeakMap(); // 원래 재질 → 툰 재질

function toonFor(m) {
  let t = toonOf.get(m);
  if (!t) {
    t = new THREE.MeshToonMaterial({ gradientMap: RAMP });
    t.side = m.side;
    t.fog = m.fog;
    t.vertexColors = m.vertexColors;
    t.alphaTest = m.alphaTest;
    t.depthWrite = m.depthWrite;
    t.depthTest = m.depthTest;
    t.polygonOffset = m.polygonOffset;
    t.polygonOffsetFactor = m.polygonOffsetFactor;
    t.polygonOffsetUnits = m.polygonOffsetUnits;
    t.blending = m.blending;
    toonOf.set(m, t);
  }
  // 매 프레임 바뀌는 값 (자물쇠 번쩍임·색 바꿈·사라짐 등)
  t.map = m.map;
  t.color.copy(m.color);
  if (m.emissive) t.emissive.copy(m.emissive);
  t.emissiveMap = m.emissiveMap || null;
  t.emissiveIntensity = m.emissiveIntensity ?? 1;
  t.transparent = m.transparent;
  t.opacity = m.opacity;
  t.visible = m.visible;
  return t;
}

// 선 계산에서 뺄 것: 스프라이트·점·선, 반투명(잘라낸 종이 그림 제외), 가산 합성, 깊이를 안 쓰는 효과
function skipInk(o) {
  if (o.isSprite || o.isPoints || o.isLine || o.userData.noInk) return true;
  if (!o.isMesh) return false;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  if (!m || m.visible === false) return true;
  if (m.blending === THREE.AdditiveBlending || m.depthWrite === false) return true;
  return m.transparent && !(m.alphaTest > 0);
}

const NORMAL_MAT = new THREE.MeshNormalMaterial();
// 잘라낸 종이 그림(몬스터): 그림 모양대로만 면 방향을 쓴다
const cutoutOf = new WeakMap();
function cutoutNormal(m) {
  let c = cutoutOf.get(m);
  if (!c) {
    c = new THREE.ShaderMaterial({
      uniforms: { map: { value: m.map }, alphaTest: { value: m.alphaTest } },
      side: THREE.DoubleSide,
      vertexShader: 'varying vec3 vN; varying vec2 vUv; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D map; uniform float alphaTest; varying vec3 vN; varying vec2 vUv; void main(){ if (texture2D(map, vUv).a < alphaTest) discard; vec3 n = gl_FrontFacing ? vN : -vN; gl_FragColor = vec4(n * 0.5 + 0.5, 1.0); }',
    });
    cutoutOf.set(m, c);
  }
  c.uniforms.map.value = m.map;
  return c;
}

export class InkRenderer {
  constructor(renderer, opts = {}) {
    this.r = renderer;
    this.o = { ...DEFAULTS, ...opts };
    RAMP = RAMP || rampTexture();
    PAPER = PAPER || paperTexture();
    this.size = new THREE.Vector2(-1, -1);
    this._v = new THREE.Vector2();
    this.post = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null }, tNormal: { value: null }, tDepth: { value: null }, tPaper: { value: PAPER },
        res: { value: new THREE.Vector2() }, near: { value: 0.1 }, far: { value: 100 }, ortho: { value: 0 },
        lineW: { value: 2 }, fade: { value: new THREE.Vector2(this.o.fadeNear, this.o.fadeFar) }, overlay: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
      transparent: true,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tColor, tNormal, tDepth, tPaper; uniform vec2 res, fade; uniform float near, far, ortho, lineW, overlay; varying vec2 vUv;
        float lin(float d){ if (ortho > 0.5) return near + d * (far - near); float z = d * 2.0 - 1.0; return (2.0 * near * far) / (far + near - z * (far - near)); }
        void main(){
          vec2 px = lineW / res;
          float d0 = lin(texture2D(tDepth, vUv).r);
          vec3 n0 = texture2D(tNormal, vUv).rgb;
          float dEdge = 0.0, nEdge = 0.0, nHits = 0.0;
          for (int i = 0; i < 8; i++) {
            vec2 o = vec2(i == 0 || i == 4 || i == 5 ? 1. : i == 1 || i == 6 || i == 7 ? -1. : 0.,
                          i == 2 || i == 4 || i == 6 ? 1. : i == 3 || i == 5 || i == 7 ? -1. : 0.) * px;
            float dn = lin(texture2D(tDepth, vUv + o).r);
            dEdge = max(dEdge, abs(dn - d0) / min(dn, d0));
            float nd = distance(texture2D(tNormal, vUv + o).rgb, n0);
            nEdge = max(nEdge, nd);
            nHits += step(0.5, nd);
          }
          float silhouette = smoothstep(0.03, 0.06, dEdge);               // 윤곽 (거리 차이)
          float crease = smoothstep(0.55, 0.9, nEdge) * step(2.5, nHits);  // 접힌 곳 (이웃 3곳 이상 → 외톨이 점 없음)
          float edge = max(silhouette, crease) * (1.0 - smoothstep(fade.x, fade.y, min(d0, far * 0.999)));
          vec4 c = texture2D(tColor, vUv);
          vec3 p = texture2D(tPaper, vUv * res / 256.0).rgb;
          vec3 col = c.rgb * mix(vec3(1.0), p * p, 0.9);                   // 종이 결
          col = mix(col, vec3(0.004, 0.002, 0.006), edge);                 // 잉크 선
          gl_FragColor = vec4(col, overlay > 0.5 ? max(c.a, edge) : 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post);
    this.quad.frustumCulled = false;
    this.postScene = new THREE.Scene();
    this.postScene.add(this.quad);
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._hidden = [];
    this._swapped = [];
  }

  get enabled() {
    return gfx.preset.ink !== false;
  }

  _targets() {
    const s = this.r.getDrawingBufferSize(this._v);
    if (s.x === this.size.x && s.y === this.size.y && this.rtColor) return;
    this.size.copy(s);
    this.rtColor?.dispose();
    this.rtNormal?.dispose();
    this.rtNormal?.depthTexture?.dispose();
    this.rtColor = new THREE.WebGLRenderTarget(s.x, s.y, { samples: gfx.preset.antialias ? 4 : 0, type: THREE.HalfFloatType });
    this.rtNormal = new THREE.WebGLRenderTarget(s.x, s.y);
    this.rtNormal.depthTexture = new THREE.DepthTexture(s.x, s.y);
  }

  // overlay: 1인칭 총처럼 이미 그린 화면 위에 덧그릴 때 (배경은 투명)
  render(scene, camera, { overlay = false } = {}) {
    const r = this.r;
    if (!this.enabled) return r.render(scene, camera);
    this._targets();
    const autoClear = r.autoClear;
    const clearColor = r.getClearColor(new THREE.Color()), clearAlpha = r.getClearAlpha();
    r.autoClear = false;

    // 1) 색 (셀 셰이딩)
    scene.traverse((o) => {
      if (!o.isMesh) return;
      if (Array.isArray(o.material)) {
        if (o.material.some(TOON_FROM)) {
          this._swapped.push([o, o.material]);
          o.material = o.material.map((m) => (TOON_FROM(m) ? toonFor(m) : m));
        }
      } else if (TOON_FROM(o.material)) {
        this._swapped.push([o, o.material]);
        o.material = toonFor(o.material);
      }
    });
    r.setRenderTarget(this.rtColor);
    r.setClearColor(overlay ? 0x000000 : clearColor, overlay ? 0 : clearAlpha);
    r.clear();
    r.render(scene, camera);
    for (const [o, m] of this._swapped) o.material = m;
    this._swapped.length = 0;

    // 2) 면 방향·깊이 (선 계산용 — 효과·반투명은 숨김)
    const bg = scene.background, fog = scene.fog;
    scene.background = null;
    scene.fog = null;
    scene.traverse((o) => {
      if (!o.visible) return;
      if (skipInk(o)) {
        o.visible = false;
        this._hidden.push(o);
        return;
      }
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      this._swapped.push([o, o.material]);
      o.material = m.alphaTest > 0 && m.map ? cutoutNormal(m) : NORMAL_MAT;
    });
    r.setRenderTarget(this.rtNormal);
    r.setClearColor(0x8080ff, 1);
    r.clear();
    r.render(scene, camera);
    for (const [o, m] of this._swapped) o.material = m;
    this._swapped.length = 0;
    for (const o of this._hidden) o.visible = true;
    this._hidden.length = 0;
    scene.background = bg;
    scene.fog = fog;

    // 3) 합치기 → 화면
    const u = this.post.uniforms;
    u.tColor.value = this.rtColor.texture;
    u.tNormal.value = this.rtNormal.texture;
    u.tDepth.value = this.rtNormal.depthTexture;
    u.res.value.copy(this.size);
    u.near.value = camera.near;
    u.far.value = camera.far;
    u.ortho.value = camera.isOrthographicCamera ? 1 : 0;
    u.lineW.value = Math.min(3, Math.max(1.2, 2 * (this.size.y / 900))); // 화면 크기에 비례한 선 굵기
    u.overlay.value = overlay ? 1 : 0;
    this.post.blending = overlay ? THREE.NormalBlending : THREE.NoBlending;
    r.setRenderTarget(null);
    r.render(this.postScene, this.postCam);

    r.setClearColor(clearColor, clearAlpha);
    r.autoClear = autoClear;
  }

  dispose() {
    this.rtColor?.dispose();
    this.rtNormal?.dispose();
    this.rtNormal?.depthTexture?.dispose();
    this.post.dispose();
    this.quad.geometry.dispose();
  }
}
