import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';
import { ONYX_LEG_FLEX_MORPHS,poseOnyxLegFlex } from '../src/actors/dragon/onyxLegFlex';

describe('organic Onyx hock and foreleg muscle compression',()=>{
  it('adds finite, separately shaded morph targets to all four original legs',()=>{
    const dragon=new DragonVisual();
    try{
      for(const location of ['frontLeft','frontRight','hindLeft','hindRight']){
        const group=dragon.root.getObjectByName('leg.'+location) as THREE.Group;
        const flesh=group.getObjectByName('creature.dragon.leg-surface') as THREE.Mesh;
        expect(flesh).toBeInstanceOf(THREE.Mesh);
        expect(group.getObjectByName('creature.dragon.ankle')).toBeInstanceOf(THREE.Group);
        const g=flesh.geometry,p=g.getAttribute('position');
        const targets=g.morphAttributes.position;
        const normals=g.morphAttributes.normal;
        expect(targets).toHaveLength(2);
        expect(normals).toHaveLength(2);
        expect(flesh.morphTargetDictionary?.[ONYX_LEG_FLEX_MORPHS[0]]).toBe(0);
        expect(flesh.morphTargetDictionary?.[ONYX_LEG_FLEX_MORPHS[1]]).toBe(1);
        expect(g.morphTargetsRelative).toBe(false);
        let maxOffset=0,nonzero=0;
        for(let i=0;i<p.count;i++){
          const original=new THREE.Vector3().fromBufferAttribute(p,i);
          for(let j=0;j<2;j++){
            const shifted=new THREE.Vector3().fromBufferAttribute(targets[j]!,i);
            const displacement=shifted.distanceTo(original);
            if(displacement>.001)nonzero++;
            maxOffset=Math.max(maxOffset,displacement);
            const n=normals[j]!;
            expect([shifted.x,shifted.y,shifted.z,
              n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite)).toBe(true);
          }
        }
        expect(nonzero).toBeGreaterThan(100);
        expect(maxOffset).toBeGreaterThan(.02);
        expect(maxOffset).toBeLessThan(.065);
        // The original swept leg's cap centers stay fixed: no open gaps at
        // the body or the paw as its hock muscle compresses.
        for(const index of [p.count-2,p.count-1]){
          for(const target of targets){
            expect(target!.getX(index)).toBeCloseTo(p.getX(index),5);
            expect(target!.getY(index)).toBeCloseTo(p.getY(index),5);
            expect(target!.getZ(index)).toBeCloseTo(p.getZ(index),5);
          }
        }
      }
    }finally{dragon.dispose();}
  });

  it('animates opposite diagonal pairs without changing paw bones or forms',()=>{
    const dragon=new DragonVisual();
    const state=newFlightState();
    try{
      state.form='rideable';state.mode='ground';state.speed=4;state.time=.9;
      dragon.update(state);
      const left=dragon.root.getObjectByName('leg.frontLeft') as THREE.Group;
      const right=dragon.root.getObjectByName('leg.frontRight') as THREE.Group;
      const a=left.getObjectByName('creature.dragon.leg-surface') as THREE.Mesh;
      const b=right.getObjectByName('creature.dragon.leg-surface') as THREE.Mesh;
      const diff=Math.abs((a.morphTargetInfluences![0]!-b.morphTargetInfluences![0]!))
        +Math.abs((a.morphTargetInfluences![1]!-b.morphTargetInfluences![1]!));
      expect(diff).toBeGreaterThan(.02);
      expect(left.getObjectByName('creature.dragon.ankle')).toBeDefined();
      state.speed=0;state.time=1.0;dragon.update(state);
      expect(a.morphTargetInfluences).toEqual([0,0]);
      expect(b.morphTargetInfluences).toEqual([0,0]);
      state.mode='underwater';state.time=1.3;dragon.update(state);
      expect((a.morphTargetInfluences![0]!+a.morphTargetInfluences![1]!))
        .toBeGreaterThan(0);
      state.mode='air';state.time=1.6;dragon.update(state);
      expect(a.morphTargetInfluences![1]).toBeGreaterThan(0);
      expect(dragon.rider.scale.x).toBe(1);
    }finally{dragon.dispose();}
  });

  it('clamps invalid animation effort without generating NaNs',()=>{
    const mesh=new THREE.Mesh();
    poseOnyxLegFlex(mesh,NaN);
    expect(mesh.morphTargetInfluences).toBeUndefined();
    mesh.morphTargetInfluences=[0,0];
    poseOnyxLegFlex(mesh,Infinity);
    expect(mesh.morphTargetInfluences).toEqual([0,0]);
    poseOnyxLegFlex(mesh,999);
    expect(mesh.morphTargetInfluences).toEqual([.75,0]);
    poseOnyxLegFlex(mesh,-999);
    expect(mesh.morphTargetInfluences).toEqual([0,.75]);
  });
});
