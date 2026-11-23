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
  it('uses thin, tapered organic cartilage instead of round mechanical spars',()=>{
    for(const side of [-1,1] as const){
      const rig=createWingRig(side);
      try{
        for(const [index,bone] of [rig.shoulder,rig.elbow,rig.tip].entries()){
          const mesh=bone.getObjectByName('creature.dragon.wing-finger.'+index) as THREE.Mesh;
          const geometry=mesh.geometry;
          const p=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
          const uv=geometry.getAttribute('uv');
          expect(p.count).toBe(41*15);
          expect(uv.count).toBe(p.count);
          expect(geometry.index?.count).toBe(40*14*6);
          expect(geometry.boundingSphere?.radius).toBeGreaterThan(0);
          const ring=(index:number):{height:number;width:number}=>{
            const y:number[]=[],z:number[]=[];
            for(let j=0;j<15;j++){
              y.push(p.getY(index*15+j));
              z.push(p.getZ(index*15+j));
            }
            return {
              height:Math.max(...y)-Math.min(...y),
              width:Math.max(...z)-Math.min(...z),
            };
          };
          const middle=ring(14),tip=ring(40);
          expect(middle.height).toBeLessThan(middle.width*.7);
          expect(tip.width).toBeLessThan(middle.width*.09);
          expect(tip.height).toBeLessThan(middle.height*.09);
          for(let i=0;i<p.count;i++){
            expect([p.getX(i),p.getY(i),p.getZ(i),
              normal.getX(i),normal.getY(i),normal.getZ(i)]
              .every(Number.isFinite)).toBe(true);
          }
        }
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
        // Left and right wings rise toward the same dorsal shelf.
        expect(rig.shoulder.rotation.z*side).toBeGreaterThan(.045);
        expect(rig.shoulder.rotation.z*side).toBeLessThan(.07);
        expect(rig.elbow.rotation.z*side).toBeGreaterThan(.02);
        expect(rig.tip.rotation.z*side).toBeGreaterThan(.01);
        expect(rig.root.position.y).toBeCloseTo(.55,6);
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
        expect(rig.root.scale.x).toBeCloseTo(.44,6);
        expect(rig.root.scale.y).toBeCloseTo(.65,6);
        expect(rig.root.scale.z).toBeCloseTo(.44,6);
        state.mode='air';
        poseWing(rig,side,dragonPose(state));
        expect(rig.mesh.morphTargetInfluences![0]).toBeCloseTo(0,6);
        expect(rig.root.scale.x).toBeCloseTo(1,6);
        expect(rig.root.scale.y).toBeCloseTo(1,6);
        expect(rig.root.scale.z).toBeCloseTo(1,6);
        expect(rig.root.position.y).toBeCloseTo(.40,6);
        expect(rig.mesh.skeleton.bones).toHaveLength(3);
      }finally{
        rig.root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
      }
    }
  });
});
