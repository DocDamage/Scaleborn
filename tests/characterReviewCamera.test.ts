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
});
