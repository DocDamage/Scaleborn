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
  it('sculpts shallow bilateral reptilian eye lenses, not bulging eyeballs',()=>{
    const dragon=new DragonVisual();
    try{
      for(const side of [-1,1] as const){
        const suffix=side<0?'left':'right';
        const eye=dragon.root.getObjectByName('creature.dragon.eye.iris.'+suffix) as THREE.Mesh;
        const pupil=dragon.root.getObjectByName('creature.dragon.eye.pupil.'+suffix) as THREE.Mesh;
        expect(eye.geometry).not.toBeInstanceOf(THREE.SphereGeometry);
        const p=eye.geometry.getAttribute('position');
        const uv=eye.geometry.getAttribute('uv');
        const normal=eye.geometry.getAttribute('normal');
        expect(p.count).toBe(33*13);
        expect(uv.count).toBe(p.count);
        expect(eye.geometry.index?.count).toBe(32*12*6);
        expect(eye.scale.z).toBeGreaterThan(eye.scale.x);
        expect(p.getX(16*13+6)*side).toBeGreaterThan(.25);
        expect(normal.getX(16*13+6)*side).toBeGreaterThan(.5);
        expect(pupil.scale.x).toBeLessThan(.04);
        for(let i=0;i<p.count;i++){
          expect([p.getX(i),p.getY(i),p.getZ(i),
            normal.getX(i),normal.getY(i),normal.getZ(i)]
            .every(Number.isFinite)).toBe(true);
        }
      }
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
