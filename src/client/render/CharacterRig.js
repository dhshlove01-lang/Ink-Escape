import * as THREE from 'three';

// 리깅된 캐릭터(GL B) 하나에 붙는 애니메이션·자세 담당.
//   · run/walk 클립을 속도에 맞춰 재생하고, 멈추면 원래(대기) 자세로 돌아간다
//   · 총을 들고 있으면 오른팔을 "총 든 자세"로 가볍게 덮어써서(블렌딩) 달려도 총을 놓치지 않게 한다
//   · 총은 손뼈 위치를 따라가게 두어 어떤 동물이든 손 앞에 자연스럽게 놓인다
//
// 뼈 이름은 GLTFLoader 가 ':' 를 지워서 넣는다 (mixamorig:RightHand → mixamorigRightHand).
// 그래서 이름은 소문자·영숫자만 남겨 끝부분으로 찾는다.

const UP = new THREE.Vector3(0, 1, 0);
const v0 = new THREE.Vector3();
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();

// 총을 든 오른손이 향하는 자리 (어깨 기준, m). 캐릭터는 -Z 를 본다.
const CARRY = {
  forward: 0.20, // 몸 앞으로 내미는 거리
  right: 0.02, // 오른쪽으로 살짝
  down: 0.05, // 어깨보다 조금 아래
  weight: 1, // 1 = 애니메이션 위에 완전히 덮어씀
  blendSec: 0.18,
};

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function findBone(root, tail) {
  let found = null;
  root.traverse((o) => {
    if (found || !o.isBone) return;
    if (norm(o.name).endsWith(tail)) found = o;
  });
  return found;
}

function pickClip(clips, want) {
  // 'run.001' → run, 'walk.001' → walk
  return clips.find((c) => norm(c.name).startsWith(want)) || null;
}

/**
 * @param {THREE.Object3D} model  ModelLibrary 가 보정해 준 모델(SkinnedMesh 포함, -Z 를 봄)
 * @param {object} opts { gun: THREE.Object3D|null, speed: {walk,run} }
 * @returns {{update:Function, play:Function, hasAnim:boolean}} 매 프레임 update(dt, speed)
 */
