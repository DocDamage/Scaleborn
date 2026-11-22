import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createDragonTailRig, poseDragonTail } from '../src/actors/dragon/dragonTailRig';
import { dragonPose } from '../src/actors/dragon/animationPose';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';

describe('original Onyx animated, seamlessly skinned tail',()=>{
  it('has three correctly parented bones and normalized overlapping weights',()=>{
    const mat=new THREE.MeshStandardMaterial();
    const rig=createDragonTailRig(mat);
    try{
      expect(rig.root.name).toBe('tailTip');
      expect(rig.mesh).toBeInstanceOf(THREE.SkinnedMesh);
      expect(rig.mesh.skeleton.bones.map(b=>b.name)).toEqual([
        'tailTip.base','tailTip.mid','tailTip.end',
      ]);
      expect(rig.base.children).toContain(rig.mid);
      expect(rig.mid.children).toContain(rig.tip);
      expect(rig.tip.children).toContain(rig.finSocket);
      const weights=rig.mesh.geometry.getAttribute('skinWeight');
      const indices=rig.mesh.geometry.getAttribute('skinIndex');
      const pos=rig.mesh.geometry.getAttribute('position');
      expect(weights.count).toBe(pos.count);
      expect(indices.count).toBe(pos.count);
      expect(pos.count).toBeGreaterThan(2500);
      for(let i=0;i<weights.count;i++){
        const sum=weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i);
        expect(sum).toBeCloseTo(1,5);
        for(let j=0;j<4;j++){
          expect(weights.getComponent(i,j)).toBeGreaterThanOrEqual(0);
        }
      }
      const middle=Math.floor(weights.count*.5);
      expect(weights.getY(middle)).toBeGreaterThan(0);
    }finally{rig.mesh.geometry.dispose();mat.dispose();}
  });

  it('moves the tail tip and attached fins without tearing or translating the root',()=>{
    const mat=new THREE.MeshStandardMaterial();
    const rig=createDragonTailRig(mat);
    try{
      const flight=newFlightState();
      flight.mode='underwater';
      flight.time=1.0;
      const original=rig.root.position.clone();
      const midPosition=new THREE.Vector3();
      rig.finSocket.getWorldPosition(midPosition);
      poseDragonTail(rig,dragonPose(flight),flight.time);
      rig.root.updateMatrixWorld(true);
      const moved=new THREE.Vector3();
      rig.finSocket.getWorldPosition(moved);
      expect(rig.root.position.toArray()).toEqual(original.toArray());
      expect(moved.distanceTo(midPosition)).toBeGreaterThan(.05);
      expect(Math.abs(rig.tip.rotation.y)).toBeGreaterThan(.01);
      expect(Math.abs(rig.mid.rotation.y)).toBeGreaterThan(.01);
      expect(Number.isFinite(moved.x)).toBe(true);
    }finally{rig.mesh.geometry.dispose();mat.dispose();}
  });

  it('updates Onyx tail during real animation without changing dragon or rider scales',()=>{
    const creature=new DragonVisual();
    try {
      const state=newFlightState();
      state.mode='surface';
      state.time=1.2;
      creature.update(state);
      const tail=creature.root.getObjectByName('creature.dragon.onyx.skinned-tail');
      expect(tail).toBeInstanceOf(THREE.SkinnedMesh);
      expect((tail as THREE.SkinnedMesh).skeleton.bones).toHaveLength(3);
      expect(creature.root.getObjectByName('tailTip.fins')).toBeInstanceOf(THREE.Group);
      expect(creature.rider.scale.x).toBe(1);
    }finally{creature.dispose();}
  });
});
