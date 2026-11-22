import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { newFlightState } from '../src/actors/dragon/flight';
import { DragonVisual } from '../src/actors/dragon/visual';
import { riderPose } from '../src/actors/rider/pose';
import { riderFacialPose } from '../src/actors/rider/riderExpression';

describe('young Scaleborn heroine's original subtle facial expressions',()=>{
  it('generates finite, deterministic small expression shifts with a complete blink',()=>{
    const state=newFlightState();
    state.form='small';
    state.time=1;
    const resting=riderFacialPose(state,riderPose(state));
    state.time=2.4;
    const blink=riderFacialPose(state,riderPose(state));
    expect(resting.eyeOpen).toBe(1);
    expect(blink.eyeOpen).toBeLessThan(.09);
    expect(blink).toEqual(riderFacialPose(state,riderPose(state)));
    state.form='rideable';state.mode='air';state.roll=.6;
    const focused=riderFacialPose(state,riderPose(state));
    expect(focused.browLift).toBeLessThan(resting.browLift);
    expect(focused.mouthShift).toBeLessThan(0);
    state.time=Number.NaN;
    expect(Object.values(riderFacialPose(state,riderPose(state)))
      .every(Number.isFinite)).toBe(true);
  });
  it('links both almond eyes, eyelids, brows and sculpted mouth into real gameplay',()=>{
    const dragon=new DragonVisual(),state=newFlightState();
    try{
      const mouth=dragon.rider.getObjectByName('rider.mouth') as THREE.Mesh;
      expect(mouth).toBeInstanceOf(THREE.Mesh);
      expect(mouth.geometry).not.toBeInstanceOf(THREE.SphereGeometry);
      expect(mouth.geometry.getAttribute('position').count).toBeGreaterThan(100);
      state.form='small';state.mode='ground';state.riderMode='ground';
      state.time=1;dragon.update(state);
      const eyes=['left','right'].map(side=>
        dragon.rider.getObjectByName('rider.eye.'+side) as THREE.Mesh);
      const open=eyes[0]!.scale.y;
      state.time=2.4;dragon.update(state);
      expect(eyes[0]!.scale.y).toBeLessThan(open*.2);
      expect(eyes[1]!.scale.y).toBeCloseTo(eyes[0]!.scale.y,8);
      expect(dragon.rider.getObjectByName('rider.eyelid.upper.left')!.position.y)
        .toBeLessThan(-.01);
      state.form='rideable';state.roll=.45;state.time=5;
      dragon.update(state);
      expect(Math.abs(mouth.position.y)).toBeLessThan(.01);
      expect(dragon.rider.scale.x).toBe(1);
      expect(dragon.rider.getObjectByName('rider.elf-ear')).toBeUndefined();
    }finally{dragon.dispose();}
  });
});