export function createCharacterRig(model, { gun = null } = {}) {
  const clips = model.userData.animations || [];
  const runClip = pickClip(clips, 'run');
  const walkClip = pickClip(clips, 'walk');

  let mixer = null;
  let runAct = null;
  let walkAct = null;
  if (runClip || walkClip) {
    mixer = new THREE.AnimationMixer(model);
    if (runClip) {
      runAct = mixer.clipAction(runClip);
      runAct.setEffectiveWeight(0);
    }
    if (walkClip) {
      walkAct = mixer.clipAction(walkClip);
      walkAct.setEffectiveWeight(0);
    }
  }

  const upper = findBone(model, 'rightarm');
  const fore = findBone(model, 'rightforearm');
  const hand = findBone(model, 'righthand');
  const spine = findBone(model, 'spine2');
  const rigged = !!(upper && fore && hand);
  const carryAllowed = !!(gun && rigged);
  let carry = 0; // 총 든 자세 블렌딩 (0 = 애니메이션 그대로)

  const holder = gun ? gun.parent : null;

  function aimBone(bone, child, dir, w) {
    if (!bone || !child) return;
    bone.updateWorldMatrix(true, false);
    child.updateWorldMatrix(true, false);
    bone.getWorldPosition(v1);
    child.getWorldPosition(v2);
    v2.sub(v1);
    if (v2.lengthSq() < 1e-10) return;
    v2.normalize();
    q0.setFromUnitVectors(v2, dir); // 지금 방향 → 원하는 방향
    bone.getWorldQuaternion(q1);
    q1.premultiply(q0); // 새 월드 회전
    bone.parent.getWorldQuaternion(q2);
    q2.invert().multiply(q1); // 부모 기준(로컬)
    bone.quaternion.slerp(q2, w);
    bone.updateMatrixWorld(true);
  }

  // 오른팔 2뼈 IK: 손목을 어깨 앞 고정 자리로 보낸다 (팔꿈치는 아래·뒤).
  function applyCarry(w) {
    if (!carryAllowed || w <= 0.001) return;
    model.updateMatrixWorld(true);
    upper.updateWorldMatrix(true, false);
    fore.updateWorldMatrix(true, false);
    hand.updateWorldMatrix(true, false);

    upper.getWorldPosition(v0); // 어깨
    fore.getWorldPosition(v1);
    const l1 = v1.distanceTo(v0);
    hand.getWorldPosition(v2);
    const l2 = v2.distanceTo(v1);
    if (l1 < 1e-4 || l2 < 1e-4) return;

    // 캐릭터가 보는 방향·오른쪽 (모델은 -Z 를 본다)
    model.getWorldQuaternion(q0);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q0);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q0);
    const target = v3
      .copy(v0)
      .addScaledVector(fwd, CARRY.forward)
      .addScaledVector(right, CARRY.right)
      .addScaledVector(UP, -CARRY.down);

    // 닿는 거리로 자르기
    const toT = target.clone().sub(v0);
    let dist = toT.length();
    const maxD = (l1 + l2) * 0.995;
    if (dist > maxD) {
      toT.multiplyScalar(maxD / dist);
      target.copy(v0).add(toT);
      dist = maxD;
    }
    if (dist < Math.abs(l1 - l2) + 1e-3) return;
    const dir = toT.clone().normalize();

    // 팔꿈치: 아래(+ 살짝 뒤)로 꺾이게
    const pole = new THREE.Vector3(0, -1, 0).addScaledVector(fwd, -0.25).normalize();
    const axis = new THREE.Vector3().crossVectors(dir, pole).normalize();
    if (axis.lengthSq() < 1e-6) axis.copy(right);
    const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
    const a = Math.acos(Math.min(1, Math.max(-1, cosA)));
    const elbowDir = dir.clone().applyAxisAngle(axis, -a);
    const elbow = v0.clone().addScaledVector(elbowDir, l1);

    aimBone(upper, fore, elbow.clone().sub(v0).normalize(), w);
    aimBone(fore, hand, target.clone().sub(elbow).normalize(), w);
    // 손은 총을 쥔 모양으로 살짝 앞을 보게
    if (hand.children.length) aimBone(hand, hand.children[0], fwd, w * 0.6);
    // 어깨를 살짝 앞으로 (상체 각도 오프셋)
    if (spine) {
      spine.quaternion.slerp(new THREE.Quaternion().setFromAxisAngle(UP, 0.05), w * 0.25);
    }
  }

  // 총: 오른손 위치를 따라가되 방향은 캐릭터 앞(-Z)으로 고정 → 달려도 찌그러지지 않는다
  const gunOffset = new THREE.Vector3(0.02, 0.03, -0.06);
  function placeGun() {
    if (!gun || !holder || !hand) return;
    hand.updateWorldMatrix(true, false);
    hand.getWorldPosition(v0);
    holder.worldToLocal(v0);
    gun.position.copy(v0).add(gunOffset);
  }

  return {
    model,
    hasAnim: !!mixer,
    rigged,
    get carrying() {
      return carry;
    },
    // speed: 지금 실제 이동 속도(m/s). 0 이면 대기
    update(dt, speed = 0) {
      const walking = speed > 0.25;
      // 달리기/걷기 클립 전환 (무게 페이드)
      if (mixer) {
        const running = walking && speed > 5.2;
        const wantRun = running && runAct;
        const wantWalk = walking && !running && walkAct;
        if (runAct) {
          runAct.setEffectiveWeight(lerp(runAct.getEffectiveWeight(), wantRun ? 1 : 0, Math.min(1, dt * 10)));
          if (wantRun || runAct.getEffectiveWeight() > 0.01) {
            if (!runAct.isRunning()) runAct.play();
            runAct.setEffectiveTimeScale(clamp(speed / 6.5, 0.75, 1.5));
          }
        }
        if (walkAct) {
          walkAct.setEffectiveWeight(lerp(walkAct.getEffectiveWeight(), wantWalk ? 1 : 0, Math.min(1, dt * 10)));
          if (wantWalk || walkAct.getEffectiveWeight() > 0.01) {
            if (!walkAct.isRunning()) walkAct.play();
            walkAct.setEffectiveTimeScale(clamp(speed / 4, 0.7, 1.5));
          }
        }
        if (!walking) {
          // 멈추면 클립을 천천히 줄여 원래(대기) 자세로
          runAct?.setEffectiveTimeScale(runAct.getEffectiveTimeScale() * 0.9);
          walkAct?.setEffectiveTimeScale(walkAct.getEffectiveTimeScale() * 0.9);
        }
        mixer.update(dt);
      }
      // 총 든 자세: 총이 있으면 항상(대기·이동 모두) 손을 총 쪽으로
      carry = lerp(carry, carryAllowed ? CARRY.weight : 0, Math.min(1, dt / CARRY.blendSec));
      if (carry > 0.002) applyCarry(carry);
      placeGun();
    },
  };
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
