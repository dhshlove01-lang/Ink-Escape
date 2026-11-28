import * as THREE from 'three';
import { gfx } from './GraphicsSettings.js';
import { InkRenderer } from './InkRenderer.js';
import { PostRenderer } from './PostRenderer.js';

// 그림체 두 갈래를 한 문으로 묶는다.
//   ink   = 잉크 선 + 3단 셀 명암 (InkRenderer, 예전 그림체 — 그래픽 설정 '잉크 선' 켬)
//   post  = 선 없는 기본 렌더 + 블룸·톤매핑·색보정 (PostRenderer, 지금 기본)
//   plain = 후처리도 없이 그냥 그리기 (그래픽 '끄기')
// 부르는 쪽(1인칭·술래 탑뷰·로비 무대)은 begin → (overlay) → present 순서만 지키면 된다.

export class FrameRenderer {
  constructor(renderer, opts = {}) {
    this.r = renderer;
    this.ink = new InkRenderer(renderer, opts.ink || {});
    this.post = new PostRenderer(renderer, opts.post || {});
    this._compile = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 부드러운 실시간 그림자 (마왕 궁전 키 라이트)
    this._off = gfx.onChange(() => this.sync());
    this.sync(true);
  }

  get mode() {
    return gfx.ink ? 'ink' : gfx.post ? 'post' : 'plain';
  }

  sync() {
    const want = this.mode === 'post' && gfx.preset.shadows !== false;
    if (this.r.shadowMap.enabled !== want) {
      this.r.shadowMap.enabled = want;
      this.r.shadowMap.needsUpdate = true;
      this._compile = true; // 그림자 유무가 바뀌면 재질을 다시 컴파일해야 한다
    }
  }

  begin(scene, camera) {
    if (this._compile) {
      this._compile = false;
      scene.traverse((o) => {
        if (!o.isMesh) return;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) if (m) m.needsUpdate = true;
      });
    }
    const m = this.mode;
    if (m === 'ink') this.ink.render(scene, camera);
    else if (m === 'post') this.post.begin(scene, camera);
    else {
      this.r.render(scene, camera);
      gfx.count(this.r.info);
    }
  }

  // 이미 (후처리까지) 끝난 화면 위에 덧그리기 (1인칭 손·총)
  //  후처리 뒤에 그대로 얹는다 → 손·총은 톤매핑·블룸에 휘둘리지 않고 예전과 같은 밝기·색
  overlay(scene, camera) {
    const m = this.mode;
    if (m === 'ink') {
      this.ink.render(scene, camera, { overlay: true });
      return;
    }
    const autoClear = this.r.autoClear;
    this.r.autoClear = false;
    this.r.render(scene, camera);
    this.r.autoClear = autoClear;
    gfx.count(this.r.info);
  }

  present() {
    if (this.mode === 'post') this.post.present();
  }

  dispose() {
    this._off?.();
    this.ink.dispose();
    this.post.dispose();
  }
}
