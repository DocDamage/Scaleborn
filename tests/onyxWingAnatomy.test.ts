import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createWingRig, poseWing } from '../src/actors/dragon/wingRig';
import { dragonPose } from '../src/actors/dragon/animationPose';
import { newFlightState } from '../src/actors/dragon/flight';

describe('Onyx original shoulder tendons and arched finger-bone wings',()=>{
  it('uses curved detailed finger bones instead of low-poly cylinder spars',()=>{
    for(const side of [-1,1] as const){
      const rig=createWingRig(side);
      try{
        const collar=rig.root.getObjectByName(
          side<0?'creature.dragon.wing-root.left':'creature.dragon.wing-root.right') as THREE.Mesh;
        expect(collar).toBeInstanceOf(THREE.Mesh);
        expect(collar.geometry).not.toBeInstanceOf(THREE.CylinderGeometry);
        expect(collar.geometry.getAttribute('position').count).toBeGreaterThan(400);
        for(const [i,bone] of [rig.shoulder,rig.elbow,rig.tip].entries()){
          const mesh=bone.getObjectByName('creature.dragon.wing-finger.'+i) as THREE.Mesh;
          expect(mesh).toBeInstanceOf(THREE.Mesh);
          expect(mesh.geometry).not.toBeInstanceOf(THREE.CylinderGeometry);
          expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(350);
          expect(Math.sign(mesh.position.x)).toBe(side);
          expect(mesh.geometry.getAttribute('normal').count).toBe(
            mesh.geometry.getAttribute('position').count);
        }
        expect(rig.mesh.skeleton.bones).toHaveLength(3);
      }finally{
        rig.root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
      }
    }
  });
  it('folds wings rearward across the torso instead of only lowering them',()=>{
    for(const side of [-1,1] as const){
      const rig=createWingRig(side);
      try{
        const state=newFlightState();
        state.time=1.5;state.mode='air';
        poseWing(rig,side,dragonPose(state));
        expect(rig.shoulder.rotation.y).toBeCloseTo(0,5);
        state.mode='ground';state.speed=0;
        poseWing(rig,side,dragonPose(state));
        expect(rig.shoulder.rotation.y*side).toBeLessThan(-.95);
        expect(rig.elbow.rotation.y*side).toBeLessThan(-.4);
        expect(rig.tip.rotation.y*side).toBeLessThan(-.2);
        expect(Math.abs(rig.shoulder.rotation.z)).toBeLessThan(.38);
      }finally{
        rig.root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
      }
    }
  });
  it('morphs each painted sail into a ribbed narrow fold without tearing skinning',()=>{
    for(const side of [-1,1] as const){
      const rig=createWingRig(side);
      try{
        const geometry=rig.mesh.geometry;
        const rest=geometry.getAttribute('position');
        const folded=geometry.morphAttributes.position![0]!;
        const foldedNormals=geometry.morphAttributes.normal![0]!;
        expect(folded.count).toBe(rest.count);
        expect(foldedNormals.count).toBe(rest.count);
        const row=38*17, leading=row, trailing=row+16;
        expect(Math.abs(folded.getZ(trailing)-folded.getZ(leading)))
          .toBeLessThan(Math.abs(rest.getZ(trailing)-rest.getZ(leading))*.22);
        for(let i=0;i<folded.count;i++){
          expect([folded.getX(i),folded.getY(i),folded.getZ(i),
            foldedNormals.getX(i),foldedNormals.getY(i),foldedNormals.getZ(i)]
            .every(Number.isFinite)).toBe(true);
        }
        const state=newFlightState();
        state.mode='ground';state.time=1.4;state.speed=0;
        poseWing(rig,side,dragonPose(state));
        expect(rig.mesh.morphTargetInfluences![0]).toBeCloseTo(1,6);
        state.mode='air';
        poseWing(rig,side,dragonPose(state));
        expect(rig.mesh.morphTargetInfluences![0]).toBeCloseTo(0,6);
        expect(rig.mesh.skeleton.bones).toHaveLength(3);
      }finally{
        rig.root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
      }
    }
  });
});
