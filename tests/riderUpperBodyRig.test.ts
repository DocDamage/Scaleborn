import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeScalebornRider } from '../src/actors/rider/heroSculpt';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';
import { riderPose } from '../src/actors/rider/pose';
import {
  installRiderUpperBody,riderUpperBodyPose,RIDER_SPINE_PIVOT_Y,
} from '../src/actors/rider/riderUpperBodyRig';

describe('original rider child-scale thoracic articulation',()=>{
  it('preserves all rest-space facial, coat and arm coordinates',()=>{
    const rider=makeScalebornRider();
    try{
      const spine=rider.getObjectByName('rider.spine') as THREE.Group;
      const rest=rider.getObjectByName('rider.spine-rest-space') as THREE.Group;
      expect(spine).toBeInstanceOf(THREE.Group);
      expect(rest).toBeInstanceOf(THREE.Group);
      expect(rest.parent).toBe(spine);
      expect(spine.position.y).toBeCloseTo(RIDER_SPINE_PIVOT_Y,8);
      expect(rest.position.y).toBeCloseTo(-RIDER_SPINE_PIVOT_Y,8);
      for(const name of [
        'rider.head','rider.fitted-coat','rider.neck',
        'rider.leftArm','rider.rightArm','rider.travel-cloak',
        'rider.coat-lapel.left','rider.coat-lapel.right',
        'rider.bond-pendant',
      ]){
        expect(rest.getObjectByName(name),name).toBeDefined();
      }
      rider.updateMatrixWorld(true);
      const head=rider.getObjectByName('rider.head')!;
      const leftArm=rider.getObjectByName('rider.leftArm')!;
      const leftLeg=rider.getObjectByName('rider.leftLeg')!;
      const tail=rider.getObjectByName('rider.tail')!;
      expect(head.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(1.19,6);
      expect(leftArm.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(1.107,6);
      expect(leftLeg.parent).toBe(rider);
      expect(tail.parent).toBe(rider);
      expect(leftLeg.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(.66,6);
      expect(()=>installRiderUpperBody(rider)).toThrow();
      expect(rider.userData.assetId).toBe('character.rider.hero');
    }finally{rider.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});}
  });

  it('keeps the pelvis stable while the chest responds to banking and lean',()=>{
    const dragon=new DragonVisual(),state=newFlightState();
    try{
      state.form='rideable';state.mode='air';state.roll=.65;
      state.pitch=.35;state.speed=17;state.time=2;
      dragon.update(state);
      const upper=riderUpperBodyPose(state,riderPose(state));
      const spine=dragon.rider.getObjectByName('rider.spine') as THREE.Group;
      const leg=dragon.rider.getObjectByName('rider.leftLeg') as THREE.Group;
      expect(spine.rotation.x).toBeCloseTo(upper.spinePitch,6);
      expect(Math.abs(spine.rotation.z)).toBeGreaterThan(Math.abs(dragon.rider.rotation.z));
      expect(Math.abs(dragon.rider.rotation.x)).toBeLessThan(Math.abs(spine.rotation.x));
      expect(leg.parent).toBe(dragon.rider);
      expect(dragon.rider.scale.x).toBe(1);
      const mountedPitch=spine.rotation.x;
      state.form='small';state.riderMode='ground';state.riderSpeed=0;
      state.time=2.4;dragon.update(state);
      expect(spine.rotation.x).not.toBeCloseTo(mountedPitch,4);
      expect(spine.rotation.z).toBeCloseTo(0,5);
      expect(dragon.rider.scale.x).toBe(1);
    }finally{dragon.dispose();}
  });

  it('retains land-to-air brace and clamps invalid presentation telemetry',()=>{
    const state=newFlightState();
    const motion=riderPose(state);
    const resting=riderUpperBodyPose(state,motion,0);
    const launching=riderUpperBodyPose(state,motion,-.16);
    expect(launching.spineBank).toBeLessThan(resting.spineBank);
    expect(launching.pelvisBank).toBeLessThan(resting.pelvisBank);
    state.roll=Number.POSITIVE_INFINITY;state.time=Number.NaN;
    const p=riderUpperBodyPose(state,{...motion,torsoLean:Number.NaN},Infinity);
    expect(Object.values(p).every(Number.isFinite)).toBe(true);
    expect(p.spineYaw).toBe(0);
    expect(p.spinePitch).toBe(0);
  });
});
