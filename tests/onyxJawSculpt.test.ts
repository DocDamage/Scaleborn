import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { sculptOnyxLowerJaw } from '../src/actors/dragon/onyxJawSculpt';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';

describe('original articulated Onyx lower jaw anatomy',()=>{
  it('uses a contiguous tapered jaw and paired curved inset lip seams',()=>{
    const m=new THREE.MeshStandardMaterial();
    const jaw=sculptOnyxLowerJaw(m,m,m);
    try{
      expect(jaw.position.y).toBeCloseTo(.17,6);
      expect(jaw.position.z).toBeCloseTo(.06,6);
      const flesh=jaw.getObjectByName('creature.dragon.lower-jaw') as THREE.Mesh;
      expect(flesh).toBeInstanceOf(THREE.Mesh);
      expect(flesh.geometry).not.toBeInstanceOf(THREE.SphereGeometry);
      expect(flesh.geometry.getAttribute('position').count).toBeGreaterThan(1500);
      for(const side of ['left','right']){
        const lip=jaw.getObjectByName('creature.dragon.lower-lip.'+side) as THREE.Mesh;
        expect(lip).toBeInstanceOf(THREE.Mesh);
        expect(lip.geometry.getAttribute('position').count).toBeGreaterThan(400);
        for(let i=0;i<2;i++){
          const tooth=jaw.getObjectByName('creature.dragon.lower-tooth.'+side+'.'+i) as THREE.Mesh;
          expect(tooth).toBeInstanceOf(THREE.Mesh);
          expect(tooth.geometry).not.toBeInstanceOf(THREE.ConeGeometry);
          expect(tooth.geometry.getAttribute('position').count).toBeGreaterThan(150);
        }
      }
      jaw.traverse(o=>{
        if(!(o instanceof THREE.Mesh))return;
        const g=o.geometry;
        const p=g.getAttribute('position'),n=g.getAttribute('normal');
        expect(n.count).toBe(p.count);
        for(let i=0;i<p.count;i++){
          expect([p.getX(i),p.getY(i),p.getZ(i),
            n.getX(i),n.getY(i),n.getZ(i)]
            .every(Number.isFinite)).toBe(true);
        }
      });
    }finally{
      jaw.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
      m.dispose();
    }
  });

  it('inherits the existing live jaw hinge and expression without changing forms',()=>{
    const dragon=new DragonVisual();
    const state=newFlightState();
    try{
      const hinge=dragon.root.getObjectByName('creature.dragon.onyx.jaw-hinge') as THREE.Group;
      const flesh=hinge.getObjectByName('creature.dragon.lower-jaw') as THREE.Mesh;
      const lip=hinge.getObjectByName('creature.dragon.lower-lip.right') as THREE.Mesh;
      expect(hinge).toBeInstanceOf(THREE.Group);
      expect(flesh).toBeInstanceOf(THREE.Mesh);
      expect(lip).toBeInstanceOf(THREE.Mesh);
      state.mode='ground';state.speed=0;state.time=1.4;
      dragon.update(state);
      dragon.root.updateMatrixWorld(true);
      const before=lip.getWorldPosition(new THREE.Vector3());
      const rest=hinge.rotation.x;
      state.mode='air';state.time=1.6;
      dragon.update(state);
      expect(hinge.rotation.x).not.toBeCloseTo(rest,6);
      dragon.root.updateMatrixWorld(true);
      expect(lip.getWorldPosition(new THREE.Vector3()).distanceTo(before))
        .toBeGreaterThan(.0005);
      expect(dragon.rider.scale.x).toBe(1);
      expect(dragon.root.userData.assetId).toBe('creature.dragon.onyx');
    }finally{dragon.dispose();}
  });
});
