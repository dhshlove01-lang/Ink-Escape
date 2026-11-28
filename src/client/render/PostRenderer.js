import * as THREE from 'three';
import { gfx } from './GraphicsSettings.js';

// 선 없는 기본 렌더의 후처리 (2026-11-28, "선 없이 자연스러운 다크한 마왕의 방")
//   1) 장면 → 반투명 float 텍스처(HDR)에 그린다 (톤매핑은 마지막 한 번만)
//   2) 밝은 곳만 뽑아 절반 해상도에서 두 번 흐린다 → 블룸 (불꽃·창·빛무리 번짐)
//   3) 합치기: 블룸 더하기 → ACES 필름 톤매핑 → 색 보정(그림자 차갑게·밝은 곳 따뜻하게) → 비네팅
// 잉크 스타일(InkRenderer)과는 별개 — 그래픽 설정의 '잉크 선' 토글이 정한다.

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const BRIGHT = `
  uniform sampler2D tSrc; uniform float threshold, knee;
  varying vec2 vUv;
  void main(){
    vec3 c = texture2D(tSrc, vUv).rgb;
    float l = max(c.r, max(c.g, c.b));
    float w = smoothstep(threshold, threshold + knee, l) * (1.0 - smoothstep(threshold + knee * 3.0, threshold + knee * 6.0, l) * 0.35);
    gl_FragColor = vec4(c * w, 1.0);
  }`;

const BLUR = `
  uniform sampler2D tSrc; uniform vec2 dir;
  varying vec2 vUv;
  void main(){
    vec3 s = texture2D(tSrc, vUv).rgb * 0.2270270270;
    s += (texture2D(tSrc, vUv + dir * 1.3846153846).rgb + texture2D(tSrc, vUv - dir * 1.3846153846).rgb) * 0.3162162162;
    s += (texture2D(tSrc, vUv + dir * 3.2307692308).rgb + texture2D(tSrc, vUv - dir * 3.2307692308).rgb) * 0.0702702703;
    gl_FragColor = vec4(s, 1.0);
  }`;

