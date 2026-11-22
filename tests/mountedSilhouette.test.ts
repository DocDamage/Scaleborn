import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';
import { FORMS } from '../src/actors/dragon/forms';
import { ONYX_SADDLE_DORSAL_Y } from '../src/actors/rider/mountSeat';
import { riderPose } from '../src/actors/rider/pose';

describe('actual saddle contact and mounted limb clearance',()=>{
  it('places rideable-form knees and ankles outside the upper dragon flank',()=>{
    const dragon=new DragonVisual(),state=newFlightState();
    try{
      state.mode='ground';state.speed=0;state.form='rideable';state.time=2;
      dragon.update(state);
      dragon.rider.updateMatrixWorld(true);
      const inv=dragon.rider.matrixWorld.clone().invert();
      for(const side of ['left','right']){
        const knee=dragon.rider.getObjectByName('rider.'+side+'Knee')!;
        const ankle=dragon.rider.getObjectByName('rider.'+side+'Ankle')!;
        const kneePos=knee.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
        const anklePos=ankle.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
        expect(Math.abs(kneePos.x)).toBeGreaterThan(.28);
        expect(Math.abs(anklePos.x)).toBeGreaterThan(.43);
      }
      expect(dragon.rider.scale.x).toBe(1);
    }finally{dragon.dispose();}
  });

  it('keeps giant form knees on the dorsal shelf rather than burying them',()=>{
    const dragon=new DragonVisual(),state=newFlightState();
    try{
      state.mode='ground';state.speed=0;state.form='giant';
      for(let i=1;i<=60;i++){state.time=i*.05;dragon.update(state);}
      // Refresh the root's world matrix before transforming knees into
      // dragon-local coordinates; the actor can be far above world zero.
      dragon.root.updateMatrixWorld(true);
      const inv=dragon.root.matrixWorld.clone().invert();
      const saddle=ONYX_SADDLE_DORSAL_Y*dragon.body.scale.x;
      for(const side of ['left','right']){
        const knee=dragon.rider.getObjectByName('rider.'+side+'Knee')!;
        const position=knee.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
        expect(position.y).toBeGreaterThan(saddle-.06);
        expect(position.y).toBeLessThan(saddle+.20);
      }
      const motion=riderPose(state);
      expect(motion.leftLeg).toBeGreaterThan(1.2);
      expect(motion.leftKnee).toBeGreaterThan(.25);
      expect(dragon.body.scale.x).toBeCloseTo(FORMS.giant.visualScale,2);
      expect(dragon.rider.scale.x).toBe(1);
    }finally{dragon.dispose();}
  });

  it('dismounts and resets thigh/knee abduction without altering physics',()=>{
    const dragon=new DragonVisual(),state=newFlightState();
    try{
      state.mode='ground';state.speed=0;state.time=1;dragon.update(state);
      expect(dragon.rider.getObjectByName('rider.leftLeg')!.rotation.z)
        .toBeLessThan(-.8);
      state.form='small';state.riderMode='ground';state.riderSpeed=0;
      const before={x:state.x,y:state.y,z:state.z};
      state.time=2;dragon.update(state);
      expect(dragon.rider.getObjectByName('rider.leftLeg')!.rotation.z).toBeCloseTo(0,6);
      expect(dragon.rider.getObjectByName('rider.rightKnee')!.rotation.z).toBeCloseTo(0,6);
      expect({x:state.x,y:state.y,z:state.z}).toEqual(before);
    }finally{dragon.dispose();}
  });
});
