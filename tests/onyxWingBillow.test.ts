import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createWingRig, poseWing } from '../src/actors/dragon/wingRig';
import { wingBillowInfluence } from '../src/actors/dragon/wingBillow';
import { dragonPose } from '../src/actors/dragon/animationPose';
import { newFlightState } from '../src/actors/dragon/flight';

describe('pinned, breathing original Onyx wing membranes',()=>{
  it('retains three skinned bones and an independently shaded sail-tension morph',()=>{
    for(const side of [-1,1] as const){
      const rig=createWingRig(side);
      try{
        const geometry=rig.mesh.geometry;
        const p=geometry.getAttribute('position');
        const uv=geometry.getAttribute('uv');
        const fold=geometry.morphAttributes.position[0]!;
        const billow=geometry.morphAttributes.position[1]!;
        const normals=geometry.morphAttributes.normal[1]!;
        expect(rig.mesh.skeleton.bones).toHaveLength(3);
        expect(geometry.morphAttributes.position).toHaveLength(2);
        expect(geometry.morphAttributes.normal).toHaveLength(2);
        expect(fold.count).toBe(p.count);
        expect(billow.count).toBe(p.count);
        expect(normals.count).toBe(p.count);
        expect(uv.count).toBe(p.count);
        let internalLift=0;
        for(let i=0;i<p.count;i++){
          const dx=billow.getX(i)-p.getX(i);
          const dy=billow.getY(i)-p.getY(i);
          const dz=billow.getZ(i)-p.getZ(i);
          expect([dx,dy,dz,normals.getX(i),normals.getY(i),normals.getZ(i)]
            .every(Number.isFinite)).toBe(true);
          expect(Math.abs(dx)).toBeLessThan(1e-6);
          expect(Math.abs(dy)).toBeLessThan(.080);
          expect(Math.abs(dz)).toBeLessThan(.012);
          const u=uv.getX(i),v=uv.getY(i);
          if(u===0||u===1||v===0||v===1){
            expect(Math.hypot(dx,dy,dz)).toBeLessThan(1e-6);
          }else{
            internalLift=Math.max(internalLift,dy);
          }
        }
        expect(internalLift).toBeGreaterThan(.03);
      }finally{
        rig.root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
      }
    }
  });

  it('billows in open flight but cannot re-open a grounded folded sail',()=>{
    for(const side of [-1,1] as const){
      const rig=createWingRig(side),state=newFlightState();
      try{
        state.mode='air';state.time=1.45;
        poseWing(rig,side,dragonPose(state));
        const opening=rig.mesh.morphTargetInfluences!;
        expect(opening[0]).toBe(0);
        expect(opening[1]).toBeGreaterThan(.05);
        expect(opening[1]).toBeLessThan(.85);
        const saved=rig.mesh.geometry.morphAttributes.position[1];
        state.mode='ground';state.speed=0;state.time=1.50;
        poseWing(rig,side,dragonPose(state));
        expect(opening[0]).toBe(1);
        expect(opening[1]).toBe(0);
        expect(rig.mesh.geometry.morphAttributes.position[1]).toBe(saved);
        expect(rig.root.scale.x).toBeCloseTo(.44,5);
        expect(rig.root.position.y).toBeCloseTo(.55,5);
        expect(rig.mesh.skeleton.bones).toHaveLength(3);
      }finally{
        rig.root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
      }
    }
  });

  it('keeps tension finite on corrupt animation telemetry',()=>{
    const state=newFlightState(),pose=dragonPose(state);
    expect(wingBillowInfluence({...pose,wingFold:NaN})).toBe(0);
    expect(wingBillowInfluence({...pose,wingFold:1,flapAmount:Infinity})).toBe(0);
    expect(wingBillowInfluence({...pose,wingFold:0,flapAmount:NaN})).toBe(0);
    expect(wingBillowInfluence({...pose,wingFold:0,flapAmount:1,flapPhase:Infinity}))
      .toBeGreaterThan(0);
  });
});
