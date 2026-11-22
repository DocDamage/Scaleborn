import * as THREE from 'three';
import type { FlightState } from '../actors/dragon/flight';
import { FORMS, type DragonForm } from '../actors/dragon/forms';

export type PortraitSubject = 'dragon' | 'rider';
export type PortraitPose = DragonForm | 'rider';

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
  const form = pose === 'rider' ? 'small' : pose;
  state.x = x;
  state.z = z;
  state.form = form;
  state.y = height(x, z) + FORMS[form].standHeight;
  state.mode = 'ground';
  state.transition = null;
  state.controlTarget = pose === 'rider' ? 'rider' : 'dragon';
  state.speed = 0;
  state.pitch = 0;
  state.roll = 0;
  state.yaw = 0;
  state.riderX = x + 2.8;
  state.riderZ = z;
  state.riderY = height(state.riderX, state.riderZ) + .05;
  state.riderTargetY = state.riderY;
  state.riderYaw = 0;
  state.riderSpeed = 0;
  state.riderMode = 'ground';
  return state.controlTarget;
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
  const rider = subject === 'rider';
  const yaw = rider ? state.riderYaw : state.yaw;
  const scale = rider ? 1 : FORMS[state.form].visualScale;
  const distance = rider ? 2.75 :
    state.form === 'small' ? 1.65 : state.form === 'giant' ? 13.5 : 5.6;
  const rise = rider ? .6 :
    state.form === 'small' ? .62 : state.form === 'giant' ? 4.7 : 2.25;
  const originX = rider ? state.riderX : state.x;
  const originY = rider ? state.riderY : state.y;
  const originZ = rider ? state.riderZ : state.z;
  const focusY = originY + (rider ? 1.08 : .46 * scale);
  const forwardX = Math.sin(yaw), forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw), rightZ = Math.sin(yaw);
  const x = originX + forwardX * distance + rightX * distance * .32;
  const z = originZ + forwardZ * distance + rightZ * distance * .32;
  const y = Math.max(focusY + rise, height(x,z) + (rider ? 1.25 : .55));
  camera.position.set(x,y,z);
  camera.up.set(0,1,0);
  camera.lookAt(originX,focusY,originZ - (rider ? .02 : scale * .24));
  const fov = rider ? 40 : state.form === 'small' ? 42 :
    state.form === 'giant' ? 51 : 46;
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}
