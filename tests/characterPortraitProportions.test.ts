import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeScalebornRider } from '../src/actors/rider/heroSculpt';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';

describe('portrait-directed original character refinements',()=>{
  it('reduces doll-like eyes and brows without removing original heroine features',()=>{
    const rider=makeScalebornRider();
    try{
      const face=rider.getObjectByName('rider.face') as THREE.Mesh;
      const neck=rider.getObjectByName('rider.neck') as THREE.Mesh;
      const hair=rider.getObjectByName('rider.crown') as THREE.Mesh;
      expect(face.geometry.getAttribute('position').getY(0)).toBeLessThan(1.18);
      expect(neck.geometry.getAttribute('position').getY(0)).toBeLessThan(1.18);
      for(const suffix of ['left','right']){
        const eye=rider.getObjectByName('rider.eye.'+suffix) as THREE.Mesh;
        const iris=rider.getObjectByName('rider.iris.'+suffix) as THREE.Mesh;
        const brow=rider.getObjectByName('rider.brow.'+suffix) as THREE.Mesh;
        expect(eye.scale.x).toBeLessThan(.034);
        expect(eye.scale.y).toBeLessThan(.015);
        expect(eye.scale.z).toBeLessThan(.005);
        expect(iris.scale.x).toBeLessThan(.011);
        expect(Math.abs(iris.position.z-eye.position.z)).toBeLessThan(.006);
        expect(brow.material).toBe(hair.material);
      }
      const nose=rider.getObjectByName('rider.nose') as THREE.Mesh;
      nose.geometry.computeBoundingBox();
      expect(nose.geometry.boundingBox!.min.z).toBeGreaterThan(-.185);
      expect(nose.geometry.boundingBox!.min.y).toBeGreaterThan(1.25);
      expect(rider.userData.assetId).toBe('character.rider.hero');
      expect(rider.getObjectByName('rider.elf-ear')).toBeUndefined();
    }finally{rider.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});}
  });

  it('keeps original Onyx reptilian detail while reducing oversized iris and horn silhouette',()=>{
    const dragon=new DragonVisual();
    try{
      for(const suffix of ['left','right']){
        const eye=dragon.root.getObjectByName('creature.dragon.eye.iris.'+suffix) as THREE.Mesh;
        const pupil=dragon.root.getObjectByName('creature.dragon.eye.pupil.'+suffix) as THREE.Mesh;
        const horn=dragon.root.getObjectByName('creature.dragon.horn.'+suffix) as THREE.Mesh;
        const material=eye.material as THREE.MeshStandardMaterial;
        expect(eye.scale.x).toBeLessThan(.10);
        expect(eye.scale.y).toBeLessThan(.14);
        expect(eye.scale.z).toBeGreaterThan(eye.scale.x);
        expect(pupil.scale.y).toBeLessThan(.09);
        expect(material.roughness).toBeGreaterThan(.7);
        expect(material.emissiveIntensity).toBeLessThan(.08);
        horn.geometry.computeBoundingBox();
        expect(horn.geometry.boundingBox!.max.y).toBeLessThan(.85);
        expect(horn.geometry.boundingBox!.max.z).toBeGreaterThan(1.05);
      }
      const state=newFlightState();state.time=3.22;
      dragon.update(state);
      const eye=dragon.root.getObjectByName('creature.dragon.eye.iris.left') as THREE.Mesh;
      expect(eye.scale.y).toBeLessThan(.02);
      expect(dragon.root.userData.assetId).toBe('creature.dragon.onyx');
    }finally{dragon.dispose();}
  });
});
