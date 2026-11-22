import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { newFlightState } from '../src/actors/dragon/flight';
import { DragonVisual } from '../src/actors/dragon/visual';
import { riderPose } from '../src/actors/rider/pose';
import { riderFacialPose } from '../src/actors/rider/riderExpression';

describe("young Scaleborn heroine's original subtle facial expressions",()=>{
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
    expect(Math.abs(blink.headPitch)).toBeLessThan(.0751);
    expect(Math.abs(blink.headYaw)).toBeLessThan(.039);
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
      const head=dragon.rider.getObjectByName('rider.head') as THREE.Group;
      const face=dragon.rider.getObjectByName('rider.face') as THREE.Mesh;
      const eyeL=dragon.rider.getObjectByName('rider.eye.left') as THREE.Mesh;
      expect(head).toBeInstanceOf(THREE.Group);
      expect(mouth.parent?.parent).toBe(head);
      expect(face.parent?.parent).toBe(head);
      expect(eyeL.parent?.parent).toBe(head);
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
      expect(head.rotation.y).toBeLessThan(-.05);
      expect(head.rotation.z).toBeLessThan(-.02);
      expect(Math.abs(head.rotation.x)).toBeLessThan(.076);
      // The same visible head is reused for small and giant forms.
      expect(head.position.y).toBeCloseTo(1.19,6);
      expect(Math.abs(mouth.position.y)).toBeLessThan(.01);
      expect(dragon.rider.scale.x).toBe(1);
      expect(dragon.rider.getObjectByName('rider.elf-ear')).toBeUndefined();
    }finally{dragon.dispose();}
  });
});
