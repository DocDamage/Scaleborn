import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';

describe('screenshot-driven Onyx face and pigment readability',()=>{
  it('uses accessible painterly blue-black pigment without plastic gloss',()=>{
    const dragon=new DragonVisual();
    try{
      const body=dragon.root.getObjectByName('creature.dragon.onyx.anatomical-torso') as THREE.Mesh;
      const head=dragon.root.getObjectByName('creature.dragon.onyx.sculpted-skull') as THREE.Mesh;
      const material=body.material as THREE.MeshStandardMaterial;
      expect(body.material).toBe(head.material);
      expect(material.color.r).toBeGreaterThan(.075);
      expect(material.roughness).toBeGreaterThan(.7);
      expect(material.metalness).toBeLessThan(.06);
      expect(material.map).toBeInstanceOf(THREE.DataTexture);
      expect(material.normalMap).toBeInstanceOf(THREE.DataTexture);
    }finally{dragon.dispose();}
  });
  it('has inset slanted readable eyes and backward-swept tapered paired horns',()=>{
    const dragon=new DragonVisual();
    try{
      for(const side of ['left','right']){
        const eye=dragon.root.getObjectByName('creature.dragon.eye.iris.'+side) as THREE.Mesh;
        const pupil=dragon.root.getObjectByName('creature.dragon.eye.pupil.'+side) as THREE.Mesh;
        const horn=dragon.root.getObjectByName('creature.dragon.horn.'+side) as THREE.Mesh;
        expect(eye.scale.y).toBeLessThan(.17);
        expect(eye.scale.x).toBeLessThan(.13);
        expect(pupil.scale.y).toBeLessThan(.13);
        expect(horn.geometry).not.toBeInstanceOf(THREE.ConeGeometry);
        horn.geometry.computeBoundingBox();
        expect(horn.geometry.boundingBox!.max.z).toBeGreaterThan(1.05);
        expect(horn.geometry.boundingBox!.max.y).toBeLessThan(.95);
      }
      const state=newFlightState();
      state.time=3.22;dragon.update(state);
      const blink=dragon.root.getObjectByName('creature.dragon.eye.iris.left') as THREE.Mesh;
      expect(blink.scale.y).toBeLessThan(.02);
    }finally{dragon.dispose();}
  });
});
