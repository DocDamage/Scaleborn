import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { newFlightState } from '../src/actors/dragon/flight';
import { FORMS } from '../src/actors/dragon/forms';
import { heightAt } from '../src/world/terrain';
import {
  stageCharacterPortrait, poseCharacterPortraitCamera,
} from '../src/app/characterReviewCamera';

describe('real-character close-up visual acceptance cameras', () => {
  it('stages all three dragon forms in the same open, terrain-matched meadow',()=>{
    const state=newFlightState();
    const camera=new THREE.PerspectiveCamera(71,16/9,.2,6500);
    for(const form of ['small','rideable','giant'] as const){
      expect(stageCharacterPortrait(state,form,heightAt)).toBe('dragon');
      // Unlike the old landing QA staging point, this has no Tidegate rings
      // crowding the ordinary gameplay-distance camera.
      expect(Math.hypot(state.x+555,state.z-100)).toBeGreaterThan(150);
      expect(state.form).toBe(form);
      expect(state.mode).toBe('ground');
      expect(state.y).toBeCloseTo(heightAt(state.x,state.z)+FORMS[form].standHeight,5);
      expect(state.transition).toBeNull();
      poseCharacterPortraitCamera(camera,state,'dragon',heightAt);
      expect(camera.position.y).toBeGreaterThan(heightAt(camera.position.x,camera.position.z)+.5);
      const distance=Math.hypot(camera.position.x-state.x,camera.position.z-state.z);
      expect(distance).toBeLessThan(form==='giant'?15:form==='rideable'?6.2:1.9);
      expect(camera.fov).toBeGreaterThanOrEqual(40);
      expect(camera.fov).toBeLessThanOrEqual(51);
      expect([camera.position.x,camera.position.y,camera.position.z]
        .every(Number.isFinite)).toBe(true);
    }
  });

  it('frames the actual child-proportioned rider while leaving the dragon small',()=>{
    const state=newFlightState();
    const camera=new THREE.PerspectiveCamera(71,16/9,.2,6500);
    expect(stageCharacterPortrait(state,'rider',heightAt)).toBe('rider');
    expect(state.form).toBe('small');
    expect(state.controlTarget).toBe('rider');
    expect(state.riderMode).toBe('ground');
    expect(Math.hypot(state.riderX-state.x,state.riderZ-state.z)).toBeGreaterThan(2);
    expect(state.riderY).toBeCloseTo(heightAt(state.riderX,state.riderZ)+.05,5);
    poseCharacterPortraitCamera(camera,state,'rider',heightAt);
    expect(camera.fov).toBe(40);
    expect(camera.position.y).toBeGreaterThan(heightAt(camera.position.x,camera.position.z)+1.2);
    expect(Math.hypot(camera.position.x-state.riderX,camera.position.z-state.riderZ))
      .toBeLessThan(3.2);
  });
  it('frames the original child in mounted rideable and giant review cameras',()=>{
    const state=newFlightState();
    const camera=new THREE.PerspectiveCamera(71,16/9,.2,6500);
    for(const [pose,form] of [
      ['mounted-rideable','rideable'],['mounted-giant','giant'],
    ] as const){
      expect(stageCharacterPortrait(state,pose,heightAt)).toBe('mounted');
      expect(state.form).toBe(form);
      expect(state.controlTarget).toBe('dragon');
      poseCharacterPortraitCamera(camera,state,'mounted',heightAt);
      expect(camera.fov).toBe(45);
      expect(camera.position.y).toBeGreaterThan(state.y);
      expect(Math.hypot(camera.position.x-state.x,camera.position.z-state.z))
        .toBeLessThan(form==='giant'?9:4.5);
      expect([camera.position.x,camera.position.y,camera.position.z]
        .every(Number.isFinite)).toBe(true);
    }
  });
  it('captures genuine side views exposing original rider knee and saddle contact',()=>{
    const state=newFlightState();
    const camera=new THREE.PerspectiveCamera(71,16/9,.2,6500);
    for(const pose of ['rider-side','mounted-rideable-side','mounted-giant-side'] as const){
      const subject=stageCharacterPortrait(state,pose,heightAt);
      expect(subject).toBe(pose==='rider-side'?'rider-side':'mounted-side');
      poseCharacterPortraitCamera(camera,state,subject,heightAt);
      const fromX=subject==='rider-side'?state.riderX:state.x;
      const fromZ=subject==='rider-side'?state.riderZ:state.z;
      expect(camera.position.x).toBeGreaterThan(fromX+1);
      expect(camera.position.z).toBeLessThan(fromZ);
      expect(camera.position.y).toBeGreaterThan(heightAt(camera.position.x,camera.position.z));
      expect(camera.fov).toBe(subject==='rider-side'?40:45);
    }
  });
  it('frames real heroine skin and skinned-tail detail at distinct close camera ranges',()=>{
    const state=newFlightState();
    const camera=new THREE.PerspectiveCamera(71,16/9,.2,6500);
    expect(stageCharacterPortrait(state,'rider-face',heightAt)).toBe('rider-face');
    expect(state.form).toBe('small');
    expect(state.controlTarget).toBe('rider');
    poseCharacterPortraitCamera(camera,state,'rider-face',heightAt);
    const faceDistance=camera.position.distanceTo(
      new THREE.Vector3(state.riderX,state.riderY+1.35,state.riderZ-.02));
    expect(faceDistance).toBeLessThan(2.2);
    expect(camera.fov).toBe(36);
    expect(camera.position.y).toBeGreaterThan(state.riderY+1.15);
    expect(stageCharacterPortrait(state,'rider-tail',heightAt)).toBe('rider-tail');
    poseCharacterPortraitCamera(camera,state,'rider-tail',heightAt);
    expect(camera.fov).toBe(40);
    expect(camera.position.x).toBeGreaterThan(state.riderX+1.6);
    expect(camera.position.y).toBeGreaterThan(heightAt(camera.position.x,camera.position.z)+.8);
    const tailDistance=camera.position.distanceTo(
      new THREE.Vector3(state.riderX,state.riderY+.69,state.riderZ+.36));
    expect(tailDistance).toBeLessThan(2.6);
  });
  it('stages real walking Onyx and banked mounted rider art checks',()=>{
    const state=newFlightState();
    const camera=new THREE.PerspectiveCamera(71,16/9,.2,6500);
    expect(stageCharacterPortrait(state,'walk-rideable',heightAt)).toBe('dragon');
    expect(state.form).toBe('rideable');
    expect(state.mode).toBe('ground');
    expect(state.speed).toBeGreaterThan(.3);
    expect(state.transition).toBeNull();
    poseCharacterPortraitCamera(camera,state,'dragon',heightAt);
    expect(camera.position.distanceTo(
      new THREE.Vector3(state.x,state.y,state.z))).toBeLessThan(9);
    expect(stageCharacterPortrait(state,'bank-rideable',heightAt)).toBe('mounted-side');
    expect(state.form).toBe('rideable');
    expect(state.mode).toBe('air');
    expect(state.speed).toBe(FORMS.rideable.cruise);
    expect(state.y).toBeCloseTo(heightAt(state.x,state.z)+12,5);
    expect(state.roll).toBeCloseTo(.35,6);
    poseCharacterPortraitCamera(camera,state,'mounted-side',heightAt);
    expect(camera.fov).toBe(45);
    expect(camera.position.y).toBeGreaterThan(state.y);
    expect(camera.position.x).toBeGreaterThan(state.x);
  });
  it('stages a genuine open-wing rideable air pose in the normal game scene',()=>{
    const state=newFlightState();
    const camera=new THREE.PerspectiveCamera(71,16/9,.2,6500);
    expect(stageCharacterPortrait(state,'flight-rideable',heightAt))
      .toBe('dragon');
    expect(state.form).toBe('rideable');
    expect(state.mode).toBe('air');
    expect(state.transition).toBeNull();
    expect(state.y).toBeCloseTo(heightAt(state.x,state.z)+12,5);
    expect(state.speed).toBe(FORMS.rideable.cruise);
    poseCharacterPortraitCamera(camera,state,'dragon',heightAt);
    expect(camera.position.y).toBeGreaterThan(state.y);
    expect(camera.position.distanceTo(
      new THREE.Vector3(state.x,state.y,state.z))).toBeLessThan(12);
  });
});
