import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeScalebornRider } from '../src/actors/rider/heroSculpt';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';
import { riderPose } from '../src/actors/rider/pose';
import { riderFacialPose } from '../src/actors/rider/riderExpression';
import {
  RIDER_FACE_MORPHS,installRiderFaceMorphs,poseRiderFaceMorphs,
} from '../src/actors/rider/riderFaceMorph';

describe('original child-hybrid facial shape keys',()=>{
  it('sculpts two smooth, finite original face deformations with normals',()=>{
    const rider=makeScalebornRider();
    try{
      const face=rider.getObjectByName('rider.face') as THREE.Mesh;
      expect(face).toBeInstanceOf(THREE.Mesh);
      const g=face.geometry;
      const p=g.getAttribute('position'),uv=g.getAttribute('uv');
      expect(g.morphAttributes.position).toHaveLength(2);
      expect(g.morphAttributes.normal).toHaveLength(2);
      expect(face.morphTargetInfluences).toHaveLength(2);
      expect(face.morphTargetDictionary?.[RIDER_FACE_MORPHS[0]]).toBe(0);
      expect(face.morphTargetDictionary?.[RIDER_FACE_MORPHS[1]]).toBe(1);
      let maxLift=0,maxFocus=0,maxDisplacement=0;
      for(let i=0;i<p.count;i++){
        const original=new THREE.Vector3().fromBufferAttribute(p,i);
        for(const [j,target] of g.morphAttributes.position.entries()){
          const adjusted=new THREE.Vector3().fromBufferAttribute(target,i);
          const delta=adjusted.distanceTo(original);
          maxDisplacement=Math.max(maxDisplacement,delta);
          if(j===0)maxLift=Math.max(maxLift,delta);
          else maxFocus=Math.max(maxFocus,delta);
          const n=g.morphAttributes.normal[j]!;
          expect([adjusted.x,adjusted.y,adjusted.z,
            n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite)).toBe(true);
        }
        expect([p.getX(i),p.getY(i),p.getZ(i),uv.getX(i),uv.getY(i)]
          .every(Number.isFinite)).toBe(true);
      }
      expect(maxLift).toBeGreaterThan(.004);
      expect(maxFocus).toBeGreaterThan(.003);
      expect(maxDisplacement).toBeLessThan(.018);
      expect(g.boundingSphere).not.toBeNull();
      expect(()=>installRiderFaceMorphs(face)).toThrow();
    }finally{
      rider.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
    }
  });

  it('drives bounded facial expressions across rest, mount and dive',()=>{
    const dragon=new DragonVisual();
    const state=newFlightState();
    try{
      const face=dragon.rider.getObjectByName('rider.face') as THREE.Mesh;
      const mouth=dragon.rider.getObjectByName('rider.mouth') as THREE.Mesh;
      const head=dragon.rider.getObjectByName('rider.head') as THREE.Group;
      state.form='small';state.riderMode='ground';state.time=1.3;
      dragon.update(state);
      const idle=riderFacialPose(state,riderPose(state));
      expect(face.morphTargetInfluences?.[0]).toBeCloseTo(idle.cheekLift,6);
      expect(face.morphTargetInfluences?.[1]).toBeCloseTo(0,6);
      expect(mouth.scale.x).toBeGreaterThan(1);
      expect(face.parent?.parent).toBe(head);
      state.form='rideable';state.mode='air';state.roll=.6;
      state.time=1.6;dragon.update(state);
      const alert=riderFacialPose(state,riderPose(state));
      expect(face.morphTargetInfluences?.[1]).toBeCloseTo(alert.faceFocus,6);
      expect(alert.faceFocus).toBeGreaterThan(.2);
      expect(alert.cheekLift).toBeLessThan(idle.cheekLift);
      state.form='small';state.riderMode='underwater';
      state.time=2;dragon.update(state);
      expect(face.morphTargetInfluences?.[1]).toBeCloseTo(.28,6);
      expect(dragon.rider.scale.x).toBe(1);
      poseRiderFaceMorphs(face,Infinity,NaN);
      expect(face.morphTargetInfluences).toEqual([0,0]);
      poseRiderFaceMorphs(face,-4,8);
      expect(face.morphTargetInfluences).toEqual([0,.55]);
      expect(dragon.rider.getObjectByName('rider.horn.left')).toBeDefined();
      expect(dragon.rider.getObjectByName('rider.elf-ear')).toBeUndefined();
    }finally{dragon.dispose();}
  });
});
