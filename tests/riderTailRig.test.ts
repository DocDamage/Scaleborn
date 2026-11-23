import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createRiderTailRig, poseRiderTail } from '../src/actors/rider/riderTailRig';
import { riderPose } from '../src/actors/rider/pose';
import { newFlightState } from '../src/actors/dragon/flight';
import { DragonVisual } from '../src/actors/dragon/visual';

describe('original heroine deforming hybrid tail',()=>{
  it('skins a single continuous tail to three normalized bones',()=>{
    const skin=new THREE.MeshStandardMaterial();
    const finMat=new THREE.MeshStandardMaterial();
    const rig=createRiderTailRig(skin,finMat);
    try{
      expect(rig.root.name).toBe('rider.tail');
      expect(rig.mesh).toBeInstanceOf(THREE.SkinnedMesh);
      expect(rig.mesh.skeleton.bones).toEqual([rig.base,rig.mid,rig.tip]);
      expect(rig.mesh.frustumCulled).toBe(false);
      const p=rig.mesh.geometry.getAttribute('position');
      const normal=rig.mesh.geometry.getAttribute('normal');
      const joint=rig.mesh.geometry.getAttribute('skinIndex');
      const weight=rig.mesh.geometry.getAttribute('skinWeight');
      expect(p.count).toBeGreaterThan(700);
      expect(joint.count).toBe(p.count);
      expect(weight.count).toBe(p.count);
      for(let i=0;i<p.count;i++){
        expect(weight.getX(i)+weight.getY(i)+weight.getZ(i))
          .toBeCloseTo(1,5);
        expect([p.getX(i),p.getY(i),p.getZ(i),
          normal.getX(i),normal.getY(i),normal.getZ(i)]
          .every(Number.isFinite)).toBe(true);
      }
      const middle=Math.floor(p.count/2);
      expect(weight.getY(middle)).toBeGreaterThan(.4);
    }finally{
      rig.root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
      skin.dispose();finMat.dispose();
    }
  });

  it('keeps the original fin in place at rest and moves it with the tip bone',()=>{
    const skin=new THREE.MeshStandardMaterial();
    const rig=createRiderTailRig(skin,skin);
    try{
      const fin=rig.root.getObjectByName('rider.tail-tip') as THREE.Mesh;
      expect(fin).toBeInstanceOf(THREE.Mesh);
      expect(rig.finSocket.parent).toBe(rig.tip);
      rig.root.updateMatrixWorld(true);
      const vertex=new THREE.Vector3().fromBufferAttribute(
        fin.geometry.getAttribute('position'),0);
      const rest=rig.root.worldToLocal(vertex.clone().applyMatrix4(fin.matrixWorld));
      expect(rest.x).toBeCloseTo(.08,4);
      expect(rest.y).toBeCloseTo(-.16,4);
      expect(rest.z).toBeCloseTo(.82,4);
      const original=fin.getWorldPosition(new THREE.Vector3());
      const state=newFlightState();
      state.form='small';state.riderMode='underwater';state.time=1.2;
      poseRiderTail(rig,state,riderPose(state));
      rig.root.updateMatrixWorld(true);
      expect(fin.getWorldPosition(new THREE.Vector3()).distanceTo(original))
        .toBeGreaterThan(.005);
    }finally{
      rig.root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
      skin.dispose();
    }
  });

  it('animates independently during swimming and banking without scaling the child',()=>{
    const dragon=new DragonVisual(),state=newFlightState();
    try{
      state.time=1.1;state.roll=.5;
      dragon.update(state);
      const root=dragon.rider.getObjectByName('rider.tail') as THREE.Group;
      const mid=dragon.rider.getObjectByName('rider.tail.mid') as THREE.Bone;
      const tip=dragon.rider.getObjectByName('rider.tail.end') as THREE.Bone;
      expect(root).toBeInstanceOf(THREE.Group);
      expect(mid).toBeInstanceOf(THREE.Bone);
      expect(tip).toBeInstanceOf(THREE.Bone);
      expect(mid.rotation.y).not.toBeCloseTo(tip.rotation.y,3);
      expect(dragon.rider.scale.x).toBe(1);
      const mountedBend=tip.rotation.y;
      state.form='small';state.riderMode='underwater';state.time=1.7;
      dragon.update(state);
      expect(tip.rotation.y).not.toBeCloseTo(mountedBend,3);
      expect(dragon.rider.scale.x).toBe(1);
      // The tail renderer sanitizes bad telemetry independently; the
      // gameplay FlightState itself is intentionally not mutated.
      const swimPose=riderPose(state);
      state.time=Number.NaN;state.roll=Number.POSITIVE_INFINITY;
      poseRiderTail({root,mid,tip},state,swimPose);
      expect([root.rotation.x,root.rotation.y,mid.rotation.y,tip.rotation.y]
        .every(Number.isFinite)).toBe(true);
    }finally{dragon.dispose();}
  });
});
