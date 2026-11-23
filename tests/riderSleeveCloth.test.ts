import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeScalebornRider } from '../src/actors/rider/heroSculpt';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';
import {
  poseSleeveCrease,sleeveCreaseInfluence,
} from '../src/actors/rider/riderSleeveCloth';

describe('adolescent rider bend-responsive original garment',()=>{
  it('installs stable curved crease geometry on both existing sleeves',()=>{
    const rider=makeScalebornRider();
    try{
      for(const side of ['left','right']){
        const arm=rider.getObjectByName('rider.'+side+'Arm') as THREE.Group;
        const sleeve=arm.getObjectByName('rider.sleeve') as THREE.Mesh;
        expect(sleeve).toBeInstanceOf(THREE.Mesh);
        expect(arm.getObjectByName('rider.'+side+'Elbow')).toBeInstanceOf(THREE.Group);
        const p=sleeve.geometry.getAttribute('position');
        const fold=sleeve.geometry.morphAttributes.position?.[0];
        expect(fold).toBeDefined();
        expect(fold!.count).toBe(p.count);
        expect(sleeve.geometry.morphTargetsRelative).toBe(false);
        expect(sleeve.morphTargetInfluences).toHaveLength(1);
        expect(sleeve.geometry.boundingSphere?.radius).toBeGreaterThan(0);
        let motion=0,maxDisplacement=0;
        for(let i=0;i<p.count;i++){
          const delta=Math.hypot(
            p.getX(i)-fold!.getX(i),
            p.getY(i)-fold!.getY(i),
            p.getZ(i)-fold!.getZ(i));
          expect([fold!.getX(i),fold!.getY(i),fold!.getZ(i)]
            .every(Number.isFinite)).toBe(true);
          maxDisplacement=Math.max(maxDisplacement,delta);
          if(p.getY(i)<-.24&&p.getY(i)>-.36)motion=Math.max(motion,delta);
          if(p.getY(i)>-.08)expect(delta).toBeLessThan(.0002);
        }
        expect(motion).toBeGreaterThan(.003);
        expect(maxDisplacement).toBeLessThan(.04);
      }
    }finally{rider.traverse(x=>{
      if(x instanceof THREE.Mesh)x.geometry.dispose();
    });}
  });

  it('maps elbow flexion to a finite, clamped GPU morph influence',()=>{
    expect(sleeveCreaseInfluence(0)).toBe(0);
    expect(sleeveCreaseInfluence(Number.POSITIVE_INFINITY)).toBe(0);
    expect(sleeveCreaseInfluence(Number.NaN)).toBe(0);
    expect(sleeveCreaseInfluence(-3)).toBe(1);
    expect(sleeveCreaseInfluence(.8)).toBeGreaterThan(.5);
    const mesh=new THREE.Mesh();
    poseSleeveCrease(mesh,1);
    expect(mesh.morphTargetInfluences).toBeUndefined();
  });

  it('uses actual limb bends in mounted and swimming play without changing actor size',()=>{
    const dragon=new DragonVisual(),state=newFlightState();
    try{
      state.time=1;state.mode='ground';state.form='rideable';
      dragon.update(state);
      const arms=['left','right'].map(side=>
        dragon.rider.getObjectByName('rider.'+side+'Arm') as THREE.Group);
      const sleeves=arms.map(arm=>arm.getObjectByName('rider.sleeve') as THREE.Mesh);
      for(const sleeve of sleeves){
        expect(sleeve.morphTargetInfluences![0]).toBeGreaterThan(.1);
      }
      state.form='small';state.riderMode='surface';state.time=2;
      dragon.update(state);
      expect(sleeves[0]!.morphTargetInfluences![0]).not
        .toBeCloseTo(sleeves[1]!.morphTargetInfluences![0]!,4);
      expect(dragon.rider.scale.x).toBe(1);
    }finally{dragon.dispose();}
  });
});
