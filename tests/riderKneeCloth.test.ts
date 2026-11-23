import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeScalebornRider } from '../src/actors/rider/heroSculpt';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';
import {
  riderKneeClothInfluence,poseRiderKneeCloth,
} from '../src/actors/rider/riderKneeCloth';

describe('original adolescent rider knee-responsive trousers',()=>{
  it('has one correctly shaded bounded cloth morph on each original thigh',()=>{
    const rider=makeScalebornRider();
    try{
      for(const side of ['left','right'] as const){
        const leg=rider.getObjectByName('rider.'+side+'Leg') as THREE.Group;
        const knee=leg.getObjectByName('rider.'+side+'Knee');
        const trousers=leg.getObjectByName('rider.trousers') as THREE.Mesh;
        expect(knee).toBeInstanceOf(THREE.Group);
        expect(trousers).toBeInstanceOf(THREE.Mesh);
        const g=trousers.geometry,p=g.getAttribute('position');
        const morph=g.morphAttributes.position[0]!;
        const normals=g.morphAttributes.normal[0]!;
        expect(g.index?.count).toBeGreaterThan(1000);
        expect(g.getAttribute('uv').count).toBe(p.count);
        expect(morph.count).toBe(p.count);
        expect(normals.count).toBe(p.count);
        expect(g.morphTargetsRelative).toBe(false);
        expect(trousers.morphTargetInfluences).toHaveLength(1);
        let moved=0,maxOffset=0;
        let hipMax=0,kneeMax=0;
        for(let i=0;i<p.count;i++){
          const delta=Math.hypot(
            morph.getX(i)-p.getX(i),
            morph.getY(i)-p.getY(i),
            morph.getZ(i)-p.getZ(i));
          expect([delta,normals.getX(i),normals.getY(i),normals.getZ(i)]
            .every(Number.isFinite)).toBe(true);
          maxOffset=Math.max(maxOffset,delta);
          if(delta>.001)moved++;
          if(p.getY(i)>-.025)hipMax=Math.max(hipMax,delta);
          if(p.getY(i)<-.3551)kneeMax=Math.max(kneeMax,delta);
        }
        expect(moved).toBeGreaterThan(50);
        expect(maxOffset).toBeGreaterThan(.003);
        expect(maxOffset).toBeLessThan(.035);
        expect(hipMax).toBeLessThan(.0001);
        expect(kneeMax).toBeLessThan(.0001);
      }
    }finally{
      rider.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
    }
  });

  it('responds to the existing knee pivot independently in all character modes',()=>{
    const dragon=new DragonVisual(),state=newFlightState();
    try{
      const left=dragon.rider.getObjectByName('rider.leftLeg') as THREE.Group;
      const right=dragon.rider.getObjectByName('rider.rightLeg') as THREE.Group;
      const l=left.getObjectByName('rider.trousers') as THREE.Mesh;
      const r=right.getObjectByName('rider.trousers') as THREE.Mesh;
      state.form='rideable';state.mode='ground';state.time=1;
      dragon.update(state);
      expect(l.morphTargetInfluences![0]).toBeGreaterThan(.85);
      expect(r.morphTargetInfluences![0]).toBeGreaterThan(.85);
      state.form='giant';state.time=2;dragon.update(state);
      expect(l.morphTargetInfluences![0]).toBeLessThan(.5);
      state.form='small';state.riderMode='ground';state.riderSpeed=0;
      state.time=3;dragon.update(state);
      expect(l.morphTargetInfluences![0]).toBeCloseTo(0,6);
      expect(r.morphTargetInfluences![0]).toBeCloseTo(0,6);
      state.riderMode='underwater';state.time=3.4;dragon.update(state);
      expect(l.morphTargetInfluences![0]).toBeGreaterThan(0);
      expect(dragon.rider.scale.x).toBe(1);
      expect(dragon.rider.getObjectByName('rider.tail')).toBeDefined();
    }finally{dragon.dispose();}
  });

  it('does not mutate geometry in the update path or accept invalid bend values',()=>{
    const mesh=new THREE.Mesh();
    poseRiderKneeCloth(mesh,1.2);
    expect(mesh.morphTargetInfluences).toBeUndefined();
    mesh.morphTargetInfluences=[0];
    poseRiderKneeCloth(mesh,NaN);
    expect(mesh.morphTargetInfluences).toEqual([0]);
    poseRiderKneeCloth(mesh,Infinity);
    expect(mesh.morphTargetInfluences).toEqual([0]);
    poseRiderKneeCloth(mesh,-5);
    expect(mesh.morphTargetInfluences).toEqual([1]);
    expect(riderKneeClothInfluence(0)).toBe(0);
    expect(riderKneeClothInfluence(.35)).toBeGreaterThan(0);
  });
});