const COMPOSITE = `
  uniform sampler2D tSrc, tBloom;
  uniform float exposure, bloom, vignette, grade;
  varying vec2 vUv;
  // ACES 필름 톤매핑 (하이라이트가 하얗게 눌리지 않고 부드럽게 말린다)
  vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
  void main(){
    vec3 c = texture2D(tSrc, vUv).rgb;
    c += texture2D(tBloom, vUv).rgb * bloom;
    c *= exposure;
    // 어두운 곳은 남색·보라로, 밝은 곳은 주황으로 기울인다 (차가운 밤 + 따뜻한 빛)
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(c, c * vec3(0.84, 0.91, 1.14), smoothstep(0.34, 0.0, l) * 0.62 * grade);
    c = mix(c, c * vec3(1.09, 1.01, 0.91), smoothstep(0.42, 1.0, l) * 0.5 * grade);
    c = aces(c);
    // 가장자리 어둡게 (시선이 가운데로)
    float v = smoothstep(0.86, 0.30, length((vUv - 0.5) * vec2(1.04, 1.0)));
    c *= mix(1.0, v, vignette);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;

const DEFAULTS = {
  exposure: 1.55,
  bloom: 1.05, // 블룸 세기 (0 = 끔)
  threshold: 0.85, // 이 밝기(선형) 이상이 번진다 — 불꽃·창·빛무리만
  knee: 0.35,
  vignette: 0.26,
  grade: 0.6,
};

export class PostRenderer {
  constructor(renderer, opts = {}) {
    this.r = renderer;
    this.o = { ...DEFAULTS, ...opts };
    this.size = new THREE.Vector2(-1, -1);
    this._v = new THREE.Vector2();
    this._clear = { color: new THREE.Color(), alpha: 1 };

    this.matBright = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, threshold: { value: this.o.threshold }, knee: { value: this.o.knee } },
      vertexShader: VERT, fragmentShader: BRIGHT, depthTest: false, depthWrite: false,
    });
    this.matBlur = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, dir: { value: new THREE.Vector2() } },
      vertexShader: VERT, fragmentShader: BLUR, depthTest: false, depthWrite: false,
    });
    this.matComposite = new THREE.ShaderMaterial({
      uniforms: {
        tSrc: { value: null }, tBloom: { value: null },
        exposure: { value: this.o.exposure }, bloom: { value: this.o.bloom },
        vignette: { value: this.o.vignette }, grade: { value: this.o.grade },
      },
      vertexShader: VERT, fragmentShader: COMPOSITE, depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.matComposite);
    this.quad.frustumCulled = false;
    this.postScene = new THREE.Scene();
    this.postScene.add(this.quad);
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  // 장면 텍스처(반투명 float) + 절반 해상도 블룸 텍스처를 화면 크기에 맞춘다
  _targets() {
    const s = this.r.getDrawingBufferSize(this._v);
    if (s.x === this.size.x && s.y === this.size.y && this.rtScene) return;
    this.size.copy(s);
    this.rtScene?.dispose();
    this.rtA?.dispose();
    this.rtB?.dispose();
    const hdr = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.rtScene = new THREE.WebGLRenderTarget(s.x, s.y, { ...hdr, samples: gfx.preset.antialias ? 4 : 0 });
    const hw = Math.max(2, Math.floor(s.x / 2)), hh = Math.max(2, Math.floor(s.y / 2));
    this.rtA = new THREE.WebGLRenderTarget(hw, hh, { ...hdr, depthBuffer: false });
    this.rtB = new THREE.WebGLRenderTarget(hw, hh, { ...hdr, depthBuffer: false });
  }

  // 장면 그리기 시작 (색+깊이). 뒤에 overlay 로 총(1인칭 손)을 얹을 수 있다
  begin(scene, camera) {
    this._targets();
    const r = this.r;
    r.getClearColor(this._clear.color);
    this._clear.alpha = r.getClearAlpha();
    const autoClear = r.autoClear;
    r.autoClear = true;
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(scene, camera);
    r.autoClear = autoClear;
    gfx.count(r.info);
  }

  // 이미 그린 화면 위에 덧그리기 (깊이는 부른 쪽에서 지운다)
  overlay(scene, camera) {
    const r = this.r;
    const autoClear = r.autoClear;
    r.autoClear = false;
    r.setRenderTarget(this.rtScene);
    r.render(scene, camera);
    r.autoClear = autoClear;
    gfx.count(r.info);
  }

  // 블룸 + 톤매핑 + 색 보정 → 화면
  present() {
    const r = this.r;
    const autoClear = r.autoClear;
    r.autoClear = true;
    // 1) 밝은 곳 뽑기 (절반 해상도)
    this.quad.material = this.matBright;
    this.matBright.uniforms.tSrc.value = this.rtScene.texture;
    r.setRenderTarget(this.rtA);
    r.render(this.postScene, this.postCam);
    // 2) 가로 → 세로 흐림 두 번 (넓게 번지게)
    const dx = 1 / this.rtA.width, dy = 1 / this.rtA.height;
    for (let i = 0; i < 2; i++) {
      this.quad.material = this.matBlur;
      this.matBlur.uniforms.tSrc.value = this.rtA.texture;
      this.matBlur.uniforms.dir.value.set(dx, 0);
      r.setRenderTarget(this.rtB);
      r.render(this.postScene, this.postCam);
      this.matBlur.uniforms.tSrc.value = this.rtB.texture;
      this.matBlur.uniforms.dir.value.set(0, dy);
      r.setRenderTarget(this.rtA);
      r.render(this.postScene, this.postCam);
    }
    // 3) 합치기 → 화면
    this.quad.material = this.matComposite;
    this.matComposite.uniforms.tSrc.value = this.rtScene.texture;
    this.matComposite.uniforms.tBloom.value = this.rtA.texture;
    r.setRenderTarget(null);
    r.render(this.postScene, this.postCam);
    r.autoClear = autoClear;
  }

  dispose() {
    this.rtScene?.dispose();
    this.rtA?.dispose();
    this.rtB?.dispose();
    [this.matBright, this.matBlur, this.matComposite].forEach((m) => m.dispose());
    this.quad.geometry.dispose();
  }
}
