import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  mountedRiderSeat, ONYX_SADDLE_DORSAL_Y, RIDER_PELVIS_Y,
  SADDLE_CONTACT_CLEARANCE,
} from '../src/actors/rider/mountSeat';
import { DragonVisual } from '../src/actors/dragon/visual';
import { FORMS } from '../src/actors/dragon/forms';
import { newFlightState } from '../src/actors/dragon/flight';
import { riderPose } from '../src/actors/rider/pose';

describe('rider contact with Onyx in all three forms',()=>{
  it('keeps the child pelvis at the dragon back, not floating above the saddle',()=>{
    for(const form of ['rideable','giant'] as const){
      const scale=FORMS[form].visualScale;
      const seat=mountedRiderSeat(scale);
      expect(seat.y+RIDER_PELVIS_Y)
        .toBeCloseTo(ONYX_SADDLE_DORSAL_Y*scale+SADDLE_CONTACT_CLEARANCE,6);
      expect(seat.z).toBeLessThan(0);
      expect(Math.abs(seat.y)).toBeLessThan(.75);
    }
    for(const scale of [Number.NaN,0,-1,Infinity]){
      expect(()=>mountedRiderSeat(scale)).toThrow();
    }
  });

  it('measures the seat against the actual continuous dorsal geometry',()=>{
    const visual=new DragonVisual();
    try{
      const torso=visual.root.getObjectByName('creature.dragon.onyx.anatomical-torso') as THREE.Mesh;
      const p=torso.geometry.getAttribute('position');
      let dorsal=-Infinity;
      for(let i=0;i<p.count;i++){
        if(Math.abs(p.getZ(i)+.23)<.07 && Math.abs(p.getX(i))<.04) {
          dorsal=Math.max(dorsal,p.getY(i));
        }
      }
      expect(dorsal).toBeGreaterThan(.64);
      expect(dorsal).toBeLessThan(.79);
      for(const scale of [FORMS.rideable.visualScale,FORMS.giant.visualScale]){
        const seat=mountedRiderSeat(scale);
        const pelvis=seat.y+RIDER_PELVIS_Y;
        expect(pelvis-dorsal*scale).toBeGreaterThan(.02);
        expect(pelvis-dorsal*scale).toBeLessThan(.2);
      }
    }finally{visual.dispose();}
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

  it('holds pelvis contact to Onyx during body-bob without changing game state',()=>{
    const dragon=new DragonVisual(), state=newFlightState();
    try{
      state.mode='ground'; state.speed=5.5; state.time=.45;
      const original={x:state.x,y:state.y,z:state.z};
      dragon.update(state);
      const seat=mountedRiderSeat(dragon.body.scale.x);
      expect(Math.abs(dragon.body.position.y)).toBeGreaterThan(.001);
      expect(dragon.rider.position.y-seat.y)
        .toBeCloseTo(dragon.body.position.y,6);
      expect(dragon.rider.position.z).toBeCloseTo(seat.z,6);
      expect(dragon.rider.scale.x).toBe(1);
      expect({x:state.x,y:state.y,z:state.z}).toEqual(original);
      // Flight has no gait bob: rider returns exactly to the seat socket.
      state.mode='air';state.time+=.05;
      dragon.update(state);
      expect(dragon.rider.position.y)
        .toBeCloseTo(mountedRiderSeat(dragon.body.scale.x).y,6);
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
