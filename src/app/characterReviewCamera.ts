import * as THREE from 'three';
import type { FlightState } from '../actors/dragon/flight';
import { FORMS, type DragonForm } from '../actors/dragon/forms';

export type PortraitSubject = 'dragon' | 'rider' | 'mounted' | 'rider-side' | 'mounted-side' | 'rider-face' | 'rider-tail';
export type PortraitPose = DragonForm | 'rider' | 'rider-side' | 'rider-face' | 'rider-tail' | 'flight-rideable'
  | 'mounted-rideable' | 'mounted-giant'
  | 'mounted-rideable-side' | 'mounted-giant-side'
  | 'walk-rideable' | 'bank-rideable';

/**
 * Repeatable *development-only* character art review position. The open
 * meadow is away from Tidegate's large runestones and the Gloam hound den,
 * so both original characters can be assessed without landmark occlusion.
 */
export function stageCharacterPortrait(
  state: FlightState, pose: PortraitPose,
  height: (x: number, z: number) => number,
): PortraitSubject {
  const x = -521, z = -104;
  // The banked saddle pose is a real flying turn, not a forced 20-degree
  // sideways roll while Onyx is planted on level terrain.
  const airborne=pose==='flight-rideable'||pose==='bank-rideable';
  const walking=pose==='walk-rideable';
  const banking=pose==='bank-rideable';
  const form = airborne ? 'rideable'
    : pose === 'rider' || pose === 'rider-side' || pose === 'rider-face' || pose === 'rider-tail' ? 'small'
    : pose === 'mounted-rideable' || pose === 'mounted-rideable-side'
      || walking || banking
      ? 'rideable' : pose === 'mounted-giant' || pose === 'mounted-giant-side'
        ? 'giant' : pose;
  state.x = x;
  state.z = z;
  state.form = form;
  state.y = height(x, z) + (airborne?12:FORMS[form].standHeight);
  state.mode = airborne?'air':'ground';
  state.transition = null;
  state.controlTarget = ['rider','rider-side','rider-face','rider-tail'].includes(pose)
    ? 'rider' : 'dragon';
  state.speed = airborne?FORMS[form].cruise:walking?3.8:0;
  state.pitch = airborne?.035:0;
  state.roll = banking?.35:0;
  state.yaw = 0;
  state.riderX = x + 2.8;
  state.riderZ = z;
  state.riderY = height(state.riderX, state.riderZ) + .05;
  state.riderTargetY = state.riderY;
  state.riderYaw = 0;
  state.riderSpeed = 0;
  state.riderMode = 'ground';
  if (pose === 'rider-side') return 'rider-side';
  if (pose === 'rider-face') return 'rider-face';
  if (pose === 'rider-tail') return 'rider-tail';
  if (pose === 'mounted-rideable-side' || pose === 'mounted-giant-side' || banking)
    return 'mounted-side';
  return pose === 'mounted-rideable' || pose === 'mounted-giant'
    ? 'mounted' : state.controlTarget;
}

/**
 * Proper near-field photographic framing of real gameplay characters,
 * not a different model or an artificial render. Called only from the
 * DEV/qa hook after the normal gameplay camera has been updated.
 */
export function poseCharacterPortraitCamera(
  camera: THREE.PerspectiveCamera,
  state: FlightState, subject: PortraitSubject,
  height: (x: number, z: number) => number,
): void {
  const faceDetail=subject==='rider-face',tailDetail=subject==='rider-tail';
  const rider = subject === 'rider' || subject === 'rider-side' || faceDetail || tailDetail;
  const mounted = subject === 'mounted' || subject === 'mounted-side';
  const sideView = subject === 'rider-side' || subject === 'mounted-side' || tailDetail;
  const yaw = rider ? state.riderYaw : state.yaw;
  const scale = rider ? 1 : FORMS[state.form].visualScale;
  const distance = mounted ? (state.form === 'giant' ? 8.2 : 3.8)
    : faceDetail ? 1.25 : tailDetail ? 1.8 : rider ? 2.75 :
      state.form === 'small' ? 1.65 : state.form === 'giant' ? 13.5 : 5.6;
  const rise = mounted ? (state.form === 'giant' ? 2.4 : 1.35)
    : faceDetail ? .16 : tailDetail ? .20 : rider ? .6 :
      state.form === 'small' ? .62 : state.form === 'giant' ? 4.7 : 2.25;
  const originX = rider ? state.riderX : state.x;
  const originY = rider ? state.riderY : state.y;
  const originZ = rider ? state.riderZ : state.z;
  const focusY = originY + (mounted ? .63 * scale + .36
    : faceDetail ? 1.35 : tailDetail ? .69 : rider ? 1.08 : .46 * scale);
  const forwardX = Math.sin(yaw), forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw), rightZ = Math.sin(yaw);
  // Side orthographic-like three-quarter view reveals pelvis, knees and wing
  // clearance that frontal portraits hide. Still the actual gameplay scene.
  const x = originX + forwardX * distance * (sideView ? .28 : 1)
    + rightX * distance * (sideView ? 1.12 : .32);
  const z = originZ + forwardZ * distance * (sideView ? .28 : 1)
    + rightZ * distance * (sideView ? 1.12 : .32);
  const y = Math.max(focusY + rise, height(x,z) + (tailDetail ? .88 : rider ? 1.25 : .55));
  camera.position.set(x,y,z);
  camera.up.set(0,1,0);
  camera.lookAt(originX,focusY,originZ + (tailDetail ? .36 : rider ? -.02 : -scale*.24));
  const fov = faceDetail ? 36 : rider ? 40 : mounted ? 45 : state.form === 'small' ? 42 :
    state.form === 'giant' ? 51 : 46;
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}
