import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { mountedRiderSeat } from '../src/actors/rider/mountSeat';
import { DragonVisual } from '../src/actors/dragon/visual';
import { FORMS } from '../src/actors/dragon/forms';
import { newFlightState } from '../src/actors/dragon/flight';
import { riderPose } from '../src/actors/rider/pose';

describe('rider contact with Onyx in all three forms',()=>{
  it('keeps the child pelvis at the dragon back, not floating above the saddle',()=>{
    for(const form of ['rideable','giant'] as const){
      const scale=FORMS[form].visualScale;
      const seat=mountedRiderSeat(scale);
      expect(seat.y+.66).toBeCloseTo(.63*scale-.055,6);
      expect(seat.z).toBeLessThan(0);
      expect(Math.abs(seat.y)).toBeLessThan(.75);
    }
    for(const scale of [Number.NaN,0,-1,Infinity]){
      expect(()=>mountedRiderSeat(scale)).toThrow();
    }
  });

  it('keeps the real heroine unscaled and mounted to the same Onyx root',()=>{
    const scene=new THREE.Scene(), dragon=new DragonVisual();
    dragon.attach(scene);
    try{
      const state=newFlightState();
      for(const form of ['rideable','giant'] as const){
        state.form=form;
        // The display scale is blended as in real gameplay.
        for(let i=0;i<45;i++){
          state.time+=.1;
          dragon.update(state);
        }
        const scale=dragon.body.scale.x;
        const seat=mountedRiderSeat(scale);
        expect(dragon.rider.parent).toBe(dragon.root);
        expect(dragon.rider.position.y).toBeCloseTo(seat.y,6);
        expect(dragon.rider.position.z).toBeCloseTo(seat.z,6);
        expect(dragon.rider.scale.x).toBe(1);
        expect(dragon.rider.getObjectByName('rider.leftLeg')).toBeDefined();
      }
      state.form='small';state.time+=.1;
      dragon.update(state);
      expect(dragon.rider.scale.x).toBe(1);
    }finally{dragon.dispose();}
  });

  it('rests legs forward in a seated position rather than in a standing gait',()=>{
    const state=newFlightState();
    const pose=riderPose(state);
    expect(pose.motion).toBe('mounted');
    expect(pose.leftLeg).toBeGreaterThan(0);
    expect(pose.leftLeg).toBe(pose.rightLeg);
    state.form='small';
    expect(riderPose(state).motion).toBe('idle');
  });
});
